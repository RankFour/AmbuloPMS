(function () {
  
  window.__clientNotifQueue = window.__clientNotifQueue || [];
  function addClientNotification(n) {
    try {
      const item = {
        notification_id: `client_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        title: String(n.title||''),
        body: String(n.body||''),
        type: String(n.type||'INFO').toUpperCase(),
        created_at: n.created_at || new Date().toISOString(),
        is_read: false,
        _client: true,
        link: n.link || null,
      };
      window.__clientNotifQueue.unshift(item);
      return item;
    } catch(_) { return null; }
  }
  function getCookie(name) {
    if (!document || !document.cookie) return null;
    const match = document.cookie.match("(^|;)s*" + name + "s*=s*([^;]+)");
    return match ? match[2] : null;
  }

  
  function confirmOverlay(message, title = "Confirm") {
    return new Promise(function (resolve) {
      try {
        const overlay = document.createElement("div");
        overlay.className = 'modal-overlay';
        overlay.classList.add('active');
        overlay.style.zIndex = 12000;

        const container = document.createElement('div');

  
        container.className = 'modal-container';

        const header = document.createElement('div');
        header.className = 'modal-header';
        const titleEl = document.createElement('div');
        titleEl.className = 'modal-title';
        const titleText = document.createElement('span');
        titleText.className = 'modal-title-text';
        titleText.textContent = String(title || 'Confirm');
        titleEl.appendChild(titleText);
        header.appendChild(titleEl);

        const body = document.createElement('div');
        body.className = 'modal-body';
        body.style.padding = '16px 22px';
        body.textContent = String(message || '');

        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(false);
        };

        const okBtn = document.createElement('button');
        okBtn.className = 'btn-confirm';
        okBtn.textContent = 'OK';
        okBtn.onclick = function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(true);
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(okBtn);
        container.appendChild(header);
        container.appendChild(body);
        container.appendChild(footer);
        overlay.appendChild(container);
        (document.body || document.documentElement).appendChild(overlay);
        setTimeout(function () {
          try {
            okBtn.focus();
          } catch (e) {}
        }, 20);
      } catch (e) {
        try {
          resolve(confirm(String(message)));
        } catch (_) {
          resolve(false);
        }
      }
    });
  }

  function getJwtToken() {
    const token = getCookie("token");
    return token || null;
  }

  function decodeJwtPayload(token) {
    if (!token) return null;
    try {
      var parts = token.split(".");
      if (parts.length < 2) return null;
      var payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (payload.length % 4) payload += "=";
      var json = decodeURIComponent(
        atob(payload)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function ensureScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = Array.from(document.getElementsByTagName("script")).find(
        (s) => s.src && s.src.indexOf(src) !== -1
      );
      if (existing) return resolve(existing);
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = function () {
        resolve(s);
      };
      s.onerror = function (err) {
        reject(err);
      };
      document.head.appendChild(s);
    });
  }

  function ensureStylesheet(href) {
    return new Promise(function (resolve, reject) {
      try {
        var existing = Array.from(document.getElementsByTagName('link')).find(l => l.rel === 'stylesheet' && l.href && l.href.indexOf(href) !== -1);
        if (existing) return resolve(existing);
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        l.onload = function(){ resolve(l); };
        l.onerror = function(err){ reject(err); };
        document.head.appendChild(l);
      } catch (e) { resolve(null); }
    });
  }

  
  function ensureModuleScript(src) {
    return new Promise(function (resolve, reject) {
      try {
        var existing = Array.from(document.getElementsByTagName("script")).find(
          (s) => s.src && s.src.indexOf(src) !== -1
        );
        if (existing) {
          if (
            existing.getAttribute('type') === 'module' &&
            (existing.readyState === 'complete' || existing.readyState === 'loaded' || existing.getAttribute('data-loaded') === '1')
          )
            return resolve();
          existing.addEventListener('load', function () { resolve(); });
          existing.addEventListener('error', function (err) { reject(err); });
          return;
        }
      } catch (e) {
        
      }

      var s = document.createElement("script");
      s.src = src;
      s.type = 'module';
      s.async = false;
      s.onload = function () {
        try { s.setAttribute('data-loaded', '1'); } catch (e) {}
        resolve();
      };
      s.onerror = function (err) {
        reject(err);
      };
      document.head.appendChild(s);
    });
  }

  async function maybeInjectFragment(path, containerId) {
    try {
      if (document.getElementById(containerId)) return;
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return;
      const html = await res.text();

      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;

      const body = document.body || document.getElementsByTagName("body")[0];
      while (wrapper.firstChild) {
        body.insertBefore(wrapper.firstChild, body.firstChild);
      }
    } catch (e) {
      console.warn("Failed to inject fragment", path, e);
    }
  }

  async function initUnifiedNavigation() {
    var token = getJwtToken();
    var payload = decodeJwtPayload(token);

    var role =
      (payload && (payload.role || payload.user_role || payload.userRole)) ||
      null;

    if (role && typeof role === "string") role = role.toUpperCase();

    var target = "tenant";
    if (role && (role === "ADMIN" || role === "MANAGER" || role === "STAFF"))
      target = "admin";

    if (
      document.getElementById("sidebarContainer") ||
      document.getElementById("navbarContainer")
    ) {
      await maybeInjectFragment("/components/sidebar.html", "sidebarContainer");
      try { document.dispatchEvent(new CustomEvent('sidebar:loaded')); } catch (e) {}
      await maybeInjectFragment(
        "/components/top-navbar.html",
        "navbarContainer"
      );
      try { document.dispatchEvent(new CustomEvent('navbar:loaded')); } catch (e) {}
    } else {
      await maybeInjectFragment("/components/top-navbar.html", "navbar");
      try { document.dispatchEvent(new CustomEvent('navbar:loaded')); } catch (e) {}
      await maybeInjectFragment("/components/sidebar.html", "sidebar");
      try { document.dispatchEvent(new CustomEvent('sidebar:loaded')); } catch (e) {}
    }

    
    
    try {
      await ensureScript("/javascript/dialog-modal.js");
      await ensureScript("/javascript/utils/modalHelpers.js");
    } catch (e) {
      console.warn("Modal scripts failed to load; falling back may use in-page confirm", e);
    }

    try {
      await ensureScript("/javascript/navbar.js");
    } catch (e) {
      console.debug("navbar.js not found or failed to load, continuing");
    }

    try {
      if (target === "admin") {
        if (typeof NavigationManager === "undefined") {
          await ensureScript("/javascript/navigationsAdmin.js");
        }
        if (typeof NavigationManager !== "undefined") {
          if (typeof NavigationManager.initializeNavigation === "function") {
            NavigationManager.initializeNavigation();
          } else {
            if (
              typeof NavigationManager === "function" &&
              typeof NavigationManager.initializeNavigation === "undefined"
            ) {
              NavigationManager.prototype &&
                NavigationManager.prototype.init &&
                new NavigationManager();
            }
          }
          return;
        }
      } else {
        if (typeof TenantNavigationManager === "undefined") {
          await ensureScript("/javascript/navigationsTenant.js");
        }
        if (typeof TenantNavigationManager !== "undefined") {
          if (
            typeof TenantNavigationManager.initializeTenantNavigation ===
            "function"
          ) {
            TenantNavigationManager.initializeTenantNavigation();
          } else {
            if (
              typeof TenantNavigationManager === "function" &&
              typeof TenantNavigationManager.initializeTenantNavigation ===
                "undefined"
            ) {
              TenantNavigationManager.prototype &&
                TenantNavigationManager.prototype.init &&
                new TenantNavigationManager();
            }
          }
          try { await startWishlistStatusWatcher('tenant'); } catch(_) {}
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to dynamically load navigation script", e);
    }

    if (
      typeof NavigationManager !== "undefined" &&
      typeof NavigationManager.initializeNavigation === "function"
    )
      NavigationManager.initializeNavigation();
    else if (
      typeof TenantNavigationManager !== "undefined" &&
      typeof TenantNavigationManager.initializeTenantNavigation === "function"
    )
      TenantNavigationManager.initializeTenantNavigation();
    else console.warn("No navigation manager available to initialize");
    try { await startWishlistStatusWatcher(target); } catch(_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUnifiedNavigation);
  } else {
    initUnifiedNavigation();
  }

  
  
  
  async function startWishlistStatusWatcher(role) {
    try {
      if (role && String(role).toLowerCase() !== 'tenant') return; 
      if (window.__wishlistWatcherRunning) return;
      window.__wishlistWatcherRunning = true;

      const API_BASE_URL = "/api/v1/properties";
      const WL_API = "/api/v1/wishlist";
      const getWishlist = () => {
        try { return JSON.parse(localStorage.getItem('wishlist')||'[]'); } catch { return []; }
      };
      const syncWishlistFromServerIfEmpty = async () => {
        try {
          const list = getWishlist();
          if (Array.isArray(list) && list.length) return list;
          const res = await fetch(WL_API, { credentials: 'include' });
          if (!res.ok) return list;
          const data = await res.json();
          const ids = (data && (data.wishlist || data.ids)) || [];
          if (Array.isArray(ids)) {
            localStorage.setItem('wishlist', JSON.stringify(ids));
            try { window.dispatchEvent(new Event('wishlist:updated')); } catch {}
            return ids;
          }
          return list;
        } catch { return getWishlist(); }
      };
      const getStatusMap = () => {
        try { return JSON.parse(localStorage.getItem('wishlistStatusMap')||'{}'); } catch { return {}; }
      };
      const setStatusMap = (m) => {
        try { localStorage.setItem('wishlistStatusMap', JSON.stringify(m||{})); } catch {}
      };
      const fetchStatus = async (id) => {
        try {
          const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`, { credentials: 'include', headers: { 'Accept':'application/json' } });
          if (!res.ok) return null;
          const data = await res.json();
          const p = data && (data.property || data.data || data);
          if (!p) return null;
          return { id: p.property_id || p.id || id, name: p.property_name || p.name || `Property ${id}`, status: String(p.property_status || p.status || '').toLowerCase() };
        } catch(_) { return null; }
      };
      const showToast = (msg) => {
        try {
          let c = document.getElementById('toast-container');
          if (!c) { c = document.createElement('div'); c.id='toast-container'; c.style.position='fixed'; c.style.top='20px'; c.style.right='20px'; c.style.zIndex=10000; c.style.display='flex'; c.style.flexDirection='column'; c.style.gap='10px'; document.body.appendChild(c); }
          const t=document.createElement('div'); t.style.padding='10px 14px'; t.style.borderRadius='10px'; t.style.color='#fff'; t.style.fontWeight='600'; t.style.boxShadow='0 8px 30px rgba(0,0,0,0.12)'; t.style.maxWidth='320px'; t.style.opacity='0'; t.style.transform='translateX(12px)'; t.style.transition='transform 220ms ease, opacity 220ms ease'; t.style.background='linear-gradient(135deg,#1d4ed8,#3b82f6)'; t.textContent=String(msg||''); c.appendChild(t); requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateX(0)'; }); setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(12px)'; setTimeout(()=>{ try{t.remove();}catch{} }, 260); }, 2200);
        } catch {}
      };
      const pushNotification = ({ title, body, link }) => {
        try {
          const badge = document.getElementById('notificationBadge');
          const menu = document.getElementById('notificationMenu');
          if (badge) {
            const cur = parseInt(badge.textContent||'0',10)||0;
            const next = cur+1; badge.textContent=String(next); badge.style.display = 'flex';
          }
          if (menu) {
            addClientNotification({ title, body, type:'INFO', link });
            try {
              const mgr = window.navigationManager || window.tenantNavigationManager;
              if (mgr && typeof mgr.renderNotifications === 'function') {
                const merged = ((mgr._notifCache || []).slice());
                (window.__clientNotifQueue||[]).forEach(q => merged.unshift(q));
                mgr.renderNotifications(merged);
              }
            } catch(_) {}
          }
        } catch(_) {}
      };

      const run = async (isFirst=false) => {
        const ids = (getWishlist()||[]).slice(0, 12); 
        if (!ids.length) return;
        const map = getStatusMap();
        const results = await Promise.all(ids.map(id => fetchStatus(id)));
        let changed = 0;
        results.filter(Boolean).forEach(p => {
          const old = map[String(p.id)];
          const cur = p.status || '';
          if (old == null) {
            map[String(p.id)] = cur; 
            return;
          }
          if (old !== cur) {
            map[String(p.id)] = cur;
            
              const pretty = (s)=> (String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1));
              const title = `Wishlist update: ${p.name}`;
              const body = `Status changed from ${pretty(old)} to ${pretty(cur)}`;
              const link = `/spacesDetails.html?id=${encodeURIComponent(p.id)}`;
              pushNotification({ title, body, link });
              showToast(`${p.name}: ${body}`);
              changed++;
          }
        });
        setStatusMap(map);
        return changed;
      };

      
      
      try { await syncWishlistFromServerIfEmpty(); } catch {}
      await run(true);
      const tick = () => { if (document.visibilityState === 'visible') run(false); };
      window.__wishlistWatcherInterval = setInterval(tick, 60000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(false); });
      try { document.addEventListener('navbar:loaded', ()=> run(false)); } catch(_) {}
    } catch (e) {
      console.debug('wishlist watcher error', e);
    }
  }

  async function setupAdminNavbar() {
    function getCookieLocal(name) {
      if (!document || !document.cookie) return null;
      const match = document.cookie.match(
        "(^|;)\\s*" + name + "\\s*=\\s*([^;]+)"
      );
      return match ? match[2] : null;
    }

    function getJwtTokenLocal() {
      const token = getCookieLocal("token");
      if (!token) {
        try {
          window.location.href = "/login.html";
        } catch (e) {}
      }
      return token;
    }

    function normalizeLocal(obj) {
      if (!obj || typeof obj !== "object") return null;
      const candidate = obj.user || obj.data || obj;
      const name =
        candidate.name ||
        candidate.fullName ||
        ((candidate.first_name || candidate.firstName) &&
        (candidate.last_name || candidate.lastName)
          ? `${candidate.first_name || candidate.firstName} ${
              candidate.last_name || candidate.lastName
            }`
          : null) ||
        candidate.username ||
        candidate.email ||
        null;
      if (!name) return null;
      const initial = name && name[0] ? name[0].toUpperCase() : "";
      const role =
        candidate.role || candidate.userRole || candidate.user_role || "Admin";
      const avatarUrl =
        candidate.avatar ||
        candidate.avatarUrl ||
        candidate.photo ||
        candidate.profile_image ||
        null;
      return { name, initial, role, avatarUrl };
    }

    async function tryFetchLocal(url, extraHeaders = {}) {
      try {
        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json", ...extraHeaders },
        });
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          return normalizeLocal(json);
        } else {
          return null;
        }
      } catch (e) {
        console.warn("Fetch error for", url, e);
        return null;
      }
    }

    function decodeJwtPayloadLocal(token) {
      try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        let payload = parts[1];
        payload = payload.replace(/-/g, "+").replace(/_/g, "/");
        while (payload.length % 4) payload += "=";
        const json = atob(payload);
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    }

    let user = null;
    try {
      const token = getJwtTokenLocal();
      const payload = decodeJwtPayloadLocal(token);
      const userId =
        payload && (payload.user_id || payload.userId || payload.id);
      if (userId) {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        user = await tryFetchLocal(
          `/api/v1/users/${encodeURIComponent(userId)}`,
          headers
        );
      }
    } catch (e) {
      console.warn("JWT decode or user fetch error", e);
    }

    const profileBtn = document.getElementById("profileBtn");
    const profileAvatar = document.getElementById("profileAvatar");
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const viewAllMessagesBtn = document.getElementById("viewAllMessagesBtn");
    const wishlistMenuItem = document.getElementById("wishlistMenuItem");

    if (user) {
      if (profileBtn) {
        if (user.avatarUrl) {
          profileBtn.style.backgroundImage = `url('${user.avatarUrl}')`;
          profileBtn.style.backgroundSize = "cover";
          profileBtn.style.backgroundPosition = "center";
          profileBtn.textContent = "";
        } else {
          profileBtn.style.backgroundImage = "";
          profileBtn.textContent =
            user.initial || (user.name && user.name[0]) || "";
        }
        profileBtn.title = user.name || "";
      }
      if (profileAvatar) {
        if (user.avatarUrl) {
          profileAvatar.style.backgroundImage = `url('${user.avatarUrl}')`;
          profileAvatar.style.backgroundSize = "cover";
          profileAvatar.style.backgroundPosition = "center";
          profileAvatar.textContent = "";
        } else {
          profileAvatar.style.backgroundImage = "";
          profileAvatar.textContent =
            user.initial || (user.name && user.name[0]) || "";
        }
      }
      if (profileName) {
        profileName.textContent = user.name || "";
      }
      if (profileRole) {
        profileRole.textContent = user.role || "";
      }
      if (viewAllMessagesBtn) viewAllMessagesBtn.href = "/messages.html";
      const contactSubmissionsMenuItem = document.getElementById(
        "contactSubmissionsMenuItem"
      );
      if (contactSubmissionsMenuItem)
        contactSubmissionsMenuItem.style.display = "";
      if (wishlistMenuItem) wishlistMenuItem.style.display = "none";
      window.currentAdminUser = user;
    } else {
      if (profileBtn) {
        profileBtn.style.backgroundImage = "";
        profileBtn.textContent = "";
      }
      if (profileAvatar) {
        profileAvatar.style.backgroundImage = "";
        profileAvatar.textContent = "";
      }
      if (profileName) profileName.textContent = "";
      if (profileRole) profileRole.textContent = "";
      if (viewAllMessagesBtn) viewAllMessagesBtn.href = "#";
      const contactSubmissionsMenuItem = document.getElementById(
        "contactSubmissionsMenuItem"
      );
      if (contactSubmissionsMenuItem)
        contactSubmissionsMenuItem.style.display = "none";
      if (wishlistMenuItem) wishlistMenuItem.style.display = "none";
      window.currentAdminUser = null;
    }
  }

  function setupSidebarAdmin(role) {
    const sidebarNav = document.getElementById("sidebarNav");
    if (!sidebarNav) return;

    let links = [];
    if (role === "admin") {
      links = [
        {
          href: "/dashboard.html",
          icon: "fas fa-chart-line",
          text: "Dashboard",
          page: "dashboard",
          tooltip: "Dashboard",
        },
        {
          href: "/messages.html",
          icon: "fa-solid fa-envelope",
          text: "Messages",
          page: "messagesAdmin",
          tooltip: "Messages",
        },
        { section: "Property Management", isSection: true },
        {
          href: "/propertyAdmin.html",
          icon: "fas fa-building",
          text: "Properties",
          page: "propertyAdmin",
          tooltip: "Properties",
        },
        {
          href: "/tenants.html",
          icon: "fas fa-users",
          text: "Tenants",
          page: "tenants",
          tooltip: "Tenants",
        },
        {
          href: "/documents.html",
          icon: "fa-solid fa-folder",
          text: "Documents",
          page: "documents",
          tooltip: "Documents",
        },
        {
          href: "/leaseAdmin.html",
          icon: "fas fa-file-contract",
          text: "Leases",
          page: "leases",
          tooltip: "Lease Management",
        },
        { section: "Operations", isSection: true },
        {
          href: "/maintenance.html",
          icon: "fas fa-tools",
          text: "Maintenance",
          page: "maintenance",
          tooltip: "Maintenance Requests",
        },
        {
          href: "/paymentAdmin.html",
          icon: "fas fa-credit-card",
          text: "Payments",
          page: "payments",
          tooltip: "Payment Management",
        },
        {
          href: "/reports.html",
          icon: "fas fa-chart-bar",
          text: "Reports",
          page: "reports",
          tooltip: "Analytics & Reports",
        },
        { section: "Content Management", isSection: true },
        {
          href: "/contentManagement.html",
          icon: "fa-solid fa-gears",
          text: "Manage Content",
          page: "content",
          tooltip: "Content Management",
        },
      ];
    }

    sidebarNav.innerHTML = links
      .map((link) => {
        if (link.isSection) {
          return `<div class="nav-section"><div class="nav-section-title">${link.section}</div></div>`;
        }
        return `
                <div class="nav-item">
                    <a href="${link.href}" class="nav-link" data-tooltip="${
          link.tooltip || link.text
        }" data-page="${link.page}" title="${link.tooltip || link.text}">
                        <div class="nav-icon"><i class="${link.icon}"></i></div>
                        <span class="nav-text">${link.text}</span>
                    </a>
                </div>
            `;
      })
      .join("");
  }

  
  

  class NavigationManager {
    constructor(config = {}) {
      this.config = {
        sidebarSelector: "#sidebar",
        toggleSelector: "#sidebarToggle",
        overlaySelector: "#overlay",
        topNavbarSelector: ".top-navbar",
        mainContentSelector: ".main-content",
        pageTitleSelector: "#pageTitle",
        searchInputSelector: "#searchInput",
        storageKey: "adminSidebarCollapsed",
        ...config,
      };

      this.isCollapsed = false;
      this.isMobile = window.innerWidth <= 768;
  this.inboxMessages = this.getDefaultInboxMessages();

      this.init();
    }

    init() {
      this.cacheDOMElements();
      this.setupPageTitles();
      this.loadCollapsedState();
      this.bindEvents();
      this.updateLayout();
      this.setActiveNavItem();
  this.populateInbox();
  
  try { this.loadInboxFromServer && this.loadInboxFromServer(); } catch(e) {}
      
      try { this.refreshNotifications && this.refreshNotifications(); } catch(e) { /* noop */ }
      this.addKeyboardShortcuts();
      
      try { this.initRealtimeNotifications && this.initRealtimeNotifications(); } catch(e) {}
      
      try { ensureStylesheet && ensureStylesheet('/css/notifications.css'); } catch(e) {}
    }

    cacheDOMElements() {
      this.sidebar = document.querySelector(this.config.sidebarSelector);
      this.sidebarToggle = document.querySelector(this.config.toggleSelector);
      this.overlay = document.querySelector(this.config.overlaySelector);
      this.topNavbar = document.querySelector(this.config.topNavbarSelector);
      this.mainContent = document.querySelector(
        this.config.mainContentSelector
      );
      this.pageTitle = document.querySelector(this.config.pageTitleSelector);
      this.pageIcon = document.getElementById("pageIcon");
      this.pageDescription = document.getElementById("pageDescription");
      this.searchInput = document.querySelector(
        this.config.searchInputSelector
      );

    this.notificationBtn = document.getElementById("notificationBtn");
    this.notificationMenu = document.getElementById("notificationMenu");
    this.notificationBadge = document.getElementById("notificationBadge");
      this.inboxBtn = document.getElementById("inboxBtn");
      this.inboxDropdown = document.getElementById("inboxDropdown");
      this.profileBtn = document.getElementById("profileBtn");
      this.profileMenu = document.getElementById("profileMenu");
    }

    setupPageTitles() {
      this.pageTitles = {
        "dashboard.html": "Dashboard",
        adminDashboard: "Dashboard",
        "wishlist.html": "My Wishlist",
        wishlist: "My Wishlist",
        "propertyAdmin.html": "Properties",
        propertyAdmin: "Properties",
        "tenants.html": "Tenants",
        tenants: "Tenants",
        "leaseAdmin.html": "Leases",
        leaseAdmin: "Leases",
        "paymentAdmin.html": "Payments",
        paymentAdmin: "Payments",
        "maintenance.html": "Maintenance Requests",
        maintenance: "Maintenance Requests",
        "messages.html": "Messages",
        messagesAdmin: "Messages",
        "documents.html": "Documents",
        documents: "Documents",

        "contentManagement.html": "Manage Content",
        contentManagement: "Manage Content",
        "reports.html": "Reports",
        "company-information": "Manage Content",
        "building-addresses.html": "Manage Content",
        "building-addresses": "Manage Content",
        "FAQs.html": "Manage Content",
        FAQs: "Manage Content",
        "lease-terms-cms.html": "Manage Content",
        "lease-terms-cms": "Manage Content",
        "contact-us-submissions.html": "Contact Submissions",
        "contact-us-submissions": "Contact Submissions",
  "contact-us-archived.html": "Archived Submissions",
        contactUs: "Contact Submissions",
        "account-profile.html": "Account Settings",
        "account-profile": "Account Settings",

        dashboard: "Dashboard",
        propertyAdmin: "Properties",
        tenants: "Tenants",
        leases: "Leases",
        payments: "Payments",
        maintenance: "Maintenance Requests",
        messagesAdmin: "Messages",
        documents: "Documents",
        reports: "Reports",
        content: "Manage Content",

        index: "Dashboard",
        "": "Dashboard",
      };

      this.pageIcons = {
        "dashboard.html": "fas fa-chart-line",
        adminDashboard: "fas fa-chart-line",
        "wishlist.html": "fa-regular fa-heart",
        wishlist: "fa-regular fa-heart",
        "propertyAdmin.html": "fas fa-building",
        propertyAdmin: "fas fa-building",
        "tenants.html": "fas fa-users",
        tenants: "fas fa-users",
        "leaseAdmin.html": "fas fa-file-contract",
        leaseAdmin: "fas fa-file-contract",
        "paymentAdmin.html": "fas fa-credit-card",
        paymentAdmin: "fas fa-credit-card",
        "maintenance.html": "fas fa-tools",
        maintenance: "fas fa-tools",
        "messages.html": "fas fa-envelope",
        messagesAdmin: "fas fa-envelope",
        "documents.html": "fas fa-folder",
        documents: "fas fa-folder",
  "reports.html": "fas fa-chart-bar",
        "contentManagement.html": "fas fa-gears",
        contentManagement: "fas fa-gears",
        "company-information.html": "fas fa-gears",
        "company-information": "fas fa-gears",
        "building-addresses.html": "fas fa-gears",
        "building-addresses": "fas fa-gears",
        "FAQs.html": "fas fa-gears",
        FAQs: "fas fa-gears",
        "lease-terms-cms.html": "fas fa-gears",
        "lease-terms-cms": "fas fa-gears",
        "contact-us-submissions.html": "fas fa-comment-dots",
        "contact-us-submissions": "fas fa-comment-dots",
  "contact-us-archived.html": "fas fa-box-archive",
        contactUs: "fas fa-comment-dots",
        "account-profile.html": "fas fa-user-cog",
        "account-profile": "fas fa-user-cog",

        dashboard: "fas fa-chart-line",
        propertyAdmin: "fas fa-building",
        tenants: "fas fa-users",
        leases: "fas fa-file-contract",
        payments: "fas fa-credit-card",
        maintenance: "fas fa-tools",
        messagesAdmin: "fas fa-envelope",
        documents: "fas fa-folder",
        reports: "fas fa-chart-bar",
        content: "fas fa-gears",
        contactUs: "fas fa-comment-dots",

        index: "fas fa-chart-line",
        "": "fas fa-chart-line",
      };

      this.pageDescriptions = {
        "dashboard.html":
          "Monitor property performance, track key metrics, and oversee daily operations",
        adminDashboard:
          "Monitor property performance, track key metrics, and oversee daily operations",
        "propertyAdmin.html":
          "Manage property listings, view details, and maintain property information",
        propertyAdmin:
          "Manage property listings, view details, and maintain property information",
        "tenants.html":
          "View tenant information, manage accounts, and track tenant activity",
        tenants:
          "View tenant information, manage accounts, and track tenant activity",
        "leaseAdmin.html":
          "Manage lease agreements, renewals, and rental contract details",
        leaseAdmin:
          "Manage lease agreements, renewals, and rental contract details",
        "paymentAdmin.html":
          "Process payments, track collections, and manage financial transactions",
        paymentAdmin:
          "Process payments, track collections, and manage financial transactions",
        "maintenance.html":
          "Oversee maintenance requests, assign work orders, and track service completion",
        maintenance:
          "Oversee maintenance requests, assign work orders, and track service completion",
        "messages.html":
          "Communicate with tenants and manage property-related correspondence",
        messagesAdmin:
          "Communicate with tenants and manage property-related correspondence",
        "documents.html":
          "Manage property documents, leases, and important administrative files",
        documents:
          "Manage property documents, leases, and important administrative files",
        "contentManagement.html":
          "Configure system settings and manage website content",
        contentManagement:
          "Configure system settings and manage website content",
        "company-information.html":
          "Update company details and business information",
        "company-information":
          "Update company details and business information",
        "building-addresses.html":
          "Manage property addresses and location information",
        "building-addresses":
          "Manage property addresses and location information",
        "FAQs.html":
          "Maintain frequently asked questions and help documentation",
        FAQs: "Maintain frequently asked questions and help documentation",
        "lease-terms-cms.html":
          "Configure lease terms and rental agreement templates",
        "lease-terms-cms":
          "Configure lease terms and rental agreement templates",
        "contact-us-submissions.html":
          "View and manage messages submitted via the Contact Us form",
        "contact-us-submissions":
          "View and manage messages submitted via the Contact Us form",
        "contact-us-archived.html":
          "Browse, restore, or permanently delete archived contact submissions",
        contactUs: "View and manage messages submitted via the Contact Us form",
        "account-profile.html":
          "Manage your account details, password, notifications, and verification",
        "account-profile":
          "Manage your account details, password, notifications, and verification",

        dashboard:
          "Monitor property performance, track key metrics, and oversee daily operations",
        propertyAdmin:
          "Manage property listings, view details, and maintain property information",
        tenants:
          "View tenant information, manage accounts, and track tenant activity",
        leases:
          "Manage lease agreements, renewals, and rental contract details",
        payments:
          "Process payments, track collections, and manage financial transactions",
        maintenance:
          "Oversee maintenance requests, assign work orders, and track service completion",
        messagesAdmin:
          "Communicate with tenants and manage property-related correspondence",
        documents:
          "Manage property documents, leases, and important administrative files",
        "reports.html":
          "Generate and analyze property performance and financial reports",
        reports:
          "Generate and analyze property performance and financial reports",
        content: "Configure system settings and manage website content",
        contactUs: "View and manage messages submitted via the Contact Us form",

        index:
          "Monitor property performance, track key metrics, and oversee daily operations",
        "": "Monitor property performance, track key metrics, and oversee daily operations",
      };
    }

    getDefaultInboxMessages() {
      return [
        {
          id: 1,
          sender: "Tenant Support",
          subject: "Urgent: Water Leak in Unit 3B",
          preview:
            "Emergency maintenance request submitted. Tenant reports significant water leak in bathroom. Immediate response required to prevent property damage.",
          time: "15 minutes ago",
          unread: true,
          priority: "high",
        },
        {
          id: 2,
          sender: "Property Inspector",
          subject: "Monthly Inspection Report - Building A",
          preview:
            "Completed monthly safety inspection for Building A. Found minor issues with fire extinguishers on floors 2 and 4. Detailed report attached.",
          time: "2 hours ago",
          unread: true,
          priority: "medium",
        },
        {
          id: 3,
          sender: "Legal Department",
          subject: "Lease Agreement Updates Required",
          preview:
            "New city regulations require updates to standard lease agreements. Please review the attached amendments and implement by next month.",
          time: "1 day ago",
          unread: false,
          priority: "medium",
        },
        {
          id: 4,
          sender: "Accounting",
          subject: "Monthly Financial Summary",
          preview:
            "Revenue collection at 94% for the month. Three units pending payment follow-up. Overall property performance exceeding projections.",
          time: "2 days ago",
          unread: false,
          priority: "low",
        },
        {
          id: 5,
          sender: "Facilities Management",
          subject: "HVAC System Maintenance Scheduled",
          preview:
            "Annual HVAC maintenance scheduled for next week. All units will be notified 48 hours in advance. Expect temporary service interruptions.",
          time: "3 days ago",
          unread: false,
          priority: "medium",
        },
      ];
    }

    
    formatRelativeTime(ts) {
      try {
        const d = ts instanceof Date ? ts : new Date(ts);
        const now = new Date();
        const diffMs = now - d;
        const sec = Math.floor(diffMs / 1000);
        const min = Math.floor(sec / 60);
        const hr = Math.floor(min / 60);
        const day = Math.floor(hr / 24);
        if (sec < 60) return 'just now';
        if (min < 60) return `${min} minute${min!==1?'s':''} ago`;
        if (hr < 24) return `${hr} hour${hr!==1?'s':''} ago`;
        if (day < 7) return `${day} day${day!==1?'s':''} ago`;
        return d.toLocaleDateString();
      } catch { return ''; }
    }

    
    _getCurrentUserId() {
      try {
        const token = (document.cookie.match('(^|;)\\s*token\\s*=\\s*([^;]+)')||[])[2];
        if (!token) return null;
        const part = token.split('.')[1];
        if (!part) return null;
        const payload = JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')));
        return payload && (payload.user_id || payload.userId || payload.id) || null;
      } catch { return null; }
    }

    _mapServerMessageToInboxItem(m, currentUserId) {
      const safe = (s)=> (s==null? '' : String(s));
      const senderName = `${safe(m.sender_first_name||'').trim()} ${safe(m.sender_last_name||'').trim()}`.trim() || 'Message';
      const recipientName = `${safe(m.recipient_first_name||'').trim()} ${safe(m.recipient_last_name||'').trim()}`.trim();
      const isIncoming = String(m.recipient_user_id) === String(currentUserId);
      const otherParty = isIncoming ? senderName : (recipientName || 'Recipient');
      const preview = safe(m.message || '').slice(0, 140);
      return {
        id: m.message_id,
        sender: otherParty,
        
        subject: (safe(m.subject) || safe(m.thread_title) || ''),
        preview,
        time: this.formatRelativeTime(m.created_at),
        unread: isIncoming, 
      };
    }

    _mapConversationToInboxItem(conv) {
      const safe = (s)=> (s==null? '' : String(s));
      return {
        id: `${safe(conv.other_user_id)}`,
        sender: safe(conv.other_user_name || 'Conversation'),
        
        subject: (safe(conv.thread_title) || safe(conv.last_message_subject) || ''),
        preview: safe(conv.last_message || ''),
        time: this.formatRelativeTime(conv.last_message_time),
        unread: false,
      };
    }

    async loadInboxFromServer(limit = 8) {
      try {
        const uid = this._getCurrentUserId();
        if (!uid) return;
        const res = await fetch(`/api/${(window.API_VERSION||'v1')}/messages/conversations/${encodeURIComponent(uid)}?limit=${limit}`, { credentials: 'include' });
        const data = res.ok ? await res.json() : [];
        const list = Array.isArray(data) ? data : (data.conversations || data || []);
        const mapped = (list || []).slice(0, limit).map((c) => this._mapConversationToInboxItem(c));
        this.inboxMessages = mapped;
        this.populateInbox();
        
        const messagesBadge = document.getElementById('messagesBadge');
        if (messagesBadge) {
          const unread = this.inboxMessages.filter(m => m.unread).length;
          messagesBadge.textContent = unread;
          messagesBadge.style.display = unread > 0 ? 'flex' : 'none';
        }
      } catch (e) {
        console.warn('Failed to load inbox conversations', e);
      }
    }

    saveCollapsedState() {
      try {
        if (!this.isMobile) {
          localStorage.setItem(
            this.config.storageKey,
            this.isCollapsed.toString()
          );
        }
      } catch (e) {
        console.warn("localStorage not available");
      }
    }
    loadCollapsedState() {
      try {
        const saved = localStorage.getItem(this.config.storageKey);
        if (saved !== null && !this.isMobile) {
          this.isCollapsed = saved === "true";
          if (this.isCollapsed && this.sidebar) {
            this.sidebar.classList.add("collapsed");
            this.updateToggleIcon();
            this.updateContentLayout();
          }
        }
      } catch (e) {
        console.warn("Could not load sidebar state");
      }
    }
    updateToggleIcon() {
      if (!this.sidebarToggle) return;
      const icon = this.sidebarToggle.querySelector("i");
      if (!icon) return;
      if (this.isMobile) {
        if (this.sidebar.classList.contains("mobile-open")) {
          icon.className = "fas fa-times";
          this.sidebarToggle.title = "Close Menu";
        } else {
          icon.className = "fas fa-bars";
          this.sidebarToggle.title = "Open Menu";
        }
      } else {
        if (this.isCollapsed) {
          icon.className = "fas fa-chevron-right";
          this.sidebarToggle.title = "Expand Sidebar";
        } else {
          icon.className = "fas fa-chevron-left";
          this.sidebarToggle.title = "Collapse Sidebar";
        }
      }
    }
    updateContentLayout() {
      if (!this.isMobile) {
        if (this.topNavbar) {
          this.topNavbar.style.left = this.isCollapsed ? "80px" : "280px";
        }
        if (this.mainContent) {
          this.mainContent.style.marginLeft = this.isCollapsed
            ? "80px"
            : "280px";
          this.mainContent.classList.toggle(
            "sidebar-collapsed",
            this.isCollapsed
          );
        }
      }
    }
    updateLayout() {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth <= 768;
      if (this.isMobile) {
        if (this.sidebar) {
          this.sidebar.classList.remove("collapsed");
          this.sidebar.classList.remove("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.remove("active");
        }
        if (this.topNavbar) {
          this.topNavbar.style.left = "0";
        }
        if (this.mainContent) {
          this.mainContent.style.marginLeft = "0";
          this.mainContent.classList.remove("sidebar-collapsed");
        }
      } else {
        if (this.sidebar) {
          this.sidebar.classList.remove("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.remove("active");
        }
        if (this.isCollapsed && this.sidebar) {
          this.sidebar.classList.add("collapsed");
        }
        this.updateContentLayout();
      }
      this.updateToggleIcon();
    }
    toggleSidebar(e) {
      if (e) e.stopPropagation();
      if (this.isMobile) {
        if (this.sidebar) {
          this.sidebar.classList.toggle("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.toggle("active");
        }
      } else {
        this.isCollapsed = !this.isCollapsed;
        if (this.sidebar) {
          this.sidebar.classList.toggle("collapsed", this.isCollapsed);
        }
        this.updateContentLayout();
        this.saveCollapsedState();
      }
      this.updateToggleIcon();
      this.addToggleEffect();
    }
    addToggleEffect() {
      if (this.sidebarToggle) {
        this.sidebarToggle.classList.add("hover-effect");
        setTimeout(() => {
          this.sidebarToggle.classList.remove("hover-effect");
        }, 300);
      }
    }
    closeMobileSidebar() {
      if (this.isMobile) {
        if (this.sidebar) {
          this.sidebar.classList.remove("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.remove("active");
        }
        this.updateToggleIcon();
      }
    }
    updatePageTitle(page) {
      let pageKey = page;
      let path = window.location.pathname.split("/").pop();
      let fileName = path.toLowerCase();
      if (
        fileName === "contact-us-submissions.html" ||
        pageKey === "contact-us-submissions" ||
        pageKey === "contactUs"
      ) {
        pageKey = "contactUs";
      } else if (!pageKey) {
        pageKey = path.replace(".html", "") || "dashboard";
      }
      let title =
        this.pageTitles[pageKey] ||
        this.pageTitles[pageKey + ".html"] ||
        this.pageTitles[path] ||
        "Dashboard";
      let icon =
        this.pageIcons[pageKey] ||
        this.pageIcons[pageKey + ".html"] ||
        this.pageIcons[path] ||
        "";
      let description =
        this.pageDescriptions[pageKey] ||
        this.pageDescriptions[pageKey + ".html"] ||
        this.pageDescriptions[path] ||
        "";
      if (this.pageTitle) {
        this.pageTitle.textContent = title;
      }
      if (this.pageIcon && icon) {
        this.pageIcon.className = icon;
      }
      if (this.pageDescription && description) {
        this.pageDescription.textContent = description;
      }
    }
    setActiveNavItem(targetPage = null) {
      let currentPage = targetPage;
      if (!currentPage) {
        currentPage = window.location.pathname.split("/").pop();
        if (currentPage.includes(".")) {
          currentPage = currentPage.split(".")[0];
        }
        if (!currentPage || currentPage === "index") {
          currentPage = "dashboard";
        }
      }
      const path = window.location.pathname.split("/").pop().toLowerCase();
      if (
        path === "contact-us-submissions.html" ||
        currentPage === "contact-us-submissions" ||
        currentPage === "contactUs"
      ) {
        this.updatePageTitle("contactUs");
        return;
      }
      if (
        path === "account-profile.html" ||
        currentPage === "account-profile"
      ) {
        this.updatePageTitle("account-profile");
        return;
      }
      const navLinks = document.querySelectorAll(".nav-link");
      navLinks.forEach((link) => link.classList.remove("active"));
      const contentManagementPages = [
        "contentManagement",
        "company-information",
        "building-addresses",
        "FAQs",
        "lease-terms-cms",
      ];
      const isContentPage = contentManagementPages.includes(currentPage);
      navLinks.forEach((link) => {
        const linkPage = link.getAttribute("data-page");
        const linkHref = link.getAttribute("href");
        let linkFileName = "";
        if (linkHref) {
          linkFileName = linkHref.split("/").pop().split(".")[0];
        }
        if (isContentPage && linkPage === "content") {
          link.classList.add("active");
          this.updatePageTitle("content");
          return;
        }
        if (
          linkPage === currentPage ||
          linkFileName === currentPage ||
          (currentPage === "dashboard" && linkPage === "dashboard") ||
          (currentPage === "propertyAdmin" && linkPage === "propertyAdmin") ||
          (currentPage === "index" && linkPage === "dashboard") ||
          (currentPage === "dashboard" &&
            (linkPage === "dashboard" || linkFileName === "dashboard"))
        ) {
          link.classList.add("active");
          const pageKey = linkPage || linkFileName || currentPage;
          this.updatePageTitle(pageKey);
        }
      });
    }
    populateInbox() {
      const inboxContent = document.getElementById("inboxContent");
      const inboxBadge = document.getElementById("inboxBadge");
      const messagesBadge = document.getElementById("messagesBadge");
      if (!inboxContent) return;
      const unreadCount = this.inboxMessages.filter((msg) => msg.unread).length;
      if (inboxBadge) {
        if (unreadCount > 0) {
          inboxBadge.textContent = `${unreadCount} New`;
          if (messagesBadge) {
            messagesBadge.textContent = unreadCount;
            messagesBadge.style.display = "flex";
          }
        } else {
          inboxBadge.textContent = "All Read";
          if (messagesBadge) {
            messagesBadge.style.display = "none";
          }
        }
      }
      if (this.inboxMessages.length === 0) {
        inboxContent.innerHTML = `<div class="empty-inbox"><div class="empty-inbox-icon">📭</div><div class="empty-inbox-text">No messages yet</div><div class="empty-inbox-subtext">You're all caught up!</div></div>`;
      } else {
        inboxContent.innerHTML = this.inboxMessages
          .map(
            (message) => {
              const href = `/messages.html?user=${encodeURIComponent(
                String(message.id || "")
              )}`;
              return `
                <a href="${href}" class="inbox-item ${
                message.unread ? "unread" : ""
              }" data-id="${message.id}" style="color:inherit; text-decoration:none;">
                    <div class="inbox-item-header">
                        <div class="inbox-sender-section">
                            <span class="inbox-sender">${message.sender}</span>
                            ${
                              message.priority
                                ? `<div class="inbox-priority ${message.priority}"></div>`
                                : ""
                            }
                        </div>
                        <span class="inbox-time">${message.time}</span>
                    </div>
              ${message.subject ? `<div class="inbox-subject">${message.subject}</div>` : ""}
              <div class="inbox-preview">${message.preview}</div>
                </a>
            `;
            }
          )
          .join("");
      }
    }

    async initRealtimeNotifications() {
      try {
        if (typeof io === 'undefined') {
          await ensureScript('/socket.io/socket.io.js');
        }
        if (typeof io === 'undefined') return; 
        const token = getJwtToken();
        if (!token) return;
        if (!window.__ambuloSocket) {
          window.__ambuloSocket = io({ auth: { token } });
        }
        const s = window.__ambuloSocket;
        if (!s.__notifListenerAttached) {
          
          try {
            const sendSubs = () => {
              try {
                const ids = JSON.parse(localStorage.getItem('wishlist')||'[]');
                if (Array.isArray(ids) && ids.length) {
                  s.emit('wishlist_subscribe', { ids });
                }
              } catch(_) {}
            };
            s.on('connect', sendSubs);
            
            window.addEventListener('wishlist:updated', sendSubs);
            window.addEventListener('storage', (e) => { if (e && e.key === 'wishlist') sendSubs(); });
            
            sendSubs();
          } catch(_) {}
          s.on('notification', (payload) => {
            try {
              const type = String(
                (payload && (payload.type || payload.notification_type)) ||
                (payload && payload.notification && payload.notification.type) ||
                ''
              ).toUpperCase();
              
              if (type === 'MESSAGE') {
                return; 
              }
            } catch(_) {}
            
            try { this.refreshNotifications && this.refreshNotifications(); } catch(_) {}
          });

          
          s.on('property_status_changed', (p) => {
            try {
              const getWishlist = () => { try { return JSON.parse(localStorage.getItem('wishlist')||'[]'); } catch { return []; } };
              const ids = getWishlist().map(String);
              const pid = String((p && (p.property_id || p.id)) || '');
              if (!pid || !ids.includes(pid)) return; 

              const name = (p && (p.property_name || p.name)) || `Property ${pid}`;
              const oldS = String((p && p.old_status) || '').toLowerCase();
              const newS = String((p && p.new_status) || '').toLowerCase();
              const pretty = (s)=> (String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1));
              const title = `Wishlist update: ${name}`;
              const body = oldS && newS ? `Status changed from ${pretty(oldS)} to ${pretty(newS)}` : `Status updated to ${pretty(newS||oldS)}`;
              const link = `/spacesDetails.html?id=${encodeURIComponent(pid)}`;

              
              try {
                const badge = document.getElementById('notificationBadge');
                if (badge) { const cur = parseInt(badge.textContent||'0',10)||0; const next = cur+1; badge.textContent=String(next); badge.style.display='flex'; }
                const menu = document.getElementById('notificationMenu');
                if (menu) {
                  const item = document.createElement('div');
                  item.className = 'notification-item unread';
                  item.style.cursor = 'pointer';
                  item.innerHTML = `
                    <div class="notification-title">${title}</div>
                    ${body ? `<div class="notification-body">${body}</div>` : ''}
                    <div class="notification-meta"><span class="notification-type type-info">INFO</span><span class="notification-time">just now</span></div>
                  `;
                  item.addEventListener('click', ()=>{ try { if (link) window.location.href = link; } catch(_) {} });
                  const list = menu.querySelector('.notification-list');
                  if (list) list.prepend(item); else menu.prepend(item);
                }
              } catch(_) {}

              
              try {
                let c = document.getElementById('toast-container');
                if (!c) { c = document.createElement('div'); c.id='toast-container'; c.style.position='fixed'; c.style.top='20px'; c.style.right='20px'; c.style.zIndex=10000; c.style.display='flex'; c.style.flexDirection='column'; c.style.gap='10px'; document.body.appendChild(c); }
                const t=document.createElement('div'); t.style.padding='10px 14px'; t.style.borderRadius='10px'; t.style.color='#fff'; t.style.fontWeight='600'; t.style.boxShadow='0 8px 30px rgba(0,0,0,0.12)'; t.style.maxWidth='320px'; t.style.opacity='0'; t.style.transform='translateX(12px)'; t.style.transition='transform 220ms ease, opacity 220ms ease'; t.style.background='linear-gradient(135deg,#10b981,#059669)'; t.textContent=`${name}: ${body}`; c.appendChild(t); requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateX(0)'; }); setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(12px)'; setTimeout(()=>{ try{t.remove();}catch{} }, 260); }, 2200);
              } catch {}
            } catch (e) { /* ignore */ }
          });
          
          s.on && s.on('new_message', (msg) => {
            try {
              const messagesBadge = document.getElementById('messagesBadge');
              if (messagesBadge) {
                const current = parseInt(messagesBadge.textContent || '0', 10) || 0;
                messagesBadge.textContent = String(current + 1);
                messagesBadge.style.display = 'flex';
              }
              const inboxContent = document.getElementById('inboxContent');
              if (inboxContent && msg) {
                const safe = (v) => (v == null ? '' : String(v));
                const href = `/messages.html?user=${encodeURIComponent(String(msg.other_user_id || msg.sender_id || msg.sender || ''))}`;
                const html = `
                  <a href="${href}" class="inbox-item unread" style="color:inherit; text-decoration:none;">
                    <div class="inbox-item-header">
                      <div class="inbox-sender-section">
                        <span class="inbox-sender">${safe(msg.sender_name || msg.sender || 'Message')}</span>
                      </div>
                      <span class="inbox-time">just now</span>
                    </div>
                    <div class="inbox-subject">${safe(msg.subject || msg.thread_title || 'New message')}</div>
                    <div class="inbox-preview">${safe(msg.text || msg.body || msg.content || '')}</div>
                  </a>`;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html.trim();
                const el = wrapper.firstChild;
                inboxContent.prepend(el);
              }
            } catch (e) {}
          });
          s.__notifListenerAttached = true;
        }
      } catch (e) {
        console.debug('realtime notifications setup failed', e);
      }
    }

    _ensureNotifFilter() {
      if (!this._notifFilter) this._notifFilter = { unreadOnly: false, types: [] };
      return this._notifFilter;
    }

    _applyTypeFilter(list = []) {
      const filter = this._ensureNotifFilter();
      const types = Array.isArray(filter.types) ? filter.types : [];
      if (!types.length) return list;
      const set = new Set(types.map(t => String(t).toUpperCase()));
      return (list || []).filter(n => set.has(String(n.type || 'INFO').toUpperCase()));
    }

    _resolveNotificationUrl(n = {}) {
      try {
        if (!n || typeof n !== 'object') return null;
        const direct = n.link && String(n.link).trim();
        if (direct) return direct;
        const type = String(n.type || 'INFO').toUpperCase();
        const typeMap = {
          PAYMENT: '/paymentAdmin.html',
          TICKET: '/maintenance.html',
          INQUIRY: '/contact-us-submissions.html',
          MESSAGE: '/messages.html',
          LEASE: '/leaseAdmin.html',
          INFO: null,
        };
        let url = typeMap[type] || null;
        if (!url) return null;
        const params = new URLSearchParams();
        const m = n.meta || {};
        if (m.payment_id) params.set('payment_id', m.payment_id);
        if (m.submission_id) params.set('submission_id', m.submission_id);
        if (m.ticket_id) params.set('ticket_id', m.ticket_id);
        if ([...params.keys()].length) {
          url += (url.includes('?') ? '&' : '?') + params.toString();
        }
        return url;
      } catch (_) { return null; }
    }

    async fetchNotifications({ unreadOnly = false } = {}) {
      try {
        const res = await fetch(`/api/${(window.API_VERSION||'v1')}/notifications?unreadOnly=${unreadOnly}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load notifications');
        const data = await res.json();
        return data;
      } catch (e) {
        console.warn('notifications fetch error', e);
        return { notifications: [], pagination: { total: 0 } };
      }
    }

    renderNotifications(list = []) {
      const menu = this.notificationMenu;
      if (!menu) return;
      const filter = this._ensureNotifFilter();
      
      const clientList = Array.isArray(window.__clientNotifQueue) ? window.__clientNotifQueue.slice() : [];
      let combined = ([]).concat(clientList, list || []);
  const chips = ['INQUIRY','PAYMENT','TICKET','LEASE','INFO'];
      const headerHtml = `
        <div class="dropdown-header" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
          <span>Notifications</span>
          <div style="display:flex; gap:.5rem;">
            <button type="button" id="notifFilterAll" class="btn btn-link" style="padding:.25rem .5rem; ${!filter.unreadOnly ? 'font-weight:600; text-decoration:underline;' : ''}">All</button>
            <button type="button" id="notifFilterUnread" class="btn btn-link" style="padding:.25rem .5rem; ${filter.unreadOnly ? 'font-weight:600; text-decoration:underline;' : ''}">Unread</button>
          </div>
        </div>
        <div class="notif-filters" style="display:flex; gap:.375rem; flex-wrap:wrap; padding:8px 12px; border-bottom:1px solid var(--notif-border);">
          ${chips.map(t => {
            const selected = (filter.types||[]).map(x=>String(x).toUpperCase()).includes(t);
            return `<button type="button" class="chip ${selected ? 'selected' : ''} chip-${t.toLowerCase()}" data-type="${t}">${t}</button>`;
          }).join('')}
        </div>`;
      if (!Array.isArray(combined) || combined.length === 0) {
        menu.innerHTML = `${headerHtml}<div class="dropdown-item empty">No notifications</div>`;
        if (this.notificationBadge) {
          this.notificationBadge.textContent = '0';
          this.notificationBadge.style.display = 'none';
        }
        return;
      }
      combined = this._applyTypeFilter ? this._applyTypeFilter(combined) : combined;
      const unreadCount = combined.filter(n => !n.is_read && String(n.type).toUpperCase() !== 'MESSAGE').length;
    if (this.notificationBadge) {
      this.notificationBadge.textContent = String(unreadCount);
      this.notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
      menu.innerHTML = `
        ${headerHtml}
        <div class="notification-list">
          ${combined.map(n => `
            <div class="notification-item ${n.is_read || String(n.type).toUpperCase()==='MESSAGE' ? '' : 'unread'}" data-id="${n.notification_id}">
              <div class="notification-title">${(n.title||'').toString()}</div>
              ${n.body ? `<div class="notification-body">${(n.body||'').toString()}</div>` : ''}
              <div class="notification-meta">
                <span class="notification-type type-${(n.type||'INFO').toLowerCase()}">${(n.type||'INFO')}</span>
                <span class="notification-time">${new Date(n.created_at).toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="dropdown-footer"><button id="markAllNotificationsRead" class="btn btn-link">Mark all as read</button></div>
      `;
      const btnAll = menu.querySelector('#notifFilterAll');
      const btnUnread = menu.querySelector('#notifFilterUnread');
      if (btnAll) btnAll.addEventListener('click', async (e) => {
        e.stopPropagation();
        this._notifFilter.unreadOnly = false;
        const { notifications } = await this.fetchNotifications({ unreadOnly: false });
        this._notifCache = notifications || [];
        this.renderNotifications(this._applyTypeFilter(this._notifCache));
      });
      if (btnUnread) btnUnread.addEventListener('click', async (e) => {
        e.stopPropagation();
        this._notifFilter.unreadOnly = true;
        const { notifications } = await this.fetchNotifications({ unreadOnly: true });
        this._notifCache = notifications || [];
        this.renderNotifications(this._applyTypeFilter(this._notifCache));
      });
      
      menu.querySelectorAll('.notif-filters .chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const t = String(chip.getAttribute('data-type') || '').toUpperCase();
          if (!this._notifFilter.types) this._notifFilter.types = [];
          const idx = this._notifFilter.types.findIndex(x => String(x).toUpperCase() === t);
          if (idx >= 0) this._notifFilter.types.splice(idx, 1); else this._notifFilter.types.push(t);
          
          const list = this._applyTypeFilter(this._notifCache || []);
          this.renderNotifications(list);
        });
      });
      menu.querySelectorAll('.notification-item').forEach(el => {
        el.addEventListener('click', async () => {
          const id = el.getAttribute('data-id');
          const notif = (window.__clientNotifQueue || []).find(x => String(x.notification_id) === String(id)) || (this._notifCache || []).find(x => String(x.notification_id) === String(id));
          const targetUrl = this._resolveNotificationUrl ? this._resolveNotificationUrl(notif || {}) : null;
          try {
            const notifType = (notif && notif.type) ? String(notif.type).toUpperCase() : '';
            if (notif && notif._client) {
              try { el.classList.remove('unread'); } catch(_) {}
              window.__clientNotifQueue = (window.__clientNotifQueue || []).filter(x => String(x.notification_id) !== String(id));
              if (this.notificationBadge) {
                const current = parseInt(this.notificationBadge.textContent||'0', 10) || 0;
                const next = Math.max(0, current - 1);
                this.notificationBadge.textContent = String(next);
                this.notificationBadge.style.display = next > 0 ? 'flex' : 'none';
              }
            } else if (notifType !== 'MESSAGE') {
              await fetch(`/api/${(window.API_VERSION||'v1')}/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' });
              el.classList.remove('unread');
              if (this.notificationBadge) {
                const current = parseInt(this.notificationBadge.textContent||'0', 10) || 0;
                this.notificationBadge.textContent = String(Math.max(0, current - 1));
              }
            } else {
              try { el.classList.remove('unread'); } catch(_) {}
            }
          } catch {}
          if (targetUrl) {
            try { window.location.href = targetUrl; } catch (_) {}
          }
        });
      });
      const markAll = menu.querySelector('#markAllNotificationsRead');
      if (markAll) {
        markAll.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await fetch(`/api/${(window.API_VERSION||'v1')}/notifications/read-all`, { method: 'PATCH', credentials: 'include' });
            
            menu.querySelectorAll('.notification-item.unread').forEach(el => el.classList.remove('unread'));
            if (this.notificationBadge) { this.notificationBadge.textContent = '0'; this.notificationBadge.style.display = 'none'; }
          } catch {}
        });
      }
    }

    async refreshNotifications() {
      const filter = this._ensureNotifFilter();
      const { notifications } = await this.fetchNotifications({ unreadOnly: !!filter.unreadOnly });
      
      this._notifCache = (notifications || []).filter(n => String(n.type || '').toUpperCase() !== 'MESSAGE');
      this.renderNotifications(this._applyTypeFilter(this._notifCache));
    }
    openMessage(messageId) {
      const message = this.inboxMessages.find((msg) => msg.id === messageId);
      if (message && message.unread) {
        message.unread = false;
        this.populateInbox();
      }
    }
    toggleDropdown(menu, button) {
      if (!menu) return;
      document
        .querySelectorAll(".dropdown-menu, .inbox-dropdown-menu")
        .forEach((dropdown) => {
          if (dropdown !== menu) {
            dropdown.classList.remove("show", "active");
          }
        });
      if (menu.classList.contains("inbox-dropdown-menu")) {
        menu.classList.toggle("active");
      } else {
        menu.classList.toggle("show");
      }
    }
    closeAllDropdowns() {
      document
        .querySelectorAll(".dropdown-menu, .inbox-dropdown-menu")
        .forEach((dropdown) => {
          dropdown.classList.remove("show", "active");
        });
    }
    openProfileSettings() {
      this.closeAllDropdowns();
    }
    openAccountSettings() {
      this.closeAllDropdowns();
    }
    openPreferences() {
      this.closeAllDropdowns();
    }
    openHelp() {
      this.closeAllDropdowns();
    }
    async logout() {
      this.closeAllDropdowns();
      const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
        ? ((msg, title) => window.showConfirm(msg, title))
        : (msg => confirmOverlay(String(msg), 'Sign out'));
      const ok = !!(await confirmFn("Are you sure you want to sign out?", 'Sign out'));
      if (!ok) return;
      localStorage.clear();
      sessionStorage.clear();
      fetch("/api/v1/users/logout", {
        method: "POST",
        credentials: "include",
      }).finally(() => {
        window.location.href = "/login.html";
      });
    }
    bindEvents() {
      if (this.sidebarToggle) {
        this.sidebarToggle.addEventListener("click", (e) =>
          this.toggleSidebar(e)
        );
      }
      if (this.overlay) {
        this.overlay.addEventListener("click", () => this.closeMobileSidebar());
      }
      if (this.notificationBtn && this.notificationMenu) {
          this.notificationBtn.addEventListener("click", (e) => {
          e.stopPropagation();
            this.refreshNotifications();
          this.toggleDropdown(this.notificationMenu, this.notificationBtn);
        });
      }
      if (!this._notifDelegated) {
        this._notifDelegated = function delegatedNotifHandler(e) {
          try {
            const btn = e.target.closest && e.target.closest('#notificationBtn');
            if (!btn) return;
            e.stopPropagation();
            try { (this.refreshNotifications && this.refreshNotifications()); } catch(_) {}
            const menu = document.getElementById('notificationMenu');
            if (menu) {
              this.toggleDropdown(menu, btn);
            }
          } catch (err) {
            
          }
        }.bind(this);
        document.addEventListener('click', this._notifDelegated);
      }
      if (this.inboxBtn && this.inboxDropdown) {
        this.inboxBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try { await (this.loadInboxFromServer && this.loadInboxFromServer()); } catch(_) {}
          this.toggleDropdown(this.inboxDropdown, this.inboxBtn);
        });
      }
      if (this.profileBtn && this.profileMenu) {
        this.profileBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleDropdown(this.profileMenu, this.profileBtn);
        });
      }
      document.addEventListener("click", (e) => {
        if (
          !e.target.closest(".dropdown") &&
          !e.target.closest(".inbox-dropdown")
        ) {
          this.closeAllDropdowns();
        }
      });
      document
        .querySelectorAll(".dropdown-menu, .inbox-dropdown-menu")
        .forEach((menu) => {
          menu.addEventListener("click", (e) => e.stopPropagation());
        });
      document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", (e) => {
          if (link.getAttribute("href") === "#") {
            e.preventDefault();
          }
          document
            .querySelectorAll(".nav-link")
            .forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
          const page =
            link.dataset.page ||
            link.getAttribute("href").split("/").pop().split(".")[0];
          this.updatePageTitle(page);
          this.closeMobileSidebar();
        });
      });
      window.addEventListener("popstate", () => this.setActiveNavItem());
      window.addEventListener("resize", () => this.updateLayout());
      setTimeout(() => {
        document
          .querySelectorAll("#notificationMenu .dropdown-item")
          .forEach((item) => {
            item.addEventListener("click", () => {
              const titleElement = item.querySelector(".dropdown-item-title");
              item.style.opacity = "0.7";
              const badge = document.getElementById("notificationBadge");
              if (badge) {
                let count = parseInt(badge.textContent);
                if (count > 0) {
                  count--;
                  badge.textContent = count;
                  if (count === 0) {
                    badge.style.display = "none";
                    const subtitle = document.querySelector(
                      "#notificationMenu .dropdown-subtitle"
                    );
                    if (subtitle) {
                      subtitle.textContent = "No unread notifications";
                    }
                  }
                }
              }
            });
          });
      }, 100);
    }
    async fetchNotifications({ unreadOnly = false } = {}) {
      try {
        const res = await fetch(`/api/${(window.API_VERSION||'v1')}/notifications?unreadOnly=${unreadOnly}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load notifications');
        const data = await res.json();
        return data;
      } catch (e) {
        console.warn('tenant notifications fetch error', e);
        return { notifications: [], pagination: { total: 0 } };
      }
    }
    renderNotifications(list = []) {
      const menu = this.notificationMenu;
      if (!menu) return;
      const filter = this._ensureNotifFilter ? this._ensureNotifFilter() : { unreadOnly: false };
      
      const clientList = Array.isArray(window.__clientNotifQueue) ? window.__clientNotifQueue.slice() : [];
      let combined = ([]).concat(clientList, list || []);
      const filtered = (combined || []).filter(n => String(n.type || '').toUpperCase() !== 'MESSAGE');
      const headerHtml = `
        <div class="dropdown-header" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
          <span>Notifications</span>
          <div style="display:flex; gap:.5rem;">
            <button type="button" id="notifFilterAll" class="btn btn-link" style="padding:.25rem .5rem; ${!filter.unreadOnly ? 'font-weight:600; text-decoration:underline;' : ''}">All</button>
            <button type="button" id="notifFilterUnread" class="btn btn-link" style="padding:.25rem .5rem; ${filter.unreadOnly ? 'font-weight:600; text-decoration:underline;' : ''}">Unread</button>
          </div>
        </div>`;
      if (!Array.isArray(filtered) || filtered.length === 0) {
        menu.innerHTML = `${headerHtml}<div class="dropdown-item empty">No notifications</div>`;
        if (this.notificationBadge) {
          this.notificationBadge.textContent = '0';
          this.notificationBadge.style.display = 'none';
        }
            return `<button type=\"button\" class=\"chip ${selected ? 'selected' : ''} chip-${t.toLowerCase()}\" data-type=\"${t}\">${t}</button>`;
      }
      const unreadCount = filtered.filter(n => !n.is_read).length;
      if (this.notificationBadge) {
        this.notificationBadge.textContent = String(unreadCount);
        this.notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
      }
      menu.innerHTML = `
        ${headerHtml}
        <div class="notification-list">
          ${filtered.map(n => `
            <div class="notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.notification_id}">
              <div class="notification-title">${(n.title||'').toString()}</div>
              ${n.body ? `<div class="notification-body">${(n.body||'').toString()}</div>` : ''}
              <div class="notification-meta">
                <span class="notification-type type-${(n.type||'INFO').toLowerCase()}">${(n.type||'INFO')}</span>
                <span class="notification-time">${new Date(n.created_at).toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="dropdown-footer"><button id="markAllNotificationsRead" class="btn btn-link">Mark all as read</button></div>
      `;
      const btnAll = menu.querySelector('#notifFilterAll');
      const btnUnread = menu.querySelector('#notifFilterUnread');
      if (btnAll) btnAll.addEventListener('click', async (e) => {
        e.stopPropagation();
        this._notifFilter.unreadOnly = false;
        const { notifications } = await this.fetchNotifications({ unreadOnly: false });
        this.renderNotifications((notifications || []).filter(n => String(n.type||'').toUpperCase() !== 'MESSAGE'));
      });
      if (btnUnread) btnUnread.addEventListener('click', async (e) => {
        e.stopPropagation();
        this._notifFilter.unreadOnly = true;
        const { notifications } = await this.fetchNotifications({ unreadOnly: true });
        this.renderNotifications((notifications || []).filter(n => String(n.type||'').toUpperCase() !== 'MESSAGE'));
      });
      menu.querySelectorAll('.notification-item').forEach(el => {
        el.addEventListener('click', async () => {
          const id = el.getAttribute('data-id');
          const notif = (window.__clientNotifQueue || []).find(x => String(x.notification_id) === String(id)) || (this._notifCache || []).find(x => String(x.notification_id) === String(id));
          const targetUrl = this._resolveNotificationUrl ? this._resolveNotificationUrl(notif || {}) : null;
          try {
            if (notif && notif._client) {
              try { el.classList.remove('unread'); } catch(_) {}
              window.__clientNotifQueue = (window.__clientNotifQueue || []).filter(x => String(x.notification_id) !== String(id));
              if (this.notificationBadge) {
                const current = parseInt(this.notificationBadge.textContent||'0', 10) || 0;
                const next = Math.max(0, current - 1);
                this.notificationBadge.textContent = String(next);
                this.notificationBadge.style.display = next > 0 ? 'flex' : 'none';
              }
            } else {
              await fetch(`/api/${(window.API_VERSION||'v1')}/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' });
              el.classList.remove('unread');
              if (this.notificationBadge) {
                const current = parseInt(this.notificationBadge.textContent||'0', 10) || 0;
                const next = Math.max(0, current - 1);
                this.notificationBadge.textContent = String(next);
                this.notificationBadge.style.display = next > 0 ? 'flex' : 'none';
              }
            }
          } catch {}
          if (targetUrl) {
            try { window.location.href = targetUrl; } catch (_) {}
          }
        });
      });
      const markAll = menu.querySelector('#markAllNotificationsRead');
      if (markAll) {
        markAll.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await fetch(`/api/${(window.API_VERSION||'v1')}/notifications/read-all`, { method: 'PATCH', credentials: 'include' });
            menu.querySelectorAll('.notification-item.unread').forEach(el => el.classList.remove('unread'));
            if (this.notificationBadge) {
              this.notificationBadge.textContent = '0';
              this.notificationBadge.style.display = 'none';
            }
          } catch {}
        });
      }
    }
    async refreshNotifications() {
      const filter = this._ensureNotifFilter ? this._ensureNotifFilter() : { unreadOnly: false };
      const { notifications } = await this.fetchNotifications({ unreadOnly: !!filter.unreadOnly });
      const serverList = (notifications || []).filter(n => String(n.type||'').toUpperCase() !== 'MESSAGE');
      const combined = ([]).concat((window.__clientNotifQueue||[]), serverList);
      this.renderNotifications(combined);
    }
    addKeyboardShortcuts() {
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "b") {
          e.preventDefault();
          this.toggleSidebar();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          if (this.searchInput) this.searchInput.focus();
        }
        if (e.key === "Escape") {
          this.closeAllDropdowns();
        }
      });
    }
    static async loadComponent(componentPath, containerId) {
      try {
        const response = await fetch(componentPath);
        const html = await response.text();
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
          return true;
        }
        return false;
      } catch (error) {
        console.error(`Error loading component from ${componentPath}:`, error);
        return false;
      }
    }
    static async initializeNavigation(config = {}) {
      const sidebarLoaded = await NavigationManager.loadComponent(
        "/components/sidebar.html",
        "sidebarContainer"
      );
      const navbarLoaded = await NavigationManager.loadComponent(
        "/components/top-navbar.html",
        "navbarContainer"
      );
      if (sidebarLoaded || navbarLoaded) {
        let isCollapsed = false;
        try {
          const saved = localStorage.getItem("adminSidebarCollapsed");
          if (saved !== null) {
            isCollapsed = saved === "true";
          }
        } catch (e) {}
        const sidebar = document.querySelector("#sidebar");
        if (sidebar && isCollapsed) {
          sidebar.classList.add("collapsed");
        }
        setTimeout(() => {
          window.navigationManager = new NavigationManager(config);
          setupAdminNavbar();
          setupSidebarAdmin("admin");
          window.navigationManager.setActiveNavItem();
          const mobileSidebarOpenBtn = document.getElementById(
            "mobileSidebarOpenBtn"
          );
          const sidebar = document.getElementById("sidebar");
          const overlay = document.getElementById("overlay");
          if (mobileSidebarOpenBtn && sidebar && overlay) {
            mobileSidebarOpenBtn.addEventListener("click", function () {
              sidebar.classList.add("mobile-open");
              overlay.classList.add("active");
            });
          }
        }, 10);
      } else {
        window.navigationManager = new NavigationManager(config);
      }
    }
    updateNavigation(updates) {
      if (updates.currentPage) {
        this.setActiveNavItem(updates.currentPage);
      }
      if (updates.pageTitle) {
        this.updatePageTitle(updates.pageTitle);
      }
      if (updates.messages) {
        this.inboxMessages = updates.messages;
        this.populateInbox();
      }
    }
    addNavItem(item) {
      const navContainer = document.querySelector(".sidebar-nav");
      if (!navContainer) return;
      const navItem = document.createElement("div");
      navItem.className = "nav-item";
      navItem.innerHTML = `
            <a href="${item.href || "#"}" class="nav-link" data-tooltip="${
        item.tooltip || item.text
      }" data-page="${item.page || ""}" title="${item.tooltip || item.text}">
                <div class="nav-icon"><i class="${
                  item.icon || "fas fa-circle"
                }"></i></div>
                <span class="nav-text">${item.text}</span>
            </a>
        `;
      if (item.section) {
        const section = navContainer.querySelector(
          `[data-section="${item.section}"]`
        );
        if (section) {
          section.parentNode.insertBefore(navItem, section.nextSibling);
        } else {
          navContainer.appendChild(navItem);
        }
      } else {
        navContainer.appendChild(navItem);
      }
      const link = navItem.querySelector(".nav-link");
      link.addEventListener("click", (e) => {
        if (link.getAttribute("href") === "#") {
          e.preventDefault();
        }
        document
          .querySelectorAll(".nav-link")
          .forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        const page =
          link.dataset.page ||
          link.getAttribute("href").split("/").pop().split(".")[0];
        this.updatePageTitle(page);
        this.closeMobileSidebar();
      });
    }
    removeNavItem(selector) {
      const item = document.querySelector(selector);
      if (item && item.closest(".nav-item")) {
        item.closest(".nav-item").remove();
      }
    }
    toggleNavVisibility(selector, show) {
      const element = document.querySelector(selector);
      if (element) {
        element.style.display = show ? "" : "none";
      }
    }
    setNavigationTheme(theme) {
      const root = document.documentElement;
      if (theme.colors) {
        Object.entries(theme.colors).forEach(([key, value]) => {
          root.style.setProperty(`--${key}`, value);
        });
      }
      if (theme.sidebarWidth) {
        root.style.setProperty("--sidebar-width", theme.sidebarWidth);
      }
      if (theme.collapsedWidth) {
        root.style.setProperty(
          "--sidebar-collapsed-width",
          theme.collapsedWidth
        );
      }
    }
    getNavigationState() {
      return {
        isCollapsed: this.isCollapsed,
        isMobile: this.isMobile,
        currentPage: this.getCurrentPage(),
        unreadMessages: this.inboxMessages.filter((msg) => msg.unread).length,
      };
    }
    getCurrentPage() {
      const activeLink = document.querySelector(".nav-link.active");
      return activeLink ? activeLink.dataset.page : null;
    }
    destroy() {
      if (this.sidebarToggle) {
        this.sidebarToggle.removeEventListener("click", this.toggleSidebar);
      }
      window.removeEventListener("resize", this.updateLayout);
      window.removeEventListener("popstate", this.setActiveNavItem);
      Object.keys(this).forEach((key) => {
        if (this[key] instanceof HTMLElement) {
          this[key] = null;
        }
      });
    }
  }

  async function setupTenantNavbar() {
    function getCookieLocal(name) {
      if (!document || !document.cookie) return null;
      const match = document.cookie.match(
        "(^|;)\\s*" + name + "\\s*=\\s*([^;]+)"
      );
      return match ? match[2] : null;
    }
    function getJwtTokenLocal() {
      const token = getCookieLocal("token");
      if (!token) {
        try {
          window.location.href = "/login.html";
        } catch (e) {}
      }
      return token;
    }
    function normalizeLocal(obj) {
      if (!obj || typeof obj !== "object") return null;
      const candidate = obj.user || obj.data || obj;
      const name =
        candidate.name ||
        candidate.fullName ||
        ((candidate.first_name || candidate.firstName) &&
        (candidate.last_name || candidate.lastName)
          ? `${candidate.first_name || candidate.firstName} ${
              candidate.last_name || candidate.lastName
            }`
          : null) ||
        candidate.username ||
        candidate.email ||
        null;
      if (!name) return null;
      const initial = name && name[0] ? name[0].toUpperCase() : "";
      const role =
        candidate.role || candidate.userRole || candidate.user_role || "Tenant";
      const unit =
        candidate.unit ||
        candidate.unitNumber ||
        candidate.apartment ||
        candidate.user_unit ||
        "";
      const avatarUrl =
        candidate.avatar ||
        candidate.avatarUrl ||
        candidate.photo ||
        candidate.profile_image ||
        null;
      return { name, initial, role, unit, avatarUrl };
    }
    async function tryFetchLocal(url, extraHeaders = {}) {
      try {
        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json", ...extraHeaders },
        });
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          return normalizeLocal(json);
        } else {
          return null;
        }
      } catch (e) {
        console.warn("Fetch error for", url, e);
        return null;
      }
    }

    let user = null;
    try {
      const token = getJwtTokenLocal();
      const payload = (function decode(token) {
        try {
          const parts = token.split(".");
          if (parts.length < 2) return null;
          let payload = parts[1];
          payload = payload.replace(/-/g, "+").replace(/_/g, "/");
          while (payload.length % 4) payload += "=";
          const json = atob(payload);
          return JSON.parse(json);
        } catch (e) {
          return null;
        }
      })(token);
      const userId =
        payload && (payload.user_id || payload.userId || payload.id);
      if (userId) {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        user = await tryFetchLocal(
          `/api/v1/users/${encodeURIComponent(userId)}`,
          headers
        );
      }
    } catch (e) {
      console.warn("JWT decode or user fetch error", e);
    }

    const profileBtn = document.getElementById("profileBtn");
    const profileAvatar = document.getElementById("profileAvatar");
    const profileName = document.getElementById("profileName");
    const profileRole = document.getElementById("profileRole");
    const viewAllMessagesBtn = document.getElementById("viewAllMessagesBtn");
    const wishlistMenuItem = document.getElementById("wishlistMenuItem");
    const contactSubmissionsMenuItem = document.getElementById("contactSubmissionsMenuItem");

    if (user) {
      if (profileBtn) {
        if (user.avatarUrl) {
          profileBtn.style.backgroundImage = `url('${user.avatarUrl}')`;
          profileBtn.style.backgroundSize = "cover";
          profileBtn.style.backgroundPosition = "center";
          profileBtn.textContent = "";
        } else {
          profileBtn.style.backgroundImage = "";
          profileBtn.textContent =
            user.initial || (user.name && user.name[0]) || "";
        }
        profileBtn.title = user.name || "";
      }
      if (profileAvatar) {
        if (user.avatarUrl) {
          profileAvatar.style.backgroundImage = `url('${user.avatarUrl}')`;
          profileAvatar.style.backgroundSize = "cover";
          profileAvatar.style.backgroundPosition = "center";
          profileAvatar.textContent = "";
        } else {
          profileAvatar.style.backgroundImage = "";
          profileAvatar.textContent =
            user.initial || (user.name && user.name[0]) || "";
        }
      }
      if (profileName) profileName.textContent = user.name || "";
      if (profileRole) {
        const parts = [];
        if (user.role) parts.push(user.role);
        if (user.unit) parts.push(user.unit);
        profileRole.textContent = parts.join(" • ");
      }
      if (viewAllMessagesBtn) viewAllMessagesBtn.href = "/messages.html";
      if (wishlistMenuItem) wishlistMenuItem.style.display = "";
      if (contactSubmissionsMenuItem) contactSubmissionsMenuItem.style.display = "none";
      try {
        const badge = document.getElementById('wishlistCountBadge');
        if (badge) {
          const list = JSON.parse(localStorage.getItem('wishlist')||'[]');
          const c = Array.isArray(list)? list.length : 0;
          badge.textContent = c;
          badge.style.display = c>0? 'inline-flex':'none';
        }
      } catch(e) {}
      window.currentTenantUser = user;
    } else {
      if (profileBtn) {
        profileBtn.style.backgroundImage = "";
        profileBtn.textContent = "";
      }
      if (profileAvatar) {
        profileAvatar.style.backgroundImage = "";
        profileAvatar.textContent = "";
      }
      if (profileName) profileName.textContent = "";
      if (profileRole) profileRole.textContent = "";
      if (viewAllMessagesBtn) viewAllMessagesBtn.href = "#";
      if (wishlistMenuItem) wishlistMenuItem.style.display = "none";
      if (contactSubmissionsMenuItem) contactSubmissionsMenuItem.style.display = "none";
      window.currentTenantUser = null;
    }
  }

  function setupSidebarTenant(role) {
    const sidebarNav = document.getElementById("sidebarNav");
    if (!sidebarNav) return;
    let links = [];
    if (role === "tenant") {
      links = [
        {
          href: "/dashboard.html",
          icon: "fas fa-chart-line",
          text: "Dashboard",
          page: "dashboard",
          tooltip: "Dashboard Overview",
        },
        {
          href: "/messages.html",
          icon: "fa-solid fa-envelope",
          text: "Messages",
          page: "messages",
          tooltip: "Messages & Communication",
        },
        { section: "Lease", isSection: true },
        {
          href: "/leaseTenant.html",
          icon: "fas fa-file-contract",
          text: "Lease Information",
          page: "leaseTenant",
          tooltip: "Lease Agreement & Details",
        },
        { section: "Payments", isSection: true },
        {
          href: "/paymentTenant.html",
          icon: "fas fa-credit-card",
          text: "Payments",
          page: "paymentTenant",
          tooltip: "Rent & Payment History",
        },
        { section: "Requests", isSection: true },
        {
          href: "/maintenanceTenant.html",
          icon: "fas fa-tools",
          text: "Maintenance",
          page: "maintenanceTenant",
          tooltip: "Maintenance Requests",
        },
      ];
    }
    sidebarNav.innerHTML = links
      .map((link) => {
        if (link.isSection) {
          return `<div class="nav-section"><div class="nav-section-title">${link.section}</div></div>`;
        }
        return `
                <div class="nav-item">
                    <a href="${link.href}" class="nav-link" data-tooltip="${
          link.tooltip || link.text
        }" data-page="${link.page}" title="${link.tooltip || link.text}">
                        <div class="nav-icon"><i class="${link.icon}"></i></div>
                        <span class="nav-text">${link.text}</span>
                    </a>
                </div>
            `;
      })
      .join("");
  }

  //#region TENANT NAVIGATION MANAGER

  class TenantNavigationManager {
    constructor(config = {}) {
      this.config = {
        sidebarSelector: "#sidebar",
        toggleSelector: "#sidebarToggle",
        overlaySelector: "#overlay",
        topNavbarSelector: ".top-navbar",
        mainContentSelector: ".main-content",
        pageTitleSelector: "#pageTitle",
        searchInputSelector: "#searchInput",
        storageKey: "tenantSidebarCollapsed",
        startCollapsed: true,
        ...config,
      };

      this.isMobile = window.innerWidth <= 768;
      this.inboxMessages = this.getDefaultInboxMessages();
      this.isCollapsed = this.getInitialCollapsedState();
      this.init();
    }

    getInitialCollapsedState() {
      try {
        const saved = localStorage.getItem(this.config.storageKey);
        if (saved !== null && !this.isMobile) {
          return saved === "true";
        }
      } catch (e) {}
      return this.config.startCollapsed !== false;
    }
    init() {
      this.cacheDOMElements();
      this.setupPageTitles();
      this.applyInitialCollapsedState();
      this.bindEvents();
      this.updateLayout();
      this.setActiveNavItem();
  this.populateInbox();
  
  try { this.loadInboxFromServer && this.loadInboxFromServer(); } catch(e) {}
      
      try { this.refreshNotifications && this.refreshNotifications(); } catch(e) { /* noop */ }
      this.addKeyboardShortcuts();
      
      try { ensureStylesheet && ensureStylesheet('/css/notifications.css'); } catch(e) {}
      
      try { this.initRealtimeNotifications && this.initRealtimeNotifications(); } catch(e) {}
    }
    applyInitialCollapsedState() {
      if (!this.isMobile && this.isCollapsed && this.sidebar) {
        this.sidebar.classList.add("collapsed");
        this.updateToggleIcon();
        this.updateContentLayout();
      }
    }
    cacheDOMElements() {
      this.sidebar = document.querySelector(this.config.sidebarSelector);
      this.sidebarToggle = document.querySelector(this.config.toggleSelector);
      this.overlay = document.querySelector(this.config.overlaySelector);
      this.topNavbar = document.querySelector(this.config.topNavbarSelector);
      this.mainContent = document.querySelector(
        this.config.mainContentSelector
      );
      this.pageTitle = document.querySelector(this.config.pageTitleSelector);
      this.pageIcon = document.getElementById("pageIcon");
      this.pageDescription = document.getElementById("pageDescription");
      this.searchInput = document.querySelector(
        this.config.searchInputSelector
      );
  this.notificationBtn = document.getElementById("notificationBtn");
  this.notificationMenu = document.getElementById("notificationMenu");
  this.notificationBadge = document.getElementById("notificationBadge");
      this.inboxBtn = document.getElementById("inboxBtn");
      this.inboxDropdown = document.getElementById("inboxDropdown");
      this.profileBtn = document.getElementById("profileBtn");
      this.profileMenu = document.getElementById("profileMenu");
    }
    setupPageTitles() {
      this.pageTitles = {
        "dashboard.html": "Dashboard",
        adminDashboard: "Dashboard",
        "tenantDashboard.html": "Dashboard",
        tenantDashboard: "Dashboard",
        "wishlist.html": "My Wishlist",
        wishlist: "My Wishlist",
        "leaseTenant.html": "Lease Information",
        leaseTenant: "Lease Information",
        "paymentTenant.html": "Payments",
        paymentTenant: "Payments",
        "maintenanceTenant.html": "Maintenance Requests",
        maintenanceTenant: "Maintenance Requests",
        "messages.html": "Messages",
        messages: "Messages",
        dashboard: "Dashboard",
        leaseTenant: "Lease Information",
        paymentTenant: "Payments",
        maintenanceTenant: "Maintenance Requests",
        messages: "Messages",
        support: "Support",
        index: "Dashboard",
        "": "Dashboard",
        "account-profile.html": "Account Settings",
        "account-profile": "Account Settings",
        accountProfile: "Account Settings",
        "wishlistTenant.html": "My Wishlist",
        wishlistTenant: "My Wishlist",
      };
      this.pageIcons = {
        "dashboard.html": "fas fa-chart-line",
        adminDashboard: "fas fa-chart-line",
        "leaseTenant.html": "fas fa-file-contract",
        leaseTenant: "fas fa-file-contract",
        "paymentTenant.html": "fas fa-credit-card",
        paymentTenant: "fas fa-credit-card",
        "maintenanceTenant.html": "fas fa-tools",
        maintenanceTenant: "fas fa-tools",
        "messages.html": "fas fa-envelope",
        messages: "fas fa-envelope",
        "wishlist.html": "fas fa-heart",
        wishlist: "fas fa-heart",
        dashboard: "fas fa-chart-line",
        leaseTenant: "fas fa-file-contract",
        paymentTenant: "fas fa-credit-card",
        maintenanceTenant: "fas fa-tools",
        messages: "fas fa-envelope",
        support: "fas fa-question-circle",
        index: "fas fa-chart-line",
        "": "fas fa-chart-line",
        "account-profile.html": "fas fa-user-cog",
        "account-profile": "fas fa-user-cog",
        accountProfile: "fas fa-user-cog",
        "wishlistTenant.html": "fas fa-heart",
        wishlistTenant: "fas fa-heart",
      };
      this.pageDescriptions = {
        "dashboard.html":
          "Overview of your rental activity, important notifications, and quick access to key features",
        dashboard:
          "Overview of your rental activity, important notifications, and quick access to key features",
        "leaseTenant.html":
          "View your lease agreement details, terms, and important rental information",
        leaseTenant:
          "View your lease agreement details, terms, and important rental information",
        "paymentTenant.html":
          "Manage your rent payments, view payment history, and set up automatic payments",
        paymentTenant:
          "Manage your rent payments, view payment history, and set up automatic payments",
        "maintenanceTenant.html":
          "Submit maintenance requests and track the status of your service tickets",
        maintenanceTenant:
          "Submit maintenance requests and track the status of your service tickets",
        "messages.html":
          "Communicate with property management and stay updated on important announcements",
        messages:
          "Communicate with property management and stay updated on important announcements",
        dashboard:
          "Overview of your rental activity, important notifications, and quick access to key features",
        leaseTenant:
          "View your lease agreement details, terms, and important rental information",
        paymentTenant:
          "Manage your rent payments, view payment history, and set up automatic payments",
        maintenanceTenant:
          "Submit maintenance requests and track the status of your service tickets",
        messages:
          "Communicate with property management and stay updated on important announcements",
        support:
          "Get help and support for any questions or issues you may have",
        index:
          "Overview of your rental activity, important notifications, and quick access to key features",
        "": "Overview of your rental activity, important notifications, and quick access to key features",
        "account-profile.html":
          "Manage your account settings, personal information, and preferences",
        "account-profile":
          "Manage your account settings, personal information, and preferences",
        accountProfile:
          "Manage your account settings, personal information, and preferences",
        "wishlist.html": "Manage properties you've wishlisted for easy access",
        wishlist: "Manage properties you've wishlisted for easy access",
        "wishlistTenant.html": "Manage properties you've wishlisted for easy access",
        wishlistTenant: "Manage properties you've wishlisted for easy access",
      };
    }
    getDefaultInboxMessages() {
      return [
        {
          id: 1,
          sender: "Property Manager",
          subject: "Monthly Rent Reminder",
          preview:
            "Your rent payment for this month is due on the 30th. Please ensure timely payment to avoid late fees and maintain your good standing with the property.",
          time: "2 hours ago",
          unread: true,
          priority: "high",
        },
        {
          id: 2,
          sender: "Maintenance Team",
          subject: "Work Order #2024-0156 Completed",
          preview:
            "The plumbing issue in your apartment has been successfully resolved. Our certified technician completed the work and performed quality checks to ensure everything is functioning properly.",
          time: "1 day ago",
          unread: true,
          priority: "medium",
        },
        {
          id: 3,
          sender: "Ambulo Properties",
          subject: "Lease Renewal Opportunity",
          preview:
            "Your lease agreement is set to expire in 60 days. We would like to discuss renewal options and updated terms. Please contact us at your earliest convenience.",
          time: "3 days ago",
          unread: false,
          priority: "medium",
        },
        {
          id: 4,
          sender: "Community Manager",
          subject: "Exciting Building Amenity Updates",
          preview:
            "We're excited to announce new premium amenities coming to your building including a state-of-the-art fitness center, rooftop garden, and co-working spaces.",
          time: "1 week ago",
          unread: false,
          priority: "low",
        },
        {
          id: 5,
          sender: "Security Office",
          subject: "Package Delivery Notification",
          preview:
            "A package has been delivered to your unit and is currently being held at the front desk. Please bring a valid ID to collect your delivery during office hours.",
          time: "2 weeks ago",
          unread: false,
          priority: "medium",
        },
      ];
    }

    
    formatRelativeTime(ts) {
      try {
        const d = ts instanceof Date ? ts : new Date(ts);
        const now = new Date();
        const diffMs = now - d;
        const sec = Math.floor(diffMs / 1000);
        const min = Math.floor(sec / 60);
        const hr = Math.floor(min / 60);
        const day = Math.floor(hr / 24);
        if (sec < 60) return 'just now';
        if (min < 60) return `${min} minute${min!==1?'s':''} ago`;
        if (hr < 24) return `${hr} hour${hr!==1?'s':''} ago`;
        if (day < 7) return `${day} day${day!==1?'s':''} ago`;
        return d.toLocaleDateString();
      } catch { return ''; }
    }

    
    _getCurrentUserId() {
      try {
        const token = (document.cookie.match('(^|;)\\s*token\\s*=\\s*([^;]+)')||[])[2];
        if (!token) return null;
        const part = token.split('.')[1];
        if (!part) return null;
        const payload = JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=')));
        return payload && (payload.user_id || payload.userId || payload.id) || null;
      } catch { return null; }
    }

    _mapServerMessageToInboxItem(m, currentUserId) {
      const safe = (s)=> (s==null? '' : String(s));
      const senderName = `${safe(m.sender_first_name||'').trim()} ${safe(m.sender_last_name||'').trim()}`.trim() || 'Message';
      const recipientName = `${safe(m.recipient_first_name||'').trim()} ${safe(m.recipient_last_name||'').trim()}`.trim();
      const isIncoming = String(m.recipient_user_id) === String(currentUserId);
      const otherParty = isIncoming ? senderName : (recipientName || 'Recipient');
      const preview = safe(m.message || '').slice(0, 140);
      return {
        id: m.message_id,
        sender: otherParty,
        subject: otherParty,
        preview,
        time: this.formatRelativeTime(m.created_at),
        unread: isIncoming, 
      };
    }

    _mapConversationToInboxItem(conv) {
      const safe = (s)=> (s==null? '' : String(s));
      return {
        id: `${safe(conv.other_user_id)}`,
        sender: safe(conv.other_user_name || 'Conversation'),
        subject: safe(conv.other_user_name || 'Conversation'),
        preview: safe(conv.last_message || ''),
        time: this.formatRelativeTime(conv.last_message_time),
        unread: false,
      };
    }

    async loadInboxFromServer(limit = 8) {
      try {
        const uid = this._getCurrentUserId();
        if (!uid) return;
        const res = await fetch(`/api/${(window.API_VERSION||'v1')}/messages/conversations/${encodeURIComponent(uid)}?limit=${limit}`, { credentials: 'include' });
        const data = res.ok ? await res.json() : [];
        const list = Array.isArray(data) ? data : (data.conversations || data || []);
        const mapped = (list || []).slice(0, limit).map((c) => this._mapConversationToInboxItem(c));
        this.inboxMessages = mapped;
        this.populateInbox();
      } catch (e) {
        console.warn('Failed to load inbox conversations', e);
      }
    }
    saveCollapsedState() {
      try {
        if (!this.isMobile) {
          localStorage.setItem(
            this.config.storageKey,
            this.isCollapsed.toString()
          );
        }
      } catch (e) {
        console.warn(
          "localStorage not available, sidebar state will not persist"
        );
      }
    }
    loadCollapsedState() {
      try {
        const saved = localStorage.getItem(this.config.storageKey);
        if (saved !== null && !this.isMobile) {
          this.isCollapsed = saved === "true";
          if (this.isCollapsed && this.sidebar) {
            this.sidebar.classList.add("collapsed");
            this.updateToggleIcon();
            this.updateContentLayout();
          }
        }
      } catch (e) {
        console.warn("Could not load sidebar state from localStorage");
      }
    }
    updateToggleIcon() {
      if (!this.sidebarToggle) return;
      const icon = this.sidebarToggle.querySelector("i");
      if (!icon) return;
      if (this.isMobile) {
        if (this.sidebar.classList.contains("mobile-open")) {
          icon.className = "fas fa-times";
          this.sidebarToggle.title = "Close Menu";
        } else {
          icon.className = "fas fa-bars";
          this.sidebarToggle.title = "Open Sidebar";
        }
      } else {
        if (this.isCollapsed) {
          icon.className = "fas fa-chevron-right";
          this.sidebarToggle.title = "Expand Sidebar";
        } else {
          icon.className = "fas fa-chevron-left";
          this.sidebarToggle.title = "Collapse Sidebar";
        }
      }
    }
    updateContentLayout() {
      if (!this.isMobile) {
        if (this.topNavbar) {
          this.topNavbar.style.left = this.isCollapsed ? "80px" : "280px";
        }
        if (this.mainContent) {
          this.mainContent.style.marginLeft = this.isCollapsed
            ? "80px"
            : "280px";
          this.mainContent.classList.toggle(
            "sidebar-collapsed",
            this.isCollapsed
          );
        }
      }
    }
    updateLayout() {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth <= 768;
      if (this.isMobile) {
        if (this.sidebar) {
          this.sidebar.classList.remove("collapsed");
          this.sidebar.classList.remove("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.remove("active");
        }
        if (this.topNavbar) {
          this.topNavbar.style.left = "0";
        }
        if (this.mainContent) {
          this.mainContent.style.marginLeft = "0";
          this.mainContent.classList.remove("sidebar-collapsed");
        }
      } else {
        if (this.sidebar) {
          this.sidebar.classList.remove("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.remove("active");
        }
        if (this.isCollapsed && this.sidebar) {
          this.sidebar.classList.add("collapsed");
        }
        this.updateContentLayout();
      }
      this.updateToggleIcon();
    }
    toggleSidebar(e) {
      if (e) e.stopPropagation();
      if (this.isMobile) {
        if (this.sidebar) {
          this.sidebar.classList.toggle("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.toggle("active");
        }
      } else {
        this.isCollapsed = !this.isCollapsed;
        if (this.sidebar) {
          this.sidebar.classList.toggle("collapsed", this.isCollapsed);
        }
        this.updateContentLayout();
        this.saveCollapsedState();
      }
      this.updateToggleIcon();
      this.addToggleEffect();
    }

    addToggleEffect() {
      if (this.sidebarToggle) {
        this.sidebarToggle.classList.add("hover-effect");
        setTimeout(() => {
          this.sidebarToggle.classList.remove("hover-effect");
        }, 300);
      }
    }

    closeMobileSidebar() {
      if (this.isMobile) {
        if (this.sidebar) {
          this.sidebar.classList.remove("mobile-open");
        }
        if (this.overlay) {
          this.overlay.classList.remove("active");
        }
        this.updateToggleIcon();
      }
    }

    updatePageTitle(page) {
      if (this.pageTitle && this.pageTitles[page]) {
        this.pageTitle.textContent = this.pageTitles[page];
        document.title = this.pageTitles[page] + " | Ambulo PMS";
      }
      if (this.pageIcon && this.pageIcons[page]) {
        this.pageIcon.className = `page-icon ${this.pageIcons[page]}`;
      }
      if (this.pageDescription && this.pageDescriptions[page]) {
        this.pageDescription.textContent = this.pageDescriptions[page];
      }
    }
    setActiveNavItem(targetPage = null) {
      let currentPage = targetPage;
      if (!currentPage) {
        currentPage = window.location.pathname.split("/").pop();
        if (currentPage.includes(".")) {
          currentPage = currentPage.split(".")[0];
        }
        if (!currentPage || currentPage === "index") {
          currentPage = "dashboard";
        }
      }
      const navLinks = document.querySelectorAll(".nav-link");
      navLinks.forEach((link) => link.classList.remove("active"));
      navLinks.forEach((link) => {
        const linkPage = link.getAttribute("data-page");
        const linkHref = link.getAttribute("href");
        let linkFileName = "";
        if (linkHref) {
          linkFileName = linkHref.split("/").pop().split(".")[0];
        }
        if (
          linkPage === currentPage ||
          linkFileName === currentPage ||
          (currentPage === "tenantDashboard" && linkPage === "dashboard") ||
          (currentPage === "index" && linkPage === "dashboard") ||
          (currentPage === "dashboard" &&
            (linkPage === "dashboard" || linkFileName === "tenantDashboard"))
        ) {
          link.classList.add("active");
          const pageKey = linkPage || linkFileName || currentPage;
          this.updatePageTitle(pageKey);
        }
      });

      if (currentPage === "wishlistTenant") {
        this.updatePageTitle("wishlistTenant");
      }

      const activeLink = document.querySelector(".nav-link.active");
      if (!activeLink) {
        this.updatePageTitle(currentPage);
      }
    }
    populateInbox() {
      const inboxContent = document.getElementById("inboxContent");
      const inboxBadge = document.getElementById("inboxBadge");
      const messagesBadge = document.getElementById("messagesBadge");
      if (!inboxContent) return;
      const unreadCount = this.inboxMessages.filter((msg) => msg.unread).length;
      if (inboxBadge) {
        if (unreadCount > 0) {
          inboxBadge.textContent = `${unreadCount} New`;
          if (messagesBadge) {
            messagesBadge.textContent = unreadCount;
            messagesBadge.style.display = "flex";
          }
        } else {
          inboxBadge.textContent = "All Read";
          if (messagesBadge) {
            messagesBadge.style.display = "none";
          }
        }
      }
      if (this.inboxMessages.length === 0) {
        inboxContent.innerHTML = ` <div class="empty-inbox"><div class="empty-inbox-icon">📭</div><div class="empty-inbox-text">No messages yet</div><div class="empty-inbox-subtext">You're all caught up!</div></div> `;
      } else {
        inboxContent.innerHTML = this.inboxMessages
          .map((message) => {
            const href = `/messages.html?user=${encodeURIComponent(
              String(message.id || "")
            )}`;
            return ` <a href="${href}" class="inbox-item ${
              message.unread ? "unread" : ""
            }" data-id="${message.id}" style="color:inherit; text-decoration:none;"> <div class="inbox-item-header"> <div class="inbox-sender-section"> <span class="inbox-sender">${
              message.sender
            }</span> ${
              message.priority
                ? `<div class="inbox-priority ${message.priority}"></div>`
                : ""
            } </div> <span class="inbox-time">${
              message.time
            }</span> </div> <div class="inbox-subject">${
              message.subject
            }</div> <div class="inbox-preview">${
              message.preview
            }</div> </a> `;
          })
          .join("");
      }
    }

    async initRealtimeNotifications() {
      try {
        if (typeof io === 'undefined') {
          await ensureScript('/socket.io/socket.io.js');
        }
        if (typeof io === 'undefined') return; 
        const token = getJwtToken();
        if (!token) return;
        if (!window.__ambuloSocket) {
          window.__ambuloSocket = io({ auth: { token } });
        }
        const s = window.__ambuloSocket;
        if (!s.__notifListenerAttached) {
          
          try {
            const sendSubs = () => {
              try {
                const ids = JSON.parse(localStorage.getItem('wishlist')||'[]');
                if (Array.isArray(ids) && ids.length) {
                  s.emit('wishlist_subscribe', { ids });
                }
              } catch(_) {}
            };
            s.on('connect', sendSubs);
            window.addEventListener('wishlist:updated', sendSubs);
            window.addEventListener('storage', (e) => { if (e && e.key === 'wishlist') sendSubs(); });
            sendSubs();
          } catch(_) {}
          s.on('notification', (payload) => {
            try {
              const type = String(
                (payload && (payload.type || payload.notification_type)) ||
                (payload && payload.notification && payload.notification.type) ||
                ''
              ).toUpperCase();
              if (type === 'MESSAGE') {
                return; 
              }
            } catch(_) {}
            try { this.refreshNotifications && this.refreshNotifications(); } catch(_) {}
          });
          
          s.on && s.on('new_message', (msg) => {
            try {
              const messagesBadge = document.getElementById('messagesBadge');
              if (messagesBadge) {
                const current = parseInt(messagesBadge.textContent || '0', 10) || 0;
                messagesBadge.textContent = String(current + 1);
                messagesBadge.style.display = 'flex';
              }
              const inboxContent = document.getElementById('inboxContent');
              if (inboxContent && msg) {
                const safe = (v) => (v == null ? '' : String(v));
                const href = `/messages.html?user=${encodeURIComponent(String(msg.other_user_id || msg.sender_id || msg.sender || ''))}`;
                const html = `
                  <a href="${href}" class="inbox-item unread" style="color:inherit; text-decoration:none;">
                    <div class="inbox-item-header">
                      <div class="inbox-sender-section">
                        <span class="inbox-sender">${safe(msg.sender_name || msg.sender || 'Message')}</span>
                      </div>
                      <span class="inbox-time">just now</span>
                    </div>
                    <div class="inbox-subject">${safe(msg.subject || msg.thread_title || 'New message')}</div>
                    <div class="inbox-preview">${safe(msg.text || msg.body || msg.content || '')}</div>
                  </a>`;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html.trim();
                const el = wrapper.firstChild;
                inboxContent.prepend(el);
              }
            } catch (e) {}
          });
          
          s.on('property_status_changed', (p) => {
            try {
              const getWishlist = () => { try { return JSON.parse(localStorage.getItem('wishlist')||'[]'); } catch { return []; } };
              const ids = getWishlist().map(String);
              const pid = String((p && (p.property_id || p.id)) || '');
              if (!pid || !ids.includes(pid)) return;

              const name = (p && (p.property_name || p.name)) || `Property ${pid}`;
              const oldS = String((p && p.old_status) || '').toLowerCase();
              const newS = String((p && p.new_status) || '').toLowerCase();
              const pretty = (s)=> (String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1));
              const title = `Wishlist update: ${name}`;
              const body = oldS && newS ? `Status changed from ${pretty(oldS)} to ${pretty(newS)}` : `Status updated to ${pretty(newS||oldS)}`;
              const link = `/spacesDetails.html?id=${encodeURIComponent(pid)}`;

              try {
                const badge = document.getElementById('notificationBadge');
                if (badge) { const cur = parseInt(badge.textContent||'0',10)||0; const next = cur+1; badge.textContent=String(next); badge.style.display='flex'; }
                const menu = document.getElementById('notificationMenu');
                if (menu) {
                  const item = document.createElement('div');
                  item.className = 'notification-item unread';
                  item.style.cursor = 'pointer';
                  item.innerHTML = `
                    <div class="notification-title">${title}</div>
                    ${body ? `<div class="notification-body">${body}</div>` : ''}
                    <div class="notification-meta"><span class="notification-type type-info">INFO</span><span class="notification-time">just now</span></div>
                  `;
                  item.addEventListener('click', ()=>{ try { if (link) window.location.href = link; } catch(_) {} });
                  const list = menu.querySelector('.notification-list');
                  if (list) list.prepend(item); else menu.prepend(item);
                }
              } catch(_) {}
            } catch (e) { /* ignore */ }
          });
          
          s.on('property_status_changed', (p) => {
            try {
              const getWishlist = () => { try { return JSON.parse(localStorage.getItem('wishlist')||'[]'); } catch { return []; } };
              const ids = getWishlist().map(String);
              const pid = String((p && (p.property_id || p.id)) || '');
              if (!pid || !ids.includes(pid)) return; 
              const name = (p && (p.property_name || p.name)) || `Property ${pid}`;
              const oldS = String((p && p.old_status) || '').toLowerCase();
              const newS = String((p && p.new_status) || '').toLowerCase();
              const pretty = (s)=> (String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1));
              const title = `Wishlist update: ${name}`;
              const body = oldS && newS ? `Status changed from ${pretty(oldS)} to ${pretty(newS)}` : `Status updated to ${pretty(newS||oldS)}`;
              const link = `/spacesDetails.html?id=${encodeURIComponent(pid)}`;
              addClientNotification({ title, body, type: 'INFO', link });
              const badge = document.getElementById('notificationBadge');
              if (badge) { const cur = parseInt(badge.textContent||'0',10)||0; const next = cur+1; badge.textContent=String(next); badge.style.display='flex'; }
              try {
                const merged = ([]).concat((window.__clientNotifQueue||[]), (this._notifCache||[]));
                this.renderNotifications(merged);
              } catch(_) {}
            } catch (_) {}
          });
          
          s.on('property_status_changed', (p) => {
            try {
              const getWishlist = () => { try { return JSON.parse(localStorage.getItem('wishlist')||'[]'); } catch { return []; } };
              const ids = getWishlist().map(String);
              const pid = String((p && (p.property_id || p.id)) || '');
              if (!pid || !ids.includes(pid)) return;
              const name = (p && (p.property_name || p.name)) || `Property ${pid}`;
              const oldS = String((p && p.old_status) || '').toLowerCase();
              const newS = String((p && p.new_status) || '').toLowerCase();
              const pretty = (s)=> (String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1));
              const title = `Wishlist update: ${name}`;
              const body = oldS && newS ? `Status changed from ${pretty(oldS)} to ${pretty(newS)}` : `Status updated to ${pretty(newS||oldS)}`;
              const link = `/spacesDetails.html?id=${encodeURIComponent(pid)}`;
              addClientNotification({ title, body, type: 'INFO', link });
              const badge = document.getElementById('notificationBadge');
              if (badge) { const cur = parseInt(badge.textContent||'0',10)||0; const next = cur+1; badge.textContent=String(next); badge.style.display='flex'; }
              try {
                const merged = ([]).concat((window.__clientNotifQueue||[]), (this._notifCache||[]));
                this.renderNotifications(merged);
              } catch(_) {}
            } catch (_) {}
          });
          s.__notifListenerAttached = true;
        }
      } catch (e) {
        console.debug('realtime notifications setup failed', e);
      }
    }

    _ensureNotifFilter() {
      if (!this._notifFilter) this._notifFilter = { unreadOnly: false, types: [] };
      return this._notifFilter;
    }

    _applyTypeFilter(list = []) {
      const filter = this._ensureNotifFilter();
      const types = Array.isArray(filter.types) ? filter.types : [];
      if (!types.length) return list;
      const set = new Set(types.map(t => String(t).toUpperCase()));
      return (list || []).filter(n => set.has(String(n.type || 'INFO').toUpperCase()));
    }

    async fetchNotifications({ unreadOnly = false } = {}) {
      try {
        const res = await fetch(`/api/${(window.API_VERSION||'v1')}/notifications?unreadOnly=${unreadOnly}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load notifications');
        const data = await res.json();
        return data;
      } catch (e) {
        console.warn('notifications fetch error', e);
        return { notifications: [], pagination: { total: 0 } };
      }
    }

    renderNotifications(list = []) {
      const menu = this.notificationMenu;
      if (!menu) return;
      const filter = this._ensureNotifFilter();
      const chips = ['MESSAGE','PAYMENT','TICKET','LEASE','INFO'];
      const headerHtml = `
        <div class="dropdown-header" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
          <span>Notifications</span>
          <div style="display:flex; gap:.5rem;">
            <button id="notifFilterAll" class="btn btn-link" style="padding:.25rem .5rem; ${!filter.unreadOnly ? 'font-weight:600; text-decoration:underline;' : ''}">All</button>
            <button id="notifFilterUnread" class="btn btn-link" style="padding:.25rem .5rem; ${filter.unreadOnly ? 'font-weight:600; text-decoration:underline;' : ''}">Unread</button>
          </div>
        </div>
        <div class="notif-filters" style="display:flex; gap:.375rem; flex-wrap:wrap; padding:8px 12px; border-bottom:1px solid var(--notif-border);">
          ${chips.map(t => {
            const selected = (filter.types||[]).map(x=>String(x).toUpperCase()).includes(t);
            return `<button class="chip ${selected ? 'selected' : ''} chip-${t.toLowerCase()}" data-type="${t}">${t}</button>`;
          }).join('')}
        </div>`;
      if (!Array.isArray(list) || list.length === 0) {
        menu.innerHTML = `${headerHtml}<div class="dropdown-item empty">No notifications</div>`;
        if (this.notificationBadge) { this.notificationBadge.textContent = '0'; this.notificationBadge.style.display = 'none'; }
        return;
      }
      const unreadCount = (this._notifCache || list).filter(n => !n.is_read).length;
      if (this.notificationBadge) { this.notificationBadge.textContent = String(unreadCount); this.notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none'; }
      menu.innerHTML = `
        ${headerHtml}
        <div class="notification-list">
          ${list.map(n => `
            <div class="notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.notification_id}">
              <div class="notification-title">${(n.title||'').toString()}</div>
              ${n.body ? `<div class="notification-body">${(n.body||'').toString()}</div>` : ''}
              <div class="notification-meta">
                <span class="notification-type type-${(n.type||'INFO').toLowerCase()}">${(n.type||'INFO')}</span>
                <span class="notification-time">${new Date(n.created_at).toLocaleString()}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="dropdown-footer"><button id="markAllNotificationsRead" class="btn btn-link">Mark all as read</button></div>
      `;
      const btnAll = menu.querySelector('#notifFilterAll');
      const btnUnread = menu.querySelector('#notifFilterUnread');
      if (btnAll) btnAll.addEventListener('click', async (e) => {
        e.stopPropagation();
        this._notifFilter.unreadOnly = false;
        const { notifications } = await this.fetchNotifications({ unreadOnly: false });
        this._notifCache = notifications || [];
        this.renderNotifications(this._applyTypeFilter(this._notifCache));
      });
      if (btnUnread) btnUnread.addEventListener('click', async (e) => {
        e.stopPropagation();
        this._notifFilter.unreadOnly = true;
        const { notifications } = await this.fetchNotifications({ unreadOnly: true });
        this._notifCache = notifications || [];
        this.renderNotifications(this._applyTypeFilter(this._notifCache));
      });
      
      menu.querySelectorAll('.notif-filters .chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          const t = String(chip.getAttribute('data-type') || '').toUpperCase();
          if (!this._notifFilter.types) this._notifFilter.types = [];
          const idx = this._notifFilter.types.findIndex(x => String(x).toUpperCase() === t);
          if (idx >= 0) this._notifFilter.types.splice(idx, 1); else this._notifFilter.types.push(t);
          const list = this._applyTypeFilter(this._notifCache || []);
          this.renderNotifications(list);
        });
      });
      menu.querySelectorAll('.notification-item').forEach(el => {
        el.addEventListener('click', async () => {
          const id = el.getAttribute('data-id');
          try {
            await fetch(`/api/${(window.API_VERSION||'v1')}/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' });
            el.classList.remove('unread');
            if (this.notificationBadge) {
              const current = parseInt(this.notificationBadge.textContent||'0', 10) || 0;
              const next = Math.max(0, current - 1);
              this.notificationBadge.textContent = String(next);
              this.notificationBadge.style.display = next > 0 ? 'flex' : 'none';
            }
          } catch {}
        });
      });
      const markAll = menu.querySelector('#markAllNotificationsRead');
      if (markAll) {
        markAll.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await fetch(`/api/${(window.API_VERSION||'v1')}/notifications/read-all`, { method: 'PATCH', credentials: 'include' });
            menu.querySelectorAll('.notification-item.unread').forEach(el => el.classList.remove('unread'));
            if (this.notificationBadge) { this.notificationBadge.textContent = '0'; this.notificationBadge.style.display = 'none'; }
          } catch {}
        });
      }
    }

    async refreshNotifications() {
      const filter = this._ensureNotifFilter();
      const { notifications } = await this.fetchNotifications({ unreadOnly: !!filter.unreadOnly });
      this._notifCache = notifications || [];
      this.renderNotifications(this._applyTypeFilter(this._notifCache));
    }
    openMessage(messageId) {
      const message = this.inboxMessages.find((msg) => msg.id === messageId);
      if (message && message.unread) {
        message.unread = false;
        this.populateInbox();
      }
    }
    toggleDropdown(menu, button) {
      if (!menu) return;
      document
        .querySelectorAll(".dropdown-menu, .inbox-dropdown-menu")
        .forEach((dropdown) => {
          if (dropdown !== menu) {
            dropdown.classList.remove("show", "active");
          }
        });
      if (menu.classList.contains("inbox-dropdown-menu")) {
        menu.classList.toggle("active");
      } else {
        menu.classList.toggle("show");
      }
    }
    closeAllDropdowns() {
      document
        .querySelectorAll(".dropdown-menu, .inbox-dropdown-menu")
        .forEach((dropdown) => {
          dropdown.classList.remove("show", "active");
        });
    }
    async logout() {
      this.closeAllDropdowns();
      const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
        ? ((msg, title) => window.showConfirm(msg, title))
        : (msg => confirmOverlay(String(msg), 'Sign out'));
      const ok = !!(await confirmFn("Are you sure you want to sign out?", 'Sign out'));
      if (!ok) return;
      localStorage.clear();
      sessionStorage.clear();
      fetch("/api/v1/users/logout", {
        method: "POST",
        credentials: "include",
      }).finally(() => {
        window.location.href = "/login.html";
      });
    }
    bindEvents() {
      if (this.sidebarToggle) {
        this.sidebarToggle.addEventListener("click", (e) =>
          this.toggleSidebar(e)
        );
      }
      if (this.overlay) {
        this.overlay.addEventListener("click", () => this.closeMobileSidebar());
      }
      if (this.notificationBtn && this.notificationMenu) {
        this.notificationBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try { await this.refreshNotifications(); } catch(_) {}
          this.toggleDropdown(this.notificationMenu, this.notificationBtn);
        });
      }
      
      if (!this._notifDelegated) {
        this._notifDelegated = function delegatedNotifHandler(e) {
          try {
            const btn = e.target.closest && e.target.closest('#notificationBtn');
            if (!btn) return;
            e.stopPropagation();
            try { (this.refreshNotifications && this.refreshNotifications()); } catch(_) {}
            const menu = document.getElementById('notificationMenu');
            if (menu) this.toggleDropdown(menu, btn);
          } catch (err) {}
        }.bind(this);
        document.addEventListener('click', this._notifDelegated);
      }
      if (this.inboxBtn && this.inboxDropdown) {
        this.inboxBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try { await (this.loadInboxFromServer && this.loadInboxFromServer()); } catch(_) {}
          this.toggleDropdown(this.inboxDropdown, this.inboxBtn);
        });
      }
      if (this.profileBtn && this.profileMenu) {
        this.profileBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleDropdown(this.profileMenu, this.profileBtn);
        });
      }
      document.addEventListener("click", (e) => {
        if (
          !e.target.closest(".dropdown") &&
          !e.target.closest(".inbox-dropdown")
        ) {
          this.closeAllDropdowns();
        }
      });
      document
        .querySelectorAll(".dropdown-menu, .inbox-dropdown-menu")
        .forEach((menu) => {
          menu.addEventListener("click", (e) => e.stopPropagation());
        });
      document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", (e) => {
          if (link.getAttribute("href") === "#") {
            e.preventDefault();
          }
          document
            .querySelectorAll(".nav-link")
            .forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
          const page =
            link.dataset.page ||
            link.getAttribute("href").split("/").pop().split(".")[0];
          this.updatePageTitle(page);
          this.closeMobileSidebar();
        });
      });
      window.addEventListener("popstate", () => this.setActiveNavItem());
      window.addEventListener("resize", () => this.updateLayout());
      setTimeout(() => {
        document
          .querySelectorAll("#notificationMenu .dropdown-item")
          .forEach((item) => {
            item.addEventListener("click", () => {
              const titleElement = item.querySelector(".dropdown-item-title");
              if (titleElement) {
              }
              item.style.opacity = "0.7";
              const badge = document.getElementById("notificationBadge");
              if (badge) {
                let count = parseInt(badge.textContent);
                if (count > 0) {
                  count--;
                  badge.textContent = count;
                  if (count === 0) {
                    badge.style.display = "none";
                    const subtitle = document.querySelector(
                      "#notificationMenu .dropdown-subtitle"
                    );
                    if (subtitle) {
                      subtitle.textContent = "No unread notifications";
                    }
                  }
                }
              }
            });
          });
      }, 100);
    }
    addKeyboardShortcuts() {
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "b") {
          e.preventDefault();
          this.toggleSidebar();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          if (this.searchInput) this.searchInput.focus();
        }
        if (e.key === "Escape") {
          this.closeAllDropdowns();
        }
      });
    }
    static async loadComponent(componentPath, containerId) {
      try {
        const response = await fetch(componentPath);
        const html = await response.text();
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = html;
          return true;
        }
        return false;
      } catch (error) {
        console.error(
          `Error loading tenant component from ${componentPath}:`,
          error
        );
        return false;
      }
    }
    static async initializeTenantNavigation(config = {}) {
      const sidebarLoaded = await TenantNavigationManager.loadComponent(
        "/components/sidebar.html",
        "sidebarContainer"
      );
      const navbarLoaded = await TenantNavigationManager.loadComponent(
        "/components/top-navbar.html",
        "navbarContainer"
      );
      if (sidebarLoaded || navbarLoaded) {
        setTimeout(async () => {
          window.tenantNavigationManager = new TenantNavigationManager(config);
          await setupTenantNavbar();
          setupSidebarTenant("tenant");
          window.tenantNavigationManager.setActiveNavItem();
          const mobileSidebarOpenBtn = document.getElementById(
            "mobileSidebarOpenBtn"
          );
          const sidebar = document.getElementById("sidebar");
          const overlay = document.getElementById("overlay");
          if (mobileSidebarOpenBtn && sidebar && overlay) {
            mobileSidebarOpenBtn.addEventListener("click", function () {
              sidebar.classList.add("mobile-open");
              overlay.classList.add("active");
            });
          }
        }, 10);
      } else {
        window.tenantNavigationManager = new TenantNavigationManager(config);
      }
    }
    updateNavigation(updates) {
      if (updates.currentPage) {
        this.setActiveNavItem(updates.currentPage);
      }
      if (updates.pageTitle) {
        this.updatePageTitle(updates.pageTitle);
      }
      if (updates.messages) {
        this.inboxMessages = updates.messages;
        this.populateInbox();
      }
    }
    addNavItem(item) {
      const navContainer = document.querySelector(".sidebar-nav");
      if (!navContainer) return;
      const navItem = document.createElement("div");
      navItem.className = "nav-item";
      navItem.innerHTML = ` <a href="${
        item.href || "#"
      }" class="nav-link" data-tooltip="${
        item.tooltip || item.text
      }" data-page="${item.page || ""}" title="${
        item.tooltip || item.text
      }"> <div class="nav-icon"><i class="${
        item.icon || "fas fa-circle"
      }"></i></div> <span class="nav-text">${item.text}</span> </a> `;
      if (item.section) {
        const section = navContainer.querySelector(
          `[data-section="${item.section}"]`
        );
        if (section) {
          section.parentNode.insertBefore(navItem, section.nextSibling);
        } else {
          navContainer.appendChild(navItem);
        }
      } else {
        navContainer.appendChild(navItem);
      }
      const link = navItem.querySelector(".nav-link");
      link.addEventListener("click", (e) => {
        if (link.getAttribute("href") === "#") {
          e.preventDefault();
        }
        document
          .querySelectorAll(".nav-link")
          .forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        const page =
          link.dataset.page ||
          link.getAttribute("href").split("/").pop().split(".")[0];
        this.updatePageTitle(page);
        this.closeMobileSidebar();
      });
    }
    getNavigationState() {
      return {
        isCollapsed: this.isCollapsed,
        isMobile: this.isMobile,
        currentPage: this.getCurrentPage(),
        unreadMessages: this.inboxMessages.filter((msg) => msg.unread).length,
      };
    }
    getCurrentPage() {
      const activeLink = document.querySelector(".nav-link.active");
      return activeLink ? activeLink.dataset.page : null;
    }
    destroy() {
      if (this.sidebarToggle) {
        this.sidebarToggle.removeEventListener("click", this.toggleSidebar);
      }
      window.removeEventListener("resize", this.updateLayout);
      window.removeEventListener("popstate", this.setActiveNavItem);
      Object.keys(this).forEach((key) => {
        if (this[key] instanceof HTMLElement) {
          this[key] = null;
        }
      });
    }
  }

  if (typeof window.NavigationManager === "undefined")
    window.NavigationManager = NavigationManager;
  if (typeof window.TenantNavigationManager === "undefined")
    window.TenantNavigationManager = TenantNavigationManager;

  window.openMessage = (messageId) => {
    if (window.navigationManager) {
      window.navigationManager.openMessage(messageId);
    } else if (window.tenantNavigationManager) {
      window.tenantNavigationManager.openMessage(messageId);
    }
  };

  window.openProfileSettings = () => {
    if (window.navigationManager)
      window.navigationManager.openProfileSettings();
    else if (window.tenantNavigationManager)
      window.tenantNavigationManager.openProfileSettings();
  };

  window.openAccountSettings = () => {
    if (window.navigationManager)
      window.navigationManager.openAccountSettings();
    else if (window.tenantNavigationManager)
      window.tenantNavigationManager.openAccountSettings();
  };

  window.openPreferences = () => {
    if (window.navigationManager) window.navigationManager.openPreferences();
    else if (window.tenantNavigationManager)
      window.tenantNavigationManager.openPreferences();
  };

  window.openHelp = () => {
    if (window.navigationManager) window.navigationManager.openHelp();
    else if (window.tenantNavigationManager)
      window.tenantNavigationManager.openHelp();
  };

  window.logout = () => {
    if (window.navigationManager) window.navigationManager.logout();
    else if (window.tenantNavigationManager)
      window.tenantNavigationManager.logout();
  };

  window.setActivePageManually = function (pageName) {
    if (window.tenantNavigationManager)
      window.tenantNavigationManager.setActiveNavItem(pageName);
    else if (window.navigationManager)
      window.navigationManager.setActiveNavItem(pageName);
  };
})();

//#endregion
