// Navigation Components JavaScript
// Modular and reusable navigation functionality

class NavigationManager {
    constructor(config = {}) {
        this.config = {
            sidebarSelector: '#sidebar',
            toggleSelector: '#sidebarToggle',
            overlaySelector: '#overlay',
            topNavbarSelector: '.top-navbar',
            mainContentSelector: '.main-content',
            pageTitleSelector: '#pageTitle',
            searchInputSelector: '#searchInput',
            storageKey: 'adminSidebarCollapsed',
            ...config
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
        this.addKeyboardShortcuts();
        
        console.log('Navigation system initialized');
    }

    cacheDOMElements() {
        this.sidebar = document.querySelector(this.config.sidebarSelector);
        this.sidebarToggle = document.querySelector(this.config.toggleSelector);
        this.overlay = document.querySelector(this.config.overlaySelector);
        this.topNavbar = document.querySelector(this.config.topNavbarSelector);
        this.mainContent = document.querySelector(this.config.mainContentSelector);
        this.pageTitle = document.querySelector(this.config.pageTitleSelector);
        this.searchInput = document.querySelector(this.config.searchInputSelector);
        
        // Dropdown elements
        this.notificationBtn = document.getElementById('notificationBtn');
        this.notificationMenu = document.getElementById('notificationMenu');
        this.inboxBtn = document.getElementById('inboxBtn');
        this.inboxDropdown = document.getElementById('inboxDropdown');
        this.profileBtn = document.getElementById('profileBtn');
        this.profileMenu = document.getElementById('profileMenu');
    }

    setupPageTitles() {
        this.pageTitles = {
            // File-based mapping
            "adminDashboard.html": "Dashboard",
            "adminDashboard": "Dashboard",
            "propertyAdmin.html": "Properties",
            "propertyAdmin": "Properties",
            "tenants.html": "Tenants",
            "tenants": "Tenants",
            "leaseAdmin.html": "Leases",
            "leaseAdmin": "Leases",
            "paymentAdmin.html": "Payments",
            "paymentAdmin": "Payments",
            "maintenance.html": "Maintenance",
            "maintenance": "Maintenance",
            "messagesAdmin.html": "Messages",
            "messagesAdmin": "Messages",
            "documents.html": "Documents",
            "documents": "Documents",
            
            // Content Management pages - all show "Manage Content"
            "contentManagement.html": "Manage Content",
            "contentManagement": "Manage Content",
            "company-information.html": "Manage Content",
            "company-information": "Manage Content",
            "building-addresses.html": "Manage Content",
            "building-addresses": "Manage Content",
            "FAQs.html": "Manage Content",
            "FAQs": "Manage Content",
            "lease-terms-cms.html": "Manage Content",
            "lease-terms-cms": "Manage Content",

            // Data-page attribute mapping
            dashboard: 'Dashboard',
            propertyAdmin: 'Properties',
            tenants: 'Tenants',
            leases: 'Leases',
            payments: 'Payments',
            maintenance: 'Maintenance',
            messagesAdmin: 'Messages',
            documents: 'Documents',
            reports: 'Reports',
            content: 'Manage Content',

            // Default fallbacks
            index: 'Dashboard',
            "": 'Dashboard'
        };
    }

    getDefaultInboxMessages() {
        return [
            {
                id: 1,
                sender: "Tenant Support",
                subject: "Urgent: Water Leak in Unit 3B",
                preview: "Emergency maintenance request submitted. Tenant reports significant water leak in bathroom. Immediate response required to prevent property damage.",
                time: "15 minutes ago",
                unread: true,
                priority: "high"
            },
            {
                id: 2,
                sender: "Property Inspector",
                subject: "Monthly Inspection Report - Building A",
                preview: "Completed monthly safety inspection for Building A. Found minor issues with fire extinguishers on floors 2 and 4. Detailed report attached.",
                time: "2 hours ago",
                unread: true,
                priority: "medium"
            },
            {
                id: 3,
                sender: "Legal Department",
                subject: "Lease Agreement Updates Required",
                preview: "New city regulations require updates to standard lease agreements. Please review the attached amendments and implement by next month.",
                time: "1 day ago",
                unread: false,
                priority: "medium"
            },
            {
                id: 4,
                sender: "Accounting",
                subject: "Monthly Financial Summary",
                preview: "Revenue collection at 94% for the month. Three units pending payment follow-up. Overall property performance exceeding projections.",
                time: "2 days ago",
                unread: false,
                priority: "low"
            },
            {
                id: 5,
                sender: "Facilities Management",
                subject: "HVAC System Maintenance Scheduled",
                preview: "Annual HVAC maintenance scheduled for next week. All units will be notified 48 hours in advance. Expect temporary service interruptions.",
                time: "3 days ago",
                unread: false,
                priority: "medium"
            }
        ];
    }

    // === SIDEBAR MANAGEMENT ===
    
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
            // Mobile toggle icons
            if (this.sidebar.classList.contains("mobile-open")) {
                icon.className = "fas fa-times";
                this.sidebarToggle.title = "Close Menu";
            } else {
                icon.className = "fas fa-bars";
                this.sidebarToggle.title = "Open Menu";
            }
        } else {
            // Desktop toggle icons
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
            // Update top navbar position
            if (this.topNavbar) {
                this.topNavbar.style.left = this.isCollapsed ? "80px" : "280px";
            }
            
            // Update main content margin
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
            // Mobile layout
            if (this.sidebar) {
                this.sidebar.classList.remove("collapsed");
                this.sidebar.classList.remove("mobile-open");
            }
            if (this.overlay) {
                this.overlay.classList.remove("active");
            }
            
            // Reset positions for mobile
            if (this.topNavbar) {
                this.topNavbar.style.left = "0";
            }
            if (this.mainContent) {
                this.mainContent.style.marginLeft = "0";
                this.mainContent.classList.remove("sidebar-collapsed");
            }
        } else {
            // Desktop layout
            if (this.sidebar) {
                this.sidebar.classList.remove("mobile-open");
            }
            if (this.overlay) {
                this.overlay.classList.remove("active");
            }
            
            // Restore collapsed state on desktop
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

    // === PAGE TITLE MANAGEMENT ===
    
    updatePageTitle(page) {
        if (this.pageTitle && this.pageTitles[page]) {
            this.pageTitle.textContent = this.pageTitles[page];
            document.title = this.pageTitles[page] + " | Ambulo PMS";
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

        console.log('Current page detected:', currentPage);

        const navLinks = document.querySelectorAll(".nav-link");

        navLinks.forEach((link) => link.classList.remove("active"));

        // Check if current page is a content management page
        const contentManagementPages = [
            'contentManagement', 'company-information', 'building-addresses', 
            'FAQs', 'lease-terms-cms'
        ];
        
        const isContentPage = contentManagementPages.includes(currentPage);

        navLinks.forEach((link) => {
            const linkPage = link.getAttribute("data-page");
            const linkHref = link.getAttribute("href");
            let linkFileName = "";
            
            if (linkHref) {
                linkFileName = linkHref.split("/").pop().split(".")[0];
            }

            // Special handling for content management pages
            if (isContentPage && linkPage === "content") {
                link.classList.add("active");
                this.updatePageTitle("content");
                console.log('Set active nav item: content (detected content management page)');
                return;
            }

            if (
                linkPage === currentPage ||
                linkFileName === currentPage ||
                (currentPage === "adminDashboard" && linkPage === "dashboard") ||
                (currentPage === "propertyAdmin" && linkPage === "propertyAdmin") ||
                (currentPage === "index" && linkPage === "dashboard") ||
                (currentPage === "dashboard" && (linkPage === "dashboard" || linkFileName === "adminDashboard"))
            ) {
                link.classList.add("active");
                const pageKey = linkPage || linkFileName || currentPage;
                this.updatePageTitle(pageKey);
                console.log('Set active nav item:', pageKey);
            }
        });
    }

    // === INBOX FUNCTIONALITY ===
    
    populateInbox() {
        const inboxContent = document.getElementById('inboxContent');
        const inboxBadge = document.getElementById('inboxBadge');
        const messagesBadge = document.getElementById('messagesBadge');
        
        if (!inboxContent) return;
        
        const unreadCount = this.inboxMessages.filter(msg => msg.unread).length;
        
        // Update badges
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
                <div class="inbox-item ${message.unread ? 'unread' : ''}" onclick="window.navigationManager.openMessage(${message.id})">
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
        console.log(`Opening message: "${message.subject}" from ${message.sender}`);
        // Implement actual message opening logic here
    }

    // === DROPDOWN FUNCTIONALITY ===
    
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

    // === PROFILE FUNCTIONS ===
    
    openProfileSettings() {
        console.log('Opening profile settings...');
        this.closeAllDropdowns();
        // Implement profile settings logic
    }

    openAccountSettings() {
        console.log('Opening account settings...');
        this.closeAllDropdowns();
        // Implement account settings logic
    }

    openPreferences() {
        console.log('Opening preferences...');
        this.closeAllDropdowns();
        // Implement preferences logic
    }

    openHelp() {
        console.log('Opening help & support...');
        this.closeAllDropdowns();
        // Implement help logic
    }

    logout() {
        console.log('Logging out...');
        this.closeAllDropdowns();
        if (confirm('Are you sure you want to sign out?')) {
            // Implement logout logic
            console.log('Redirecting to login page...');
        }
    }

    // === EVENT BINDING ===
    
    bindEvents() {
        // Sidebar toggle
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener("click", (e) => this.toggleSidebar(e));
        }

        // Overlay click
        if (this.overlay) {
            this.overlay.addEventListener("click", () => this.closeMobileSidebar());
        }

        // Dropdown events
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

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown') && !e.target.closest('.inbox-dropdown')) {
                this.closeAllDropdowns();
            }
        });

        // Prevent dropdown menu clicks from closing the dropdown
        document.querySelectorAll('.dropdown-menu, .inbox-dropdown-menu').forEach(menu => {
            menu.addEventListener('click', (e) => e.stopPropagation());
        });

        // Search functionality
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                if (searchTerm) {
                    console.log('Searching for:', searchTerm);
                    // Implement search logic
                }
            });
        }

        // Navigation link handlers
        document.querySelectorAll(".nav-link").forEach((link) => {
            link.addEventListener("click", (e) => {
                if (link.getAttribute("href") === "#") {
                    e.preventDefault();
                }

                // Update active state
                document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
                link.classList.add("active");
                
                // Update page title
                const page = link.dataset.page || link.getAttribute("href").split("/").pop().split(".")[0];
                this.updatePageTitle(page);

                // Close mobile sidebar
                this.closeMobileSidebar();
            });
        });

        // Window events
        window.addEventListener("popstate", () => this.setActiveNavItem());
        window.addEventListener("resize", () => this.updateLayout());

        // Notification interactions
        setTimeout(() => {
            document.querySelectorAll('#notificationMenu .dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const titleElement = item.querySelector('.dropdown-item-title');
                    if (titleElement) {
                        console.log('Notification clicked:', titleElement.textContent);
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
            // Ctrl/Cmd + B to toggle sidebar
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
            
            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (this.searchInput) this.searchInput.focus();
            }
            
            // Escape to close dropdowns
            if (e.key === 'Escape') {
                this.closeAllDropdowns();
            }
        });
    }

    // === PUBLIC API METHODS ===
    
    // Method to load navigation components
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

    // Method to initialize navigation after components are loaded
    static async initializeNavigation(config = {}) {
        // Load components first
        const sidebarLoaded = await NavigationManager.loadComponent('/components/sidebarAdmin.html', 'sidebarContainer');
        const navbarLoaded = await NavigationManager.loadComponent('/components/top-navbarAdmin.html', 'navbarContainer');

        if (sidebarLoaded || navbarLoaded) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                window.navigationManager = new NavigationManager(config);
            }, 100);
        }
    }

    // Method to update navigation state
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

    // Method to add custom navigation items
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

        // Bind click event to new item
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

    // Method to remove navigation items
    removeNavItem(selector) {
        const item = document.querySelector(selector);
        if (item && item.closest('.nav-item')) {
            item.closest('.nav-item').remove();
        }
    }

    // Method to show/hide navigation elements
    toggleNavVisibility(selector, show) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = show ? '' : 'none';
        }
    }

    // Method to customize navigation appearance
    setNavigationTheme(theme) {
        const root = document.documentElement;
        
        if (theme.colors) {
            Object.entries(theme.colors).forEach(([key, value]) => {
                root.style.setProperty(`--${key}`, value);
            });
        }

        if (theme.sidebarWidth) {
            root.style.setProperty('--sidebar-width', theme.sidebarWidth);
        }

        if (theme.collapsedWidth) {
            root.style.setProperty('--sidebar-collapsed-width', theme.collapsedWidth);
        }
    }

    // Method to get current navigation state
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

    // Method to destroy navigation instance
    destroy() {
        // Remove event listeners
        if (this.sidebarToggle) {
            this.sidebarToggle.removeEventListener("click", this.toggleSidebar);
        }
        
        window.removeEventListener("resize", this.updateLayout);
        window.removeEventListener("popstate", this.setActiveNavItem);
        
        // Clear references
        Object.keys(this).forEach(key => {
            if (this[key] instanceof HTMLElement) {
                this[key] = null;
            }
        });
        
        console.log('Navigation instance destroyed');
    }
}

// Global functions for backward compatibility
window.openMessage = (messageId) => {
    if (window.navigationManager) {
        window.navigationManager.openMessage(messageId);
    }
};

window.openProfileSettings = () => {
    if (window.navigationManager) {
        window.navigationManager.openProfileSettings();
    }
};

window.openAccountSettings = () => {
    if (window.navigationManager) {
        window.navigationManager.openAccountSettings();
    }
};

window.openPreferences = () => {
    if (window.navigationManager) {
        window.navigationManager.openPreferences();
    }
};

window.openHelp = () => {
    if (window.navigationManager) {
        window.navigationManager.openHelp();
    }
};

window.logout = () => {
    if (window.navigationManager) {
        window.navigationManager.logout();
    }
};

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        NavigationManager.initializeNavigation();
    });
} else {
    NavigationManager.initializeNavigation();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationManager;
}

// AMD support
if (typeof define === 'function' && define.amd) {
    define([], function() {
        return NavigationManager;
    });
}