// Highlight current page in navbar
function highlightCurrentPage() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.navbar-item');
    
    navItems.forEach(item => {
        const page = item.getAttribute('data-page');
        
        // Check if current path matches the page
        if ((currentPath === '/' && page === 'home') ||
            (currentPath.includes('/report') && page === 'report') ||
            (currentPath.includes('/about') && page === 'about')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Add navigation effects
function addNavigationEffects() {
  document.querySelectorAll('.navbar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      // prevent immediate navigation so animation can play
      e.preventDefault();
      link.style.transform = 'scale(0.95)';
      setTimeout(() => {
        link.style.transform = 'scale(1)';
        // navigate after animation completes
        if (href) {
          window.location.href = href;
        }
      }, 150);
    });
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Highlight current page and add navigation effects
  highlightCurrentPage();
  addNavigationEffects();
});