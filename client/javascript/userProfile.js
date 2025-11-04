// SIDEBAR
fetch('/components/sidebar.html') 
  .then(res => res.text())
  .then(html => {
    document.getElementById('sidebarContainer').innerHTML = html;

    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mainContent = document.getElementById('mainContent');
    const overlay = document.getElementById('overlay');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    let isCollapsed = false;
    let isMobile = window.innerWidth <= 768;

    function updateLayout() {
      isMobile = window.innerWidth <= 768;

      if (isMobile) {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('sidebar-collapsed');
        mainContent.classList.add('sidebar-hidden');
      } else {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        mainContent.classList.remove('sidebar-hidden');

        if (isCollapsed) {
          sidebar.classList.add('collapsed');
          mainContent.classList.add('sidebar-collapsed');
        } else {
          sidebar.classList.remove('collapsed');
          mainContent.classList.remove('sidebar-collapsed');
        }
      }
    }

    sidebarToggle.addEventListener('click', function () {
      if (!isMobile) {
        isCollapsed = !isCollapsed;
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('sidebar-collapsed');
        const arrow = sidebarToggle.querySelector('span');
        arrow.textContent = isCollapsed ? '→' : '←';
      }
    });

    mobileMenuBtn.addEventListener('click', function () {
      if (isMobile) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      }
    });

    overlay.addEventListener('click', function () {
      if (isMobile) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      }
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', function () {
        if (isMobile) {
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        }

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
      });
    });

    window.addEventListener('resize', updateLayout);
    updateLayout();
  })
  .catch(err => console.error('Error loading sidebar:', err));


// PROFILE MODULE & UI EVENTS
document.addEventListener('DOMContentLoaded', () => {
  // PROFILE DROPDOWN
  const profileBtn = document.getElementById('profileBtnIcon');
  const dropdownMenu = document.getElementById('dropdownMenu');

  if (profileBtn && dropdownMenu) {
    profileBtn.addEventListener('click', () => {
      dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    window.addEventListener('click', (e) => {
      if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.style.display = 'none';
      }
    });
  }

  // CARD HOVER EFFECT
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseenter', function () {
      this.style.transform = 'translateY(-5px)';
    });
    card.addEventListener('mouseleave', function () {
      this.style.transform = 'translateY(0)';
    });
  });

  // BAR CHART HOVER EFFECT
  document.querySelectorAll('.bar').forEach(bar => {
    bar.addEventListener('mouseenter', function () {
      this.style.transform = 'scaleY(1.1)';
      this.style.background = 'linear-gradient(to top, #030303ff, #3b82f6)';
    });
    bar.addEventListener('mouseleave', function () {
      this.style.transform = 'scaleY(1)';
      this.style.background = 'linear-gradient(to top, #3b82f6, #60a5fa)';
    });
  });

  // PROFILE FORM LOGIC
  const editBtn = document.getElementById('editBtn');
  const saveBtn = document.getElementById('saveBtn');
  const fields = document.querySelectorAll('#profileForm input');

  if (editBtn && saveBtn && fields.length > 0) {
    editBtn.addEventListener('click', () => {
      fields.forEach(field => field.disabled = false);
      editBtn.style.display = 'none';
      saveBtn.style.display = 'block';
    });

    document.getElementById('profileForm').addEventListener('submit', (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const phone = document.getElementById('phone').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      fields.forEach(field => field.disabled = true);
      editBtn.style.display = 'block';
      saveBtn.style.display = 'none';

      const displayName = document.getElementById('displayName');
      if (displayName) displayName.textContent = username;

      const displayUsername = document.getElementById('displayUsername');
      if (displayUsername) displayUsername.textContent = '@' + username;

      localStorage.setItem('loggedInUsername', username);

      const profileBtnIcon = document.getElementById('profileBtnIcon');
      if (profileBtnIcon) {
        profileBtnIcon.textContent = username.charAt(0).toUpperCase();
      }
    });
  }

  // AUTOLOAD USERNAME FROM LOCAL STORAGE
  const savedUsername = localStorage.getItem('loggedInUsername');
  if (savedUsername) {
    const usernameField = document.getElementById('username');
    if (usernameField) usernameField.value = savedUsername;

    const displayName = document.getElementById('displayName');
    if (displayName) displayName.textContent = savedUsername;

    const displayUsername = document.getElementById('displayUsername');
    if (displayUsername) displayUsername.textContent = '@' + savedUsername;

    const profileBtnIcon = document.getElementById('profileBtnIcon');
    if (profileBtnIcon) {
      profileBtnIcon.textContent = savedUsername.charAt(0).toUpperCase();
    }
  }
});
