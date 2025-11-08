        // Inline cookie + JWT helpers (removed external module dependency)
        function getCookie(name) {
            if (!document || !document.cookie) return null;
            const match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
            return match ? match[2] : null;
        }
        function getJwtToken() {
            const token = getCookie('token');
            if (!token) {
                // redirect to login if missing
                window.location.href = '/login.html';
                return null;
            }
            return token;
        }

        // Helpers to decode JWT
        function decodeJwt(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
                const json = atob(padded);
                return JSON.parse(json);
            } catch (_) { return null; }
        }

        async function loadProfileFromServer() {
            try {
                const token = getJwtToken();
                if (!token) return;
                const payload = decodeJwt(token);
                const userId = payload && payload.user_id;
                if (!userId) return;

                const res = await fetch(`/api/users/${userId}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to load profile');

                // Persist current user snapshot locally for later update calls
                try { localStorage.setItem('currentUser', JSON.stringify({
                    user_id: data.user_id,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    email: data.email,
                    phone_number: data.phone_number,
                    gender: data.gender,
                    avatar: data.avatar
                })); } catch(_) {}

                // Populate fields
                const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
                setVal('firstName', data.first_name || '');
                setVal('lastName', data.last_name || '');
                setVal('email', data.email || '');

                // Phone: split country code if possible
                const rawPhone = (data.phone_number || '').trim();
                const ccSelect = document.getElementById('phoneCountryCode');
                const phoneInput = document.getElementById('phone');
                if (rawPhone.startsWith('+')) {
                    const match = rawPhone.match(/^(\+\d{1,3})\s*(.*)$/);
                    if (match) {
                        if (ccSelect) ccSelect.value = match[1];
                        if (phoneInput) phoneInput.value = match[2] || '';
                    } else {
                        // Try to infer PH +63
                        if (rawPhone.startsWith('+63')) {
                            if (ccSelect) ccSelect.value = '+63';
                            if (phoneInput) phoneInput.value = rawPhone.replace('+63', '').trim();
                        } else {
                            if (phoneInput) phoneInput.value = rawPhone.replace(/^\+\d{1,3}/,'').trim();
                        }
                    }
                } else {
                    if (phoneInput) phoneInput.value = rawPhone;
                }

                // Gender
                if (data.gender) {
                    const g = String(data.gender).toLowerCase();
                    const male = document.querySelector('input[name="gender"][value="male"]');
                    const female = document.querySelector('input[name="gender"][value="female"]');
                    if (g === 'male' && male) male.checked = true;
                    if (g === 'female' && female) female.checked = true;
                }

                // Avatar
                if (data.avatar) {
                    const img = document.getElementById('avatarImg');
                    if (img) img.src = data.avatar;
                }

                // Tenant ID display
                const tenantIdInput = document.getElementById('tenantId');
                if (tenantIdInput) tenantIdInput.value = data.user_id || '';

                // Address (compose simple string if address object exists)
                let addressString = '';
                if (data.address) {
                    const a = data.address;
                    addressString = [a.house_no, a.street_address, a.city, a.province, a.zip_code, a.country]
                        .filter(Boolean)
                        .join(', ');
                }
                setVal('address', addressString);

            } catch (e) {
                console.error('Failed to load profile', e);
            }
        }

        window.addEventListener('DOMContentLoaded', loadProfileFromServer);

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

        async function confirmSaveProfile() {
            const firstName = document.getElementById('firstName');
            const lastName = document.getElementById('lastName');
            const email = document.getElementById('email');
            const phone = document.getElementById('phone');
            const address = document.getElementById('address');
            const tin = document.getElementById('tin');
            const gender = document.querySelector('input[name="gender"]:checked');

            closeDialog('saveDialog');

            // Assume current logged in user id stored in localStorage after auth
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (!user.user_id) {
                showToast('No user session found', 'error');
                return;
            }

            const payload = {
                first_name: firstName.value.trim(),
                last_name: lastName.value.trim(),
                email: email.value.trim(),
                phone_number: document.getElementById('phoneCountryCode').value + phone.value.trim(),
                gender: gender ? gender.value : null,
                tin: tin.value.trim() || undefined, // if not in backend will be ignored
                address: {
                    street_address: address.value.trim(),
                    city: '',
                    province: '',
                    country: 'Philippines'
                }
            };

            try {
                const res = await fetch(`/api/users/${user.user_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to update');
                showToast('Profile updated successfully!');
                // Update local cached user
                localStorage.setItem('currentUser', JSON.stringify({ ...user, first_name: payload.first_name, last_name: payload.last_name, email: payload.email, phone_number: payload.phone_number }));
            } catch (e) {
                console.error('Profile update error', e);
                showToast(e.message || 'Update failed', 'error');
            }
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

        async function confirmPasswordChange() {
            const currentPassword = document.getElementById('currentPassword');
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            closeDialog('passwordDialog');

            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (!user.user_id) {
                showToast('No user session found', 'error');
                return;
            }

            // Verify current password first (optional flow)
            try {
                const verifyRes = await fetch('/api/admin/verify-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: currentPassword.value })
                });
                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) throw new Error(verifyData.message || 'Invalid current password');
            } catch (e) {
                showToast(e.message || 'Current password incorrect', 'error');
                return;
            }

            try {
                const payload = { password: newPassword.value };
                const res = await fetch(`/api/users/${user.user_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to update password');
                showToast('Password updated successfully!');
                currentPassword.value = '';
                newPassword.value = '';
                confirmPassword.value = '';
            } catch (e) {
                console.error('Password update error', e);
                showToast(e.message || 'Password update failed', 'error');
            }
        }

        // Removed notification and 2FA functions (tabs/features deprecated)

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