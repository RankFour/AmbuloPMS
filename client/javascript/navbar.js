import fetchCompanyDetails from "../api/loadCompanyInfo.js";

document.addEventListener("DOMContentLoaded", () => {
  // Ensure a mount point exists on every page
  let host = document.getElementById("navbar-placeholder");
  if (!host) {
    host = document.createElement("header");
    host.id = "navbar-placeholder";
    const body = document.body || document.getElementsByTagName('body')[0];
    if (body.firstChild) body.insertBefore(host, body.firstChild); else body.appendChild(host);
  }
  fetch("/components/navbar.html")
    .then((res) => res.text())
    .then(async (data) => {
      document.getElementById("navbar-placeholder").innerHTML = data;
      await injectDynamicLogo();
      setupNavbarFeatures();
      try { setupAuthMenu(); } catch (e) { console.warn('Auth menu init failed', e); }
      try { document.dispatchEvent(new CustomEvent('navbar:loaded')); } catch (e) {}
    })
    .catch((error) => {
      console.error("Error loading navbar:", error);
    });
});

async function injectDynamicLogo() {
  try {
    const logoContainer = document.getElementById('logoContainer');
    if (!logoContainer) return;
    const details = await fetchCompanyDetails();
    if (!details) return; // keep fallback text
    // Prefer alt logo, then icon logo, else fallback text remains
    const markup = details.altLogoHtml || details.logoHtml;
    if (markup) {
      logoContainer.innerHTML = markup;
      logoContainer.classList.add('has-image');
    }
  } catch (e) {
    console.warn('Failed to inject company logo', e);
  }
}

// --- Auth-aware navbar (replace Login with user dropdown) ---
function getTokenFromCookie() {
  try {
    return (document.cookie.match(/(?:^|; )token=([^;]+)/) || [])[1] || null;
  } catch { return null; }
}

function decodeJwtPayload(t) {
  try {
    const parts = String(t || '').split('.');
    if (parts.length < 2) return null;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const json = decodeURIComponent(atob(payload).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const obj = JSON.parse(json);
    if (obj && obj.exp && Date.now() / 1000 > Number(obj.exp)) return null; // expired
    return obj;
  } catch { return null; }
}

function isAdminRole(role) {
  return ["ADMIN", "MANAGER", "STAFF"].includes(String(role || '').toUpperCase());
}

function extractUserName(payload) {
  const p = payload || {};
  // Prefer explicit parts: first_name + middle_name + last_name + suffix
  const parts = [p.first_name, p.middle_name, p.last_name].filter(Boolean);
  const suffix = p.suffix ? String(p.suffix).trim() : '';
  if (parts.length) {
    const base = parts.join(' ').replace(/\s+/g, ' ').trim();
    return suffix ? `${base} ${suffix}` : base;
  }
  const fromRoot = p.full_name || p.fullName || p.name || p.given_name || p.givenName;
  const fromUser = p.user && (p.user.full_name || p.user.fullName || p.user.name || p.user.given_name);
  const fromProfile = p.profile && (p.profile.full_name || p.profile.name || p.profile.given_name);
  const username = p.username || (p.user && p.user.username) || (p.profile && p.profile.username);
  const email = p.email || (p.user && p.user.email) || (p.profile && p.profile.email);
  let val = fromRoot || fromUser || fromProfile || username || '';
  if (!val && email) {
    val = String(email).split('@')[0];
  }
  return val;
}

function extractAvatarUrl(payload) {
  const p = payload || {};
  // Prefer direct avatar string from token or localStorage user
  let url = (
    p.avatar || p.avatar_url || p.avatarUrl || p.photo_url || p.photoUrl || p.profile_photo || p.image ||
    (p.user && (p.user.avatar || p.user.avatar_url || p.user.photo_url || p.user.profile_photo || p.user.image)) ||
    (p.profile && (p.profile.avatar || p.profile.avatar_url || p.profile.photo_url || p.profile.profile_photo || p.profile.image)) || ''
  );
  if (!url) {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        url = u.avatar || u.avatar_url || '';
      }
    } catch {}
  }
  return url;
}

function nameInitials(name) {
  const n = String(name || '').trim();
  if (!n) return 'U';
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map(s => s[0] ? s[0].toUpperCase() : '').join('') || 'U';
}

