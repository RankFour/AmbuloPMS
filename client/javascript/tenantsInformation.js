        class TenantInformation {
            constructor() {
                this.profileCard = document.querySelector('.profile-card');
                this.profileHeader = document.querySelector('.profile-header');
                this.profileInfo = document.querySelector('.profile-info');
                this.profileStats = document.querySelector('.profile-stats');
                this.closeBtn = document.querySelector('.close-btn');
                this.sendMessageBtn = document.querySelector('.send-message-btn');
                this.navItems = document.querySelectorAll('.nav-item');
                this.contentSections = document.querySelectorAll('.content-section');
                this.notification = document.querySelector('.notification');
                
                this.init();
            }
            
            init() {
                this.handleResponsive();
                this.bindEvents();
                window.addEventListener('resize', () => this.handleResponsive());
            }
            
            handleResponsive() {
                const width = window.innerWidth;
                
                // Remove all responsive classes first
                this.profileCard.classList.remove('mobile', 'tablet');
                this.profileHeader.classList.remove('mobile');
                this.profileInfo.classList.remove('mobile');
                this.profileStats.classList.remove('mobile');
                
                if (width <= 480) {
                    // Mobile layout
                    this.profileCard.classList.add('mobile');
                    this.profileHeader.classList.add('mobile');
                    this.profileInfo.classList.add('mobile');
                    this.profileStats.classList.add('mobile');
                } else if (width <= 768) {
                    // Tablet layout
                    this.profileCard.classList.add('tablet');
                }
            }
            
            bindEvents() {
                // Close button functionality
                this.closeBtn.addEventListener('click', () => this.closeCard());
                
                // Send message button functionality
                this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
                
                // Navigation functionality
                this.navItems.forEach(item => {
                    item.addEventListener('click', (e) => this.switchTab(e));
                });
                
                // Phone number click tracking
                const phoneLink = document.querySelector('.user-phone');
                if (phoneLink) {
                    phoneLink.addEventListener('click', () => {
                        console.log('Phone number clicked');
                    });
                }
            }
            
            closeCard() {
                this.profileCard.classList.add('hidden');
                setTimeout(() => {
                    this.showNotification('Profile card closed');
                    // Reset the card state after a delay (for demo purposes)
                    setTimeout(() => {
                        this.profileCard.classList.remove('hidden');
                    }, 2000);
                }, 300);
            }
            
            sendMessage() {
                this.showNotification('Message sent successfully!');
                console.log('Sending message to Joshua Deputo');
                
                // In a real application, you would:
                // - Open a messaging interface
                // - Make an API call to send the message
                // - Navigate to a chat screen
            }
            
            switchTab(event) {
                const clickedTab = event.target;
                const targetTab = clickedTab.dataset.tab;
                
                // Remove active class from all nav items and content sections
                this.navItems.forEach(item => item.classList.remove('active'));
                this.contentSections.forEach(section => section.classList.remove('active'));
                
                // Add active class to clicked nav item
                clickedTab.classList.add('active');
                
                // Show corresponding content section
                const targetSection = document.getElementById(targetTab);
                if (targetSection) {
                    targetSection.classList.add('active');
                } else {
                    // Fallback to info section if target not found
                    document.getElementById('info').classList.add('active');
                }
                
                console.log(`Switched to ${targetTab} tab`);
            }
            
            showNotification(message) {
                this.notification.textContent = message;
                this.notification.classList.add('show');
                
                setTimeout(() => {
                    this.notification.classList.remove('show');
                }, 3000);
            }
        }
        
        // Initialize the tenant information when the page loads
        document.addEventListener('DOMContentLoaded', () => {
            new TenantInformation();
        });
        
        // Keyboard accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const profileCard = document.querySelector('.profile-card');
                if (profileCard && !profileCard.classList.contains('hidden')) {
                    profileCard.classList.add('hidden');
                }
            }
        });