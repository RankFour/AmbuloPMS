
async function setupTenantNavbar() {
     
    function getCookie(name) {
      if (!document || !document.cookie) return null;
      const match = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
      return match ? match[2] : null;
    }
    
    function getJwtToken() {
      const token = getCookie("token");
    
      if (!token) {
        window.location.href = "/login.html";
      }

      return token;
    }

    function normalize(obj) {
        if (!obj || typeof obj !== 'object') return null;
         
        const candidate = obj.user || obj.data || obj;
         
        const name = candidate.name
            || candidate.fullName
            || ((candidate.first_name || candidate.firstName) && (candidate.last_name || candidate.lastName)
                ? `${candidate.first_name || candidate.firstName} ${candidate.last_name || candidate.lastName}`
                : null)
            || candidate.username
            || candidate.email
            || null;
        if (!name) return null;
        const initial = (name && name[0]) ? name[0].toUpperCase() : '';
        const role = candidate.role || candidate.userRole || candidate.user_role || 'Tenant';
        const unit = candidate.unit || candidate.unitNumber || candidate.apartment || candidate.user_unit || '';
         
        const avatarUrl = candidate.avatar || candidate.avatarUrl || candidate.photo || candidate.profile_image || null;
        return { name, initial, role, unit, avatarUrl };
    }

    async function tryFetch(url, extraHeaders = {}) {
        try {
            const res = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json', ...extraHeaders }
            });
            if (!res.ok) return null;
             
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const json = await res.json();
                return normalize(json);
            } else {
                 
                return null;
            }
        } catch (e) {
            console.warn('Fetch error for', url, e);
            return null;
        }
    }
                const contactSubmissionsMenuItem = document.getElementById('contactSubmissionsMenuItem');
                if (contactSubmissionsMenuItem) contactSubmissionsMenuItem.style.display = 'none';

    function decodeJwtPayload(token) {
        try {
            const parts = token.split('.');
            if (parts.length < 2) return null;
            let payload = parts[1];
            payload = payload.replace(/-/g, '+').replace(/_/g, '/');
            while (payload.length % 4) payload += '=';
            const json = atob(payload);
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
                const contactSubmissionsMenuItem = document.getElementById('contactSubmissionsMenuItem');
                if (contactSubmissionsMenuItem) contactSubmissionsMenuItem.style.display = 'none';
    }

    let user = null;
    try {
        const token = getJwtToken();
        ('[TenantNavbar] JWT token:', token);
        const payload = decodeJwtPayload(token);
        ('[TenantNavbar] Decoded JWT payload:', payload);
        const userId = payload && (payload.user_id || payload.userId || payload.id);
        ('[TenantNavbar] Extracted userId:', userId);
        if (userId) {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            user = await tryFetch(`/api/v1/users/${encodeURIComponent(userId)}`, headers);
            ('[TenantNavbar] Fetched user object:', user);
        }
    } catch (e) {
        console.warn('JWT decode or user fetch error', e);
    }
    if (!user) {
        ('[TenantNavbar] No user found, clearing DOM fields.');
    }

    const profileBtn = document.getElementById('profileBtn');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRole');
    const viewAllMessagesBtn = document.getElementById('viewAllMessagesBtn');

    if (user) {
        if (profileBtn) {
            if (user.avatarUrl) {
                profileBtn.style.backgroundImage = `url('${user.avatarUrl}')`;
                profileBtn.style.backgroundSize = 'cover';
                profileBtn.style.backgroundPosition = 'center';
                profileBtn.textContent = '';
            } else {
                profileBtn.style.backgroundImage = '';
                profileBtn.textContent = user.initial || (user.name && user.name[0]) || '';
            }
            profileBtn.title = user.name || '';
        }

        if (profileAvatar) {
            if (user.avatarUrl) {
                profileAvatar.style.backgroundImage = `url('${user.avatarUrl}')`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
                profileAvatar.textContent = '';
            } else {
                profileAvatar.style.backgroundImage = '';
                profileAvatar.textContent = user.initial || (user.name && user.name[0]) || '';
            }
        }

        if (profileName) {
            profileName.textContent = user.name || '';
        }

        if (profileRole) {
            const parts = [];
            if (user.role) parts.push(user.role);
            if (user.unit) parts.push(user.unit);
            profileRole.textContent = parts.join(' • ');
        }

        if (viewAllMessagesBtn) viewAllMessagesBtn.href = '/messages.html';

        window.currentTenantUser = user;
    } else {
        if (profileBtn) {
            profileBtn.style.backgroundImage = '';
            profileBtn.textContent = '';
        }
        if (profileAvatar) {
            profileAvatar.style.backgroundImage = '';
            profileAvatar.textContent = '';
        }
        if (profileName) profileName.textContent = '';
        if (profileRole) profileRole.textContent = '';
        if (viewAllMessagesBtn) viewAllMessagesBtn.href = '#';
        window.currentTenantUser = null;
    }
}

function setupSidebar(role) {
    const sidebarNav = document.getElementById('sidebarNav');
    if (!sidebarNav) return;

    let links = [];
    if (role === 'tenant') {
        links = [
            { href: '/tenantDashboard.html', icon: 'fas fa-chart-line', text: 'Dashboard', page: 'dashboard' },
            { href: '/messages.html', icon: 'fa-solid fa-envelope', text: 'Messages', page: 'messages' },
            { section: 'Lease', isSection: true },
            { href: '/leaseTenant.html', icon: 'fas fa-file-contract', text: 'Lease Information', page: 'leaseTenant' },
            { section: 'Payments', isSection: true },
            { href: '/paymentTenant.html', icon: 'fas fa-credit-card', text: 'Payments', page: 'paymentTenant' },
            { section: 'Requests', isSection: true },
            { href: '/maintenanceTenant.html', icon: 'fas fa-tools', text: 'Maintenance', page: 'maintenanceTenant' },
        ];
    }

    sidebarNav.innerHTML = links.map(link => {
        if (link.isSection) {
            return `<div class="nav-section"><div class="nav-section-title">${link.section}</div></div>`;
        }
        return `
            <div class="nav-item">
                <a href="${link.href}" class="nav-link" data-tooltip="${link.text}" data-page="${link.page}">
                    <div class="nav-icon"><i class="${link.icon}"></i></div>
                    <span class="nav-text">${link.text}</span>
                </a>
            </div>
        `;
    }).join('');
}

class TenantNavigationManager {
    constructor(config = {}) {
        this.config = {
            sidebarSelector: '#sidebar',
            toggleSelector: '#sidebarToggle',
            overlaySelector: '#overlay',
            topNavbarSelector: '.top-navbar',
            mainContentSelector: '.main-content',
            pageTitleSelector: '#pageTitle',
            searchInputSelector: '#searchInput',
            storageKey: 'tenantSidebarCollapsed',
            startCollapsed: true,
            ...config
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
        } catch (e) {
             
        }
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
        this.addKeyboardShortcuts();
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
        this.mainContent = document.querySelector(this.config.mainContentSelector);
        this.pageTitle = document.querySelector(this.config.pageTitleSelector);
        this.pageIcon = document.getElementById('pageIcon');
        this.pageDescription = document.getElementById('pageDescription');
        this.searchInput = document.querySelector(this.config.searchInputSelector);

        this.notificationBtn = document.getElementById('notificationBtn');
        this.notificationMenu = document.getElementById('notificationMenu');
        this.inboxBtn = document.getElementById('inboxBtn');
        this.inboxDropdown = document.getElementById('inboxDropdown');
        this.profileBtn = document.getElementById('profileBtn');
        this.profileMenu = document.getElementById('profileMenu');
    }

    setupPageTitles() {
        this.pageTitles = {
            "tenantDashboard.html": "Dashboard",
            "tenantDashboard": "Dashboard",
            "leaseTenant.html": "Lease Information",
            "leaseTenant": "Lease Information",
            "paymentTenant.html": "Payments",
            "paymentTenant": "Payments",
            "maintenanceTenant.html": "Maintenance Requests",
            "maintenanceTenant": "Maintenance Requests",
            "messages.html": "Messages",
            "messages": "Messages",

            dashboard: 'Dashboard',
            leaseTenant: 'Lease Information',
            paymentTenant: 'Payments',
            maintenanceTenant: 'Maintenance Requests',
            messages: 'Messages',
            support: 'Support',

            index: 'Dashboard',
            "": 'Dashboard'
        };

        this.pageIcons = {
            "tenantDashboard.html": "fas fa-chart-line",
            "tenantDashboard": "fas fa-chart-line",
            "leaseTenant.html": "fas fa-file-contract",
            "leaseTenant": "fas fa-file-contract",
            "paymentTenant.html": "fas fa-credit-card",
            "paymentTenant": "fas fa-credit-card",
            "maintenanceTenant.html": "fas fa-tools",
            "maintenanceTenant": "fas fa-tools",
            "messages.html": "fas fa-envelope",
            "messages": "fas fa-envelope",

            dashboard: 'fas fa-chart-line',
            leaseTenant: 'fas fa-file-contract',
            paymentTenant: 'fas fa-credit-card',
            maintenanceTenant: 'fas fa-tools',
            messages: 'fas fa-envelope',
            support: 'fas fa-question-circle',

            index: 'fas fa-chart-line',
            "": 'fas fa-chart-line'
        };

        this.pageDescriptions = {
            "tenantDashboard.html": "Overview of your rental activity, important notifications, and quick access to key features",
            "tenantDashboard": "Overview of your rental activity, important notifications, and quick access to key features",
            "leaseTenant.html": "View your lease agreement details, terms, and important rental information",
            "leaseTenant": "View your lease agreement details, terms, and important rental information",
            "paymentTenant.html": "Manage your rent payments, view payment history, and set up automatic payments",
            "paymentTenant": "Manage your rent payments, view payment history, and set up automatic payments",
            "maintenanceTenant.html": "Submit maintenance requests and track the status of your service tickets",
            "maintenanceTenant": "Submit maintenance requests and track the status of your service tickets",
            "messages.html": "Communicate with property management and stay updated on important announcements",
            "messages": "Communicate with property management and stay updated on important announcements",

            dashboard: 'Overview of your rental activity, important notifications, and quick access to key features',
            leaseTenant: 'View your lease agreement details, terms, and important rental information',
            paymentTenant: 'Manage your rent payments, view payment history, and set up automatic payments',
            maintenanceTenant: 'Submit maintenance requests and track the status of your service tickets',
            messages: 'Communicate with property management and stay updated on important announcements',
            support: 'Get help and support for any questions or issues you may have',

            index: 'Overview of your rental activity, important notifications, and quick access to key features',
            "": 'Overview of your rental activity, important notifications, and quick access to key features'
        };
    }

    getDefaultInboxMessages() {
        return [
            {
                id: 1,
                sender: "Property Manager",
                subject: "Monthly Rent Reminder",
                preview: "Your rent payment for this month is due on the 30th. Please ensure timely payment to avoid late fees and maintain your good standing with the property.",
                time: "2 hours ago",
                unread: true,
                priority: "high"
            },
            {
                id: 2,
                sender: "Maintenance Team",
                subject: "Work Order #2024-0156 Completed",
                preview: "The plumbing issue in your apartment has been successfully resolved. Our certified technician completed the work and performed quality checks to ensure everything is functioning properly.",
                time: "1 day ago",
                unread: true,
                priority: "medium"
            },
            {
                id: 3,
                sender: "Ambulo Properties",
                subject: "Lease Renewal Opportunity",
                preview: "Your lease agreement is set to expire in 60 days. We would like to discuss renewal options and updated terms. Please contact us at your earliest convenience.",
                time: "3 days ago",
                unread: false,
                priority: "medium"
            },
            {
                id: 4,
                sender: "Community Manager",
                subject: "Exciting Building Amenity Updates",
                preview: "We're excited to announce new premium amenities coming to your building including a state-of-the-art fitness center, rooftop garden, and co-working spaces.",
                time: "1 week ago",
                unread: false,
                priority: "low"
            },
            {
                id: 5,
                sender: "Security Office",
                subject: "Package Delivery Notification",
                preview: "A package has been delivered to your unit and is currently being held at the front desk. Please bring a valid ID to collect your delivery during office hours.",
                time: "2 weeks ago",
                unread: false,
                priority: "medium"
            }
        ];
    }

    //#region Sidebar State Persistence

    saveCollapsedState() {
        try {
            if (!this.isMobile) {
                localStorage.setItem(this.config.storageKey, this.isCollapsed.toString());
            }
        } catch (e) {
            console.warn("localStorage not available, sidebar state will not persist");
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
                this.mainContent.style.marginLeft = this.isCollapsed ? "80px" : "280px";
                this.mainContent.classList.toggle("sidebar-collapsed", this.isCollapsed);
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
            this.sidebarToggle.classList.add('hover-effect');
            setTimeout(() => {
                this.sidebarToggle.classList.remove('hover-effect');
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
            if (currentPage.includes('.')) {
                currentPage = currentPage.split(".")[0];
            }
            if (!currentPage || currentPage === 'index') {
                currentPage = 'dashboard';
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
                (currentPage === "dashboard" && (linkPage === "dashboard" || linkFileName === "tenantDashboard"))
            ) {
                link.classList.add("active");
                const pageKey = linkPage || linkFileName || currentPage;
                this.updatePageTitle(pageKey);
            }
        });
    }
    //#endregion

    //#region INBOX
    populateInbox() {
        const inboxContent = document.getElementById('inboxContent');
        const inboxBadge = document.getElementById('inboxBadge');
        const messagesBadge = document.getElementById('messagesBadge');

        if (!inboxContent) return;

        const unreadCount = this.inboxMessages.filter(msg => msg.unread).length;

        if (inboxBadge) {
            if (unreadCount > 0) {
                inboxBadge.textContent = `${unreadCount} New`;
                if (messagesBadge) {
                    messagesBadge.textContent = unreadCount;
                    messagesBadge.style.display = 'flex';
                }
            } else {
                inboxBadge.textContent = 'All Read';
                if (messagesBadge) {
                    messagesBadge.style.display = 'none';
                }
            }
        }

        if (this.inboxMessages.length === 0) {
            inboxContent.innerHTML = `
                <div class="empty-inbox">
                    <div class="empty-inbox-icon">📭</div>
                    <div class="empty-inbox-text">No messages yet</div>
                    <div class="empty-inbox-subtext">You're all caught up!</div>
                </div>
            `;
        } else {
            inboxContent.innerHTML = this.inboxMessages.map(message => `
                <div class="inbox-item ${message.unread ? 'unread' : ''}" onclick="window.tenantNavigationManager.openMessage(${message.id})">
                    <div class="inbox-item-header">
                        <div class="inbox-sender-section">
                            <span class="inbox-sender">${message.sender}</span>
                            ${message.priority ? `<div class="inbox-priority ${message.priority}"></div>` : ''}
                        </div>
                        <span class="inbox-time">${message.time}</span>
                    </div>
                    <div class="inbox-subject">${message.subject}</div>
                    <div class="inbox-preview">${message.preview}</div>
                </div>
            `).join('');
        }
    }

    openMessage(messageId) {
        const message = this.inboxMessages.find(msg => msg.id === messageId);
        if (message && message.unread) {
            message.unread = false;
            this.populateInbox();
        }

    }
    //#endregion

    toggleDropdown(menu, button) {
        if (!menu) return;

        document.querySelectorAll('.dropdown-menu, .inbox-dropdown-menu').forEach(dropdown => {
            if (dropdown !== menu) {
                dropdown.classList.remove('show', 'active');
            }
        });

        if (menu.classList.contains('inbox-dropdown-menu')) {
            menu.classList.toggle('active');
        } else {
            menu.classList.toggle('show');
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.dropdown-menu, .inbox-dropdown-menu').forEach(dropdown => {
            dropdown.classList.remove('show', 'active');
        });
    }

    //#region PROFILE MENU ACTIONS
    openProfileSettings() {
        this.closeAllDropdowns();
        alert('Profile settings would open here');
    }

    openAccountSettings() {
        alert('Account settings would open here');
        this.closeAllDropdowns();
    }

    openPreferences() {
        this.closeAllDropdowns();
        alert('Preferences would open here');
    }

    openHelp() {
        this.closeAllDropdowns();
        alert('Help & Support would open here');
    }

    logout() {
        this.closeAllDropdowns();
        if (confirm('Are you sure you want to sign out?')) {
            localStorage.clear();
            sessionStorage.clear();

            fetch('/api/v1/users/logout', { method: 'POST', credentials: 'include' })
                .finally(() => {
                    window.location.href = "/login.html";
                });
        }
    }
    //#endregion


    bindEvents() {
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener("click", (e) => this.toggleSidebar(e));
        }

        if (this.overlay) {
            this.overlay.addEventListener("click", () => this.closeMobileSidebar());
        }

        if (this.notificationBtn && this.notificationMenu) {
            this.notificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(this.notificationMenu, this.notificationBtn);
            });
        }

        if (this.inboxBtn && this.inboxDropdown) {
            this.inboxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(this.inboxDropdown, this.inboxBtn);
            });
        }

        if (this.profileBtn && this.profileMenu) {
            this.profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(this.profileMenu, this.profileBtn);
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown') && !e.target.closest('.inbox-dropdown')) {
                this.closeAllDropdowns();
            }
        });

        document.querySelectorAll('.dropdown-menu, .inbox-dropdown-menu').forEach(menu => {
            menu.addEventListener('click', (e) => e.stopPropagation());
        });

        document.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", (e) => {
                if (link.getAttribute("href") === "#") {
                    e.preventDefault();
                }

                document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
                link.classList.add("active");

                const page = link.dataset.page || link.getAttribute("href").split("/").pop().split(".")[0];
                this.updatePageTitle(page);

                this.closeMobileSidebar();
            });
        });

        window.addEventListener("popstate", () => this.setActiveNavItem());
        window.addEventListener("resize", () => this.updateLayout());

        setTimeout(() => {
            document.querySelectorAll('#notificationMenu .dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const titleElement = item.querySelector('.dropdown-item-title');
                    if (titleElement) {
                    }
                    item.style.opacity = '0.7';

                    const badge = document.getElementById('notificationBadge');
                    if (badge) {
                        let count = parseInt(badge.textContent);
                        if (count > 0) {
                            count--;
                            badge.textContent = count;
                            if (count === 0) {
                                badge.style.display = 'none';
                                const subtitle = document.querySelector('#notificationMenu .dropdown-subtitle');
                                if (subtitle) {
                                    subtitle.textContent = 'No unread notifications';
                                }
                            }
                        }
                    }
                });
            });
        }, 100);
    }

    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (this.searchInput) this.searchInput.focus();
            }

            if (e.key === 'Escape') {
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
            console.error(`Error loading tenant component from ${componentPath}:`, error);
            return false;
        }
    }

    static async initializeTenantNavigation(config = {}) {
        const sidebarLoaded = await TenantNavigationManager.loadComponent('/components/sidebar.html', 'sidebarContainer');
        const navbarLoaded = await TenantNavigationManager.loadComponent('/components/top-navbar.html', 'navbarContainer');
    
        if (sidebarLoaded || navbarLoaded) {
            setTimeout(async () => {
                window.tenantNavigationManager = new TenantNavigationManager(config);
                await setupTenantNavbar();
                setupSidebar('tenant');
                window.tenantNavigationManager.setActiveNavItem();
    
                const mobileSidebarOpenBtn = document.getElementById('mobileSidebarOpenBtn');
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('overlay');
                if (mobileSidebarOpenBtn && sidebar && overlay) {
                    mobileSidebarOpenBtn.addEventListener('click', function() {
                        sidebar.classList.add('mobile-open');
                        overlay.classList.add('active');
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
        const navContainer = document.querySelector('.sidebar-nav');
        if (!navContainer) return;

        const navItem = document.createElement('div');
        navItem.className = 'nav-item';
        navItem.innerHTML = `
            <a href="${item.href || '#'}" class="nav-link" data-tooltip="${item.tooltip || item.text}" data-page="${item.page || ''}">
                <div class="nav-icon"><i class="${item.icon || 'fas fa-circle'}"></i></div>
                <span class="nav-text">${item.text}</span>
            </a>
        `;

        if (item.section) {
            const section = navContainer.querySelector(`[data-section="${item.section}"]`);
            if (section) {
                section.parentNode.insertBefore(navItem, section.nextSibling);
            } else {
                navContainer.appendChild(navItem);
            }
        } else {
            navContainer.appendChild(navItem);
        }

        const link = navItem.querySelector('.nav-link');
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === '#') {
                e.preventDefault();
            }
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const page = link.dataset.page || link.getAttribute('href').split('/').pop().split('.')[0];
            this.updatePageTitle(page);
            this.closeMobileSidebar();
        });
    }

    getNavigationState() {
        return {
            isCollapsed: this.isCollapsed,
            isMobile: this.isMobile,
            currentPage: this.getCurrentPage(),
            unreadMessages: this.inboxMessages.filter(msg => msg.unread).length
        };
    }

    getCurrentPage() {
        const activeLink = document.querySelector('.nav-link.active');
        return activeLink ? activeLink.dataset.page : null;
    }

    destroy() {
        if (this.sidebarToggle) {
            this.sidebarToggle.removeEventListener("click", this.toggleSidebar);
        }

        window.removeEventListener("resize", this.updateLayout);
        window.removeEventListener("popstate", this.setActiveNavItem);

        Object.keys(this).forEach(key => {
            if (this[key] instanceof HTMLElement) {
                this[key] = null;
            }
        });
    }
}

window.openMessage = (messageId) => {
    if (window.tenantNavigationManager) {
        window.tenantNavigationManager.openMessage(messageId);
    }
};

window.openProfileSettings = () => {
    if (window.tenantNavigationManager) {
        window.tenantNavigationManager.openProfileSettings();
    }
};

window.openAccountSettings = () => {
    if (window.tenantNavigationManager) {
        window.tenantNavigationManager.openAccountSettings();
    }
};

window.openPreferences = () => {
    if (window.tenantNavigationManager) {
        window.tenantNavigationManager.openPreferences();
    }
};

window.openHelp = () => {
    if (window.tenantNavigationManager) {
        window.tenantNavigationManager.openHelp();
    }
};

window.logout = () => {
    if (window.tenantNavigationManager) {
        window.tenantNavigationManager.logout();
    }
};

window.setActivePageManually = function (pageName) {
    if (window.tenantNavigationManager) {
        window.tenantNavigationManager.setActiveNavItem(pageName);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        TenantNavigationManager.initializeTenantNavigation();
    });
} else {
    TenantNavigationManager.initializeTenantNavigation();
}
