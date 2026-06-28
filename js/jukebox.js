/**
 * Real-time Synchronized Spotify Jukebox with Collaborative Playlist Queue
 * Powered by ntfy.sh Pub/Sub & Message Caching (100% Serverless, Free & Globally Synced)
 */

const NTFY_TOPIC_URL = 'https://ntfy.sh/sunny_singh_portfolio_jukebox_topic';

const DEFAULT_FALLBACK_TRACK = {
  type: 'track',
  spotifyId: '4PTG3Z6ehGkBFmzsOhdRCK',
  title: 'Designing for Trust',
  artist: 'Sunny Singh Interview'
};

let playlist = [];
let currentPlayId = '';

document.addEventListener('DOMContentLoaded', () => {
  initJukebox();
});

function initJukebox() {
  const jukeboxCard = document.getElementById('jukebox-card');
  const modal = document.getElementById('jukebox-modal');
  const closeBtn = document.getElementById('jukebox-modal-close');
  const input = document.getElementById('jukebox-song-input');
  const syncBtn = document.getElementById('jukebox-sync-btn');

  if (!jukeboxCard || !modal) return;

  // Open Modal
  jukeboxCard.addEventListener('click', () => {
    modal.classList.add('active');
  });

  // Close Modal
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Handle adding a song to the playlist
  syncBtn.addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) return;

    const parsed = parseSpotifyUrl(value);
    if (parsed) {
      fetchOembedMetadata(parsed.type, parsed.id, (trackInfo) => {
        addTrackToSharedPlaylist(trackInfo);
      });
      input.value = '';
    } else {
      alert('Please enter a valid Spotify Link (Track, Playlist, Album, or Artist)!');
    }
  });

  // Input keypress Enter
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      syncBtn.click();
    }
  });

  // Fetch playlist queue on load
  fetchPlaylist();

  // Establish SSE connection to listen for updates in real-time
  connectRealtimeNotification();
}

function parseSpotifyUrl(url) {
  const match = url.match(/(track|playlist|album|artist)\/([a-zA-Z0-9]{22,})/);
  if (match && match[1] && match[2]) {
    return { type: match[1], id: match[2] };
  }
  
  const uriMatch = url.match(/spotify:(track|playlist|album|artist):([a-zA-Z0-9]{22,})/);
  if (uriMatch && uriMatch[1] && uriMatch[2]) {
    return { type: uriMatch[1], id: uriMatch[2] };
  }
  
  if (/^[a-zA-Z0-9]{22,}$/.test(url)) {
    return { type: 'track', id: url };
  }
  
  return null;
}

function fetchOembedMetadata(type, id, callback) {
  const url = `https://open.spotify.com/oembed?url=https://open.spotify.com/${type}/${id}`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      let title = data.title || `Custom ${type.toUpperCase()}`;
      let artist = 'Spotify';
      
      if (title.includes(' by ')) {
        const parts = title.split(' by ');
        title = parts[0];
        artist = parts[1];
      } else if (title.includes(' - song and lyrics by ')) {
        const parts = title.split(' - song and lyrics by ');
        title = parts[0];
        artist = parts[1];
      }

      callback({
        type,
        spotifyId: id,
        title,
        artist,
        timestamp: Date.now()
      });
    })
    .catch(err => {
      console.warn('oEmbed fetch error, using default parameters:', err);
      callback({
        type,
        spotifyId: id,
        title: `Custom ${type.toUpperCase()}`,
        artist: 'Various Artists',
        timestamp: Date.now()
      });
    });
}

function addTrackToSharedPlaylist(trackInfo) {
  // If list is already at 10 items, publish a reset event first
  if (playlist.length >= 10) {
    publishEvent({ action: 'reset', timestamp: Date.now() })
      .then(() => publishEvent(trackInfo))
      .then(() => fetchPlaylist())
      .catch(err => console.error(err));
  } else {
    publishEvent(trackInfo)
      .then(() => fetchPlaylist())
      .catch(err => console.error(err));
  }
}

function publishEvent(payload) {
  return fetch(NTFY_TOPIC_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Title': 'Jukebox Sync Update',
      'Tags': 'musical_note'
    }
  });
}

function fetchPlaylist() {
  // Fetch the last 20 cached messages from ntfy.sh to make sure we parse through any resets
  fetch(`${NTFY_TOPIC_URL}/json?poll=1&limit=20`)
    .then(res => res.text())
    .then(text => {
      const lines = text.trim().split('\n');
      let tempPlaylist = [];
      
      lines.forEach(line => {
        if (!line) return;
        try {
          const payload = JSON.parse(line);
          if (payload && payload.message) {
            const track = JSON.parse(payload.message);
            
            // If we encounter a reset command, clear everything added before it
            if (track.action === 'reset') {
              tempPlaylist = [];
            } else if (track.spotifyId) {
              // Deduplicate track additions by ID (keep the latest one)
              tempPlaylist = tempPlaylist.filter(t => t.spotifyId !== track.spotifyId);
              tempPlaylist.push(track);
            }
          }
        } catch (e) {
          // Ignore invalid JSON lines (e.g. system notification messages)
        }
      });
      
      // Limit playlist queue size to 10 tracks max
      playlist = tempPlaylist.slice(-10);
      renderPlaylistUI();
    })
    .catch(err => {
      console.error('Error fetching playlist queue:', err);
    });
}

function connectRealtimeNotification() {
  try {
    const sse = new EventSource(`${NTFY_TOPIC_URL}/sse`);

    sse.addEventListener('message', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.message) {
          // Trigger a playlist fetch whenever a new message is received on the topic
          fetchPlaylist();
        }
      } catch (err) {
        console.error('Error parsing SSE payload:', err);
      }
    });

    sse.onerror = (err) => {
      console.warn('SSE disconnected. Re-connecting in 5s...');
      sse.close();
      setTimeout(connectRealtimeNotification, 5000);
    };
  } catch (e) {
    console.error('SSE initialization error:', e);
    setInterval(fetchPlaylist, 5000);
  }
}

function renderPlaylistUI() {
  const listContainer = document.getElementById('jukebox-playlist-list');
  const counterBadge = document.getElementById('playlist-counter');

  if (!listContainer) return;

  // Update Counter Badge
  if (counterBadge) {
    counterBadge.textContent = `${playlist.length} / 10 Songs`;
  }

  // Handle Empty State
  if (playlist.length === 0) {
    listContainer.innerHTML = `<div class="playlist-empty-state">No songs added yet. Paste a link above to start!</div>`;
    return;
  }

  // Populate List
  listContainer.innerHTML = '';
  playlist.forEach((track, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
      <div class="playlist-item-meta">
        <span class="playlist-item-index">${index + 1}</span>
        <div class="playlist-item-details">
          <span class="playlist-item-title">${track.title}</span>
          <span class="playlist-item-artist">${track.artist}</span>
        </div>
      </div>
      <button class="playlist-item-play-btn" aria-label="Play this track">▶</button>
    `;

    // Click play button to load track inside player
    const playBtn = item.querySelector('.playlist-item-play-btn');
    playBtn.addEventListener('click', () => {
      loadTrackIntoPlayer(track);
    });

    listContainer.appendChild(item);
  });

  // Optimistically load the last added song in the player on first fetch if player is empty
  if (playlist.length > 0 && !currentPlayId) {
    loadTrackIntoPlayer(playlist[playlist.length - 1]);
  }
}

function loadTrackIntoPlayer(track) {
  currentPlayId = track.spotifyId;

  // 1. Update Spotify Iframe Embed src
  const iframe = document.getElementById('jukebox-spotify-iframe');
  if (iframe) {
    const type = track.type || 'track';
    iframe.src = `https://open.spotify.com/embed/${type}/${track.spotifyId}?utm_source=generator&theme=0`;
  }

  // 2. Update Soundwave Card Titles on Hero Grid
  const cardTitle = document.getElementById('jukebox-title');
  const cardSubtitle = document.getElementById('jukebox-subtitle');
  const soundwaveBars = document.getElementById('jukebox-bars');

  if (cardTitle) cardTitle.textContent = track.title;
  if (cardSubtitle) cardSubtitle.textContent = track.artist;
  if (soundwaveBars) soundwaveBars.classList.add('playing');
}