function setupAuthMenu() {
  const token = getTokenFromCookie() || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
  const payload = decodeJwtPayload(token);
  // Merge in localStorage user fields for middle_name/suffix if present
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const u = JSON.parse(userStr);
      ['first_name','middle_name','last_name','suffix','avatar','email','role'].forEach(k => {
        if (u[k] !== undefined && u[k] !== null && !payload?.[k]) {
          if (!payload) return; // payload may be null when token invalid
          payload[k] = u[k];
        }
      });
      // also set nested user for compatibility
      if (payload) payload.user = { ...(payload.user||{}), ...u };
    }
  } catch {}
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  // Find the Login link <li>
  let loginLi = null;
  Array.from(navLinks.children).forEach(li => {
    const a = li.querySelector('a[href="/login.html"]');
    if (a && !loginLi) loginLi = li;
  });

  if (!payload) {
    // Not logged in -> keep Login link as-is
    return;
  }

  // Logged in: replace Login with user dropdown
  const name = extractUserName(payload) || 'User';
  const avatar = extractAvatarUrl(payload);
  const role = payload.role || payload.user_role || payload.userRole || '';
  const portalHref = isAdminRole(role) ? '/dashboard.html' : '/dashboard.html';

  const li = document.createElement('li');
  li.className = 'user-menu';
  li.innerHTML = `
    <button class="user-menu-btn" id="userMenuBtn" aria-haspopup="true" aria-expanded="false">
      <span class="avatar">${avatar ? `<img src="${avatar}" alt="Avatar"/>` : nameInitials(name)}</span>
      <span class="user-name">${name}</span>
      <svg class="chev" width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"/></svg>
    </button>
    <div class="user-dropdown" id="userDropdown" role="menu">
      <a class="dropdown-item" data-action="portal" href="${portalHref}">Go to Portal</a>
      <button type="button" class="dropdown-item" data-action="logout">Logout</button>
    </div>`;

  if (loginLi) navLinks.replaceChild(li, loginLi); else navLinks.appendChild(li);

  const btn = li.querySelector('#userMenuBtn');
  const dd = li.querySelector('#userDropdown');
  const open = () => { btn.setAttribute('aria-expanded', 'true'); dd.classList.add('show'); };
  const close = () => { btn.setAttribute('aria-expanded', 'false'); dd.classList.remove('show'); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); dd.classList.toggle('show'); btn.setAttribute('aria-expanded', dd.classList.contains('show') ? 'true' : 'false'); });
  window.addEventListener('click', (e) => { if (!li.contains(e.target)) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  dd.querySelector('[data-action="logout"]').addEventListener('click', (e) => {
    e.preventDefault();
    try {
      document.cookie = 'token=; Max-Age=0; path=/';
    } catch {}
    window.location.href = '/login.html';
  });
  dd.querySelector('[data-action="portal"]').addEventListener('click', () => close());
}

function setupNavbarFeatures() {
  const navbar =
    document.querySelector("header") || document.getElementById("navbar");

  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      navLinks.classList.toggle("active");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("active");
        navLinks.classList.remove("active");
      });
    });

    document.addEventListener("click", (e) => {
      if (!navbar.contains(e.target)) {
        hamburger.classList.remove("active");
        navLinks.classList.remove("active");
      }
    });
  }

  const revealElements = document.querySelectorAll(".reveal-element");

  const revealOnScroll = () => {
    revealElements.forEach((element) => {
      const elementTop = element.getBoundingClientRect().top;
      const elementVisible = 150;

      if (elementTop < window.innerHeight - elementVisible) {
        element.classList.add("revealed");
      }
    });
  };

  const handleScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }

    revealOnScroll();
  };

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
      }
    });
  }, observerOptions);

  document.querySelectorAll(".reveal-element").forEach((el) => {
    observer.observe(el);
  });

  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (navbar) {
      if (window.scrollY > 100) {
        navbar.style.background = "rgba(255, 255, 255, 0.98)";
      } else {
        navbar.style.background = "rgba(255, 255, 255, 0.95)";
      }
    }
  });

  const contactForm = navbar ? navbar.querySelector("form") : null;
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const name = formData.get("name");
      const email = formData.get("email");
      const phone = formData.get("phone");
      const message = formData.get("message");

      if (!name || !email || !message) {
        if (
          typeof window !== "undefined" &&
          typeof window.showAlert === "function"
        ) {
          window.showAlert("Please fill in all required fields.", "warning");
        } else {
          alert("Please fill in all required fields.");
        }
        return;
      }

      const button = this.querySelector("button");
      const originalText = button ? button.textContent : "";
      if (button) {
        button.textContent = "Sending...";
        button.disabled = true;
      }

      setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          typeof window.showAlert === "function"
        ) {
          window.showAlert(
            "Thank you for your inquiry! We will contact you soon.",
            "success"
          );
        } else {
          alert("Thank you for your inquiry! We will contact you soon.");
        }
        this.reset();
        if (button) {
          button.textContent = originalText;
          button.disabled = false;
        }
      }, 2000);
    });
  }

  document.querySelectorAll(".property-card").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-15px) scale(1.02)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0) scale(1)";
    });
  });

  window.addEventListener("scroll", () => {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector(".hero");
    if (parallax) {
      const speed = scrolled * 0.5;
      parallax.style.transform = `translateY(${speed}px)`;
    }
  });
}
