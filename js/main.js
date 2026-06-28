document.addEventListener('DOMContentLoaded', () => {
  // --- Header scroll effect ---
  const header = document.querySelector('header');
  const checkScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', checkScroll);
  checkScroll(); // Run once in case page loads scrolled

  // --- Mobile Hamburger Menu ---
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('no-scroll');
      });
    });
  }

  // --- Set Active Navigation Link ---
  const currentPath = window.location.pathname;
  const pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === pageName || (pageName === 'index.html' && href === '#') || (pageName.startsWith('project-') && href === 'portfolio.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // --- Contact Form Handling ---
  const contactForm = document.getElementById('contact-form');

  // Form Submit Handler
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Simple validation
      const firstName = document.getElementById('first-name').value.trim();
      const lastName = document.getElementById('last-name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('project-desc').value.trim();
      
      if (!firstName || !lastName || !email || !message) {
        alert('Please fill out all required fields (First Name, Last Name, Email, and Project Description).');
        return;
      }
      
      // Form values logger
      console.log('Form Submitted successfully:', {
        name: `${firstName} ${lastName}`,
        email,
        company: document.getElementById('company').value,
        projectType: document.getElementById('project-type').value,
        timeline: document.getElementById('project-timeline').value,
        message
      });
      
      // Visual Success Message
      const formContainer = document.querySelector('.contact-form-container');
      formContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; animation: fadeIn 0.5s ease-out;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background-color: var(--accent-blue-light); color: var(--accent-blue); display: flex; justify-content: center; align-items: center; margin: 0 auto 2rem auto; font-size: 2rem;">✓</div>
          <h3 style="font-size: 2rem; font-weight: 800; margin-bottom: 1rem; font-family: var(--font-headings);">Thank You, ${firstName}!</h3>
          <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto 2rem auto;">Your message has been received. Sunny will get back to you shortly.</p>
          <a href="index.html" class="btn btn-primary">Go Back Home</a>
        </div>
      `;
    });
  }
});
