        // Tab switching functionality
        const tabs = document.querySelectorAll('.tab-item');
        const sections = document.querySelectorAll('.content-section');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetSection = tab.getAttribute('data-section');
                
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(targetSection).classList.add('active');
            });
        });

        // Avatar upload functionality
        document.getElementById('fileInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5000000) {
                    showToast('File size must be less than 5MB', 'error');
                    return;
                }
                
                if (!file.type.startsWith('image/')) {
                    showToast('Please select a valid image file', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('avatarImg').src = e.target.result;
                    showToast('Profile picture updated successfully!');
                };
                reader.readAsDataURL(file);
            }
        });

        function deleteAvatar() {
            openDialog('deleteDialog');
        }

        function confirmDeleteAvatar() {
            document.getElementById('avatarImg').src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop';
            document.getElementById('fileInput').value = '';
            closeDialog('deleteDialog');
            showToast('Profile picture removed', 'error');
        }

        // Dialog functions
        function openDialog(dialogId) {
            const dialog = document.getElementById(dialogId);
            dialog.classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeDialog(dialogId) {
            const dialog = document.getElementById(dialogId);
            dialog.classList.remove('show');
            document.body.style.overflow = '';
        }

        // Close dialog when clicking outside
        document.querySelectorAll('.dialog-overlay').forEach(overlay => {
            overlay.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeDialog(this.id);
                }
            });
        });

        // Close dialog with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.dialog-overlay.show').forEach(dialog => {
                    closeDialog(dialog.id);
                });
            }
        });

        // Password toggle functionality
        function togglePassword(fieldId) {
            const field = document.getElementById(fieldId);
            const button = event.currentTarget;
            const svg = button.querySelector('svg');
            
            if (field.getAttribute('type') === 'password') {
                field.setAttribute('type', 'text');
                // Change to "eye-off" icon
                svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
            } else {
                field.setAttribute('type', 'password');
                // Change back to "eye" icon
                svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        }

        // Profile form validation and submission
        document.getElementById('profileForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            let isValid = true;
            
            // Clear previous errors
            document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
            document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
            
            // Validate first name
            const firstName = document.getElementById('firstName');
            if (firstName.value.trim() === '') {
                document.getElementById('firstNameError').textContent = 'First name is required';
                firstName.classList.add('error');
                isValid = false;
            } else if (firstName.value.trim().length < 2) {
                document.getElementById('firstNameError').textContent = 'First name must be at least 2 characters';
                firstName.classList.add('error');
                isValid = false;
            }
            
            // Validate last name
            const lastName = document.getElementById('lastName');
            if (lastName.value.trim() === '') {
                document.getElementById('lastNameError').textContent = 'Last name is required';
                lastName.classList.add('error');
                isValid = false;
            } else if (lastName.value.trim().length < 2) {
                document.getElementById('lastNameError').textContent = 'Last name must be at least 2 characters';
                lastName.classList.add('error');
                isValid = false;
            }
            
            // Validate email
            const email = document.getElementById('email');
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email.value)) {
                document.getElementById('emailError').textContent = 'Please enter a valid email';
                email.classList.add('error');
                isValid = false;
            }
            
            // Validate phone
            const phone = document.getElementById('phone');
            if (phone.value.trim() === '') {
                document.getElementById('phoneError').textContent = 'Phone number is required';
                phone.classList.add('error');
                isValid = false;
            } else if (phone.value.trim().length < 7) {
                document.getElementById('phoneError').textContent = 'Please enter a valid phone number';
                phone.classList.add('error');
                isValid = false;
            }
            
            // Validate address
            const address = document.getElementById('address');
            if (address.value.trim() === '') {
                document.getElementById('addressError').textContent = 'Address is required';
                address.classList.add('error');
                isValid = false;
            }
            
            if (isValid) {
                openDialog('saveDialog');
            } else {
                showToast('Please fix the errors in the form', 'error');
            }
        });

        function confirmSaveProfile() {
            const firstName = document.getElementById('firstName');
            const lastName = document.getElementById('lastName');
            const email = document.getElementById('email');
            const phone = document.getElementById('phone');
            const address = document.getElementById('address');
            
            closeDialog('saveDialog');
            showToast('Profile updated successfully!');
            
            // Here you would typically send data to server
            console.log('Form data:', {
                firstName: firstName.value,
                lastName: lastName.value,
                email: email.value,
                phone: document.getElementById('phoneCountryCode').value + phone.value,
                gender: document.querySelector('input[name="gender"]:checked').value,
                tin: document.getElementById('tin').value,
                address: address.value
            });
        }

        // Password form validation and submission
        document.getElementById('passwordForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            let isValid = true;
            
            // Clear previous errors
            document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
            document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
            
            const currentPassword = document.getElementById('currentPassword');
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            
            // Validate current password
            if (currentPassword.value.trim() === '') {
                document.getElementById('currentPasswordError').textContent = 'Current password is required';
                currentPassword.classList.add('error');
                isValid = false;
            }
            
            // Validate new password
            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
            if (!passwordPattern.test(newPassword.value)) {
                document.getElementById('newPasswordError').textContent = 'Password must be at least 8 characters with uppercase, lowercase, and numbers';
                newPassword.classList.add('error');
                isValid = false;
            }
            
            // Check if new password is same as current
            if (newPassword.value && currentPassword.value && newPassword.value === currentPassword.value) {
                document.getElementById('newPasswordError').textContent = 'New password must be different from current password';
                newPassword.classList.add('error');
                isValid = false;
            }
            
            // Validate password match
            if (newPassword.value !== confirmPassword.value) {
                document.getElementById('confirmPasswordError').textContent = 'Passwords do not match';
                confirmPassword.classList.add('error');
                isValid = false;
            }
            
            if (isValid) {
                openDialog('passwordDialog');
            } else {
                showToast('Please fix the errors in the form', 'error');
            }
        });

        function confirmPasswordChange() {
            const currentPassword = document.getElementById('currentPassword');
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            
            closeDialog('passwordDialog');
            showToast('Password updated successfully!');
            
            // Clear form
            currentPassword.value = '';
            newPassword.value = '';
            confirmPassword.value = '';
            
            // Here you would typically send data to server
            console.log('Password change requested');
        }

        // Notification toggle functionality
        function toggleNotification(element) {
            element.classList.toggle('active');
            const isActive = element.classList.contains('active');
            const notificationName = element.previousElementSibling.querySelector('h4').textContent;
            showToast(isActive ? `${notificationName} enabled` : `${notificationName} disabled`);
            
            // Here you would typically save preference to server
            console.log('Notification toggled:', notificationName, isActive);
        }

        // 2FA enable functionality
        function enable2FA() {
            showToast('2FA setup initiated. Check your email for instructions.');
            // Here you would typically initiate 2FA setup process
            console.log('2FA setup initiated');
        }

        // Toast notification
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast show';
            
            if (type === 'error') {
                toast.classList.add('error');
            }
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Real-time validation feedback
        document.getElementById('email').addEventListener('blur', function() {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (this.value && !emailPattern.test(this.value)) {
                this.classList.add('error');
                document.getElementById('emailError').textContent = 'Please enter a valid email';
            } else {
                this.classList.remove('error');
                document.getElementById('emailError').textContent = '';
            }
        });

        document.getElementById('newPassword').addEventListener('input', function() {
            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
            if (this.value && !passwordPattern.test(this.value)) {
                this.classList.add('error');
            } else {
                this.classList.remove('error');
            }
        });