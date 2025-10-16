const API_URL = 'http://localhost:5000/api';
let currentEmail = '';

// Step 1: Email Form - Send Reset Link
document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const alert = document.getElementById('step1Alert');
    const btn = document.getElementById('emailBtn');
    
    currentEmail = email;
    hideAlert(alert);
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Email...';
    
    try {
        const response = await fetch(`${API_URL}/reset-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('userEmailDisplay').textContent = currentEmail;
            switchStep('step1', 'step2');
        } else {
            showAlert(alert, data.error || 'Failed to send reset email. Please try again.', 'error');
        }
    } catch (error) {
        showAlert(alert, 'Connection error. Please check your internet and try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send Reset Link <i class="fas fa-paper-plane"></i>';
    }
});

// Step 3: Reset Password Form
document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = document.getElementById('resetToken').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorAlert = document.getElementById('step3Alert');
    const successAlert = document.getElementById('step3Success');
    const btn = document.getElementById('resetBtn');
    
    hideAlert(errorAlert);
    hideAlert(successAlert);
    
    if (newPassword !== confirmPassword) {
        showAlert(errorAlert, 'Passwords do not match!', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showAlert(errorAlert, 'Password must be at least 8 characters long!', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting Password...';
    
    try {
        const response = await fetch(`${API_URL}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: token, 
                password: newPassword 
            })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert(successAlert, 'Password reset successfully! Redirecting to login...', 'success');
            document.getElementById('resetPasswordForm').reset();
            document.getElementById('strengthBar').className = 'password-strength-bar';
            document.getElementById('passwordHint').textContent = 'Password must be at least 8 characters';
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
        } else {
            showAlert(errorAlert, data.error || 'Password reset failed. Please try again.', 'error');
        }
    } catch (error) {
        showAlert(errorAlert, 'Connection error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Reset Password';
    }
});

// Password Strength Indicator
document.getElementById('newPassword').addEventListener('input', function() {
    const password = this.value;
    const bar = document.getElementById('strengthBar');
    const hint = document.getElementById('passwordHint');
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    bar.className = 'password-strength-bar';
    
    if (strength <= 1) {
        bar.classList.add('weak');
        hint.textContent = 'Weak password';
        hint.style.color = '#ef4444';
    } else if (strength <= 3) {
        bar.classList.add('medium');
        hint.textContent = 'Medium strength password';
        hint.style.color = '#f59e0b';
    } else {
        bar.classList.add('strong');
        hint.textContent = 'Strong password!';
        hint.style.color = '#10b981';
    }
});

function switchStep(fromStep, toStep) {
    document.getElementById(fromStep).classList.remove('active');
    document.getElementById(toStep).classList.add('active');
}

function showAlert(element, message, type) {
    const icon = type === 'error' ? 'fa-exclamation-circle' : 
                type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    element.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    element.className = `alert alert-${type} show`;
}

function hideAlert(element) {
    element.className = 'alert';
    element.innerHTML = '';
}

function resetForm() {
    switchStep('step2', 'step1');
    document.getElementById('emailForm').reset();
    currentEmail = '';
    hideAlert(document.getElementById('step1Alert'));
}

// Check URL for reset token
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        document.getElementById('step1').classList.remove('active');
        document.getElementById('step3').classList.add('active');
        document.getElementById('resetToken').value = token;
    }
});