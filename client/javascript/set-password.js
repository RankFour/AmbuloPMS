import fetchCompanyDetails from '../api/loadCompanyInfo.js';

const API_BASE_URL = '/api/v1/users';

function showAlert(msg, type='error') {
  const container = document.getElementById('alertContainer');
  container.innerHTML = `<div class="alert ${type}">${msg}</div>`;
}

function passwordStrong(p) {
  return /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p) && p.length >= 8;
}

async function init() {
  try {
    const params = new URLSearchParams(location.search);
    const email = params.get('email');
    const token = params.get('token');
    const intro = document.getElementById('introText');
    const currentGroup = document.getElementById('currentPasswordGroup');

    if (!email) {
      showAlert('Missing email parameter.', 'error');
      return;
    }

    if (token) {
      intro.textContent = 'Use this form to set your password and activate your account.';
    } else {
      intro.textContent = 'Enter your temporary password and choose a new one.';
      currentGroup.style.display = 'block';
    }

    const form = document.getElementById('setPasswordForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('newPassword').value.trim();
      const confirmPassword = document.getElementById('confirmPassword').value.trim();
      const currentPassword = document.getElementById('currentPassword').value.trim();

      if (newPassword !== confirmPassword) {
        showAlert('Passwords do not match', 'error');
        return;
      }
      if (!passwordStrong(newPassword)) {
        showAlert('Password must be 8+ chars with upper, lower, number & symbol.', 'error');
        return;
      }

      const payload = {
        email,
        new_password: newPassword,
      };
      if (token) payload.token = token;
      else payload.current_password = currentPassword;

      try {
        const res = await fetch(`${API_BASE_URL}/set-initial-password`, {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) {
          showAlert(data.message || 'Failed to set password', 'error');
          return;
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        showAlert('Password set successfully. Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
      } catch (err) {
        console.error(err);
        showAlert('Network error', 'error');
      }
    });

    try {
      const company = await fetchCompanyDetails();
      if (company && company[0]) {
        document.title = `${company[0].company_name || 'AmbuloPMS'} - Set Password`;
      }
    } catch(_){}
  } catch (e) {
    console.error('Init error', e);
    showAlert('Unexpected error', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
