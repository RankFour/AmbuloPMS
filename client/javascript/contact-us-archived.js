const API_BASE_URL = '/api/v1';
let archived = [];
let archFiltered = [];
let archCurrentPage = 1;
let archPageLimit = 10;
let archTotalItems = 0;

function sanitizeSubject(text) {
    if (!text) return '';
    let s = String(text).trim();
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/[\r\n]+/g, ' ');
    return s;
}

function showNotification(message, type = 'success') {
    const n = document.getElementById('notification');
    const t = document.getElementById('notificationText');
    if (!n || !t) return;
    t.textContent = message || '';
    n.classList.remove('error');
    if (type === 'error') n.classList.add('error');
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 1800);
}

async function fetchArchived(page = 1) {
    try {
        const q = document.getElementById('archSearchInput')?.value || '';
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', archPageLimit);
        params.set('status', 'archived');
        if (q && q.trim()) params.set('search', q.trim());
        const res = await fetch(`${API_BASE_URL}/contact-us?${params.toString()}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load archived');
        const data = await res.json();
        archived = Array.isArray(data.submissions) ? data.submissions : [];
        archTotalItems = Number(data.total || 0);
        archCurrentPage = Number(data.page || page);
        archFiltered = [...archived];
        renderArchived();
        renderArchPagination();
    } catch (e) {
        console.warn('fetchArchived error', e);
        showNotification('Failed to load archived submissions', 'error');
    }
}

function renderArchived() {
    const tbody = document.querySelector('#archivedTable tbody');
    const empty = document.getElementById('archNoResults');
    tbody.innerHTML = '';
    if (!archFiltered.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    const startIndex = (archCurrentPage - 1) * archPageLimit;
    archFiltered.forEach((s, idx) => {
        const row = tbody.insertRow();
        const fullName = `${s.first_name || ''}${s.last_name ? ' ' + s.last_name : ''}`;
        const formattedDate = s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
        const subjectRaw = s.subject || '';
        const subject = sanitizeSubject(subjectRaw);
        const statusText = s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : '';
        const statusClass = s.status ? 'status-' + s.status.toLowerCase().replace(' ', '-') : '';
        row.innerHTML = `
      <td>${startIndex + idx + 1}</td>
      <td><strong>${fullName}</strong></td>
      <td>${s.email || ''}</td>
      <td>${subject}</td>
      <td>${formattedDate}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <button class="restore-btn" onclick="restoreSubmission(${s.id})"><i class="fas fa-rotate-left"></i> Restore</button>
        <button class="delete-btn" onclick="deleteSubmission(${s.id})"><i class="fas fa-trash"></i> Delete</button>
      </td>
    `;
    });
}

function renderArchPagination() {
    const container = document.getElementById('archPagination');
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil((archTotalItems || 0) / archPageLimit));
    const prev = document.createElement('button');
    prev.textContent = '‹ Prev';
    prev.className = 'btn';
    prev.disabled = archCurrentPage <= 1;
    prev.onclick = () => changeArchPage(archCurrentPage - 1);
    container.appendChild(prev);
    const maxButtons = 7;
    let start = Math.max(1, archCurrentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);
    for (let p = start; p <= end; p++) {
        const btn = document.createElement('button');
        btn.textContent = String(p);
        btn.className = 'btn';
        if (p === archCurrentPage) { btn.disabled = true; btn.style.fontWeight = '700'; }
        else { btn.onclick = () => changeArchPage(p); }
        container.appendChild(btn);
    }
    const next = document.createElement('button');
    next.textContent = 'Next ›';
    next.className = 'btn';
    next.disabled = archCurrentPage >= totalPages;
    next.onclick = () => changeArchPage(archCurrentPage + 1);
    container.appendChild(next);
}

function changeArchPage(page) {
    if (page < 1) page = 1;
    const totalPages = Math.max(1, Math.ceil((archTotalItems || 0) / archPageLimit));
    if (page > totalPages) page = totalPages;
    fetchArchived(page);
}

async function restoreSubmission(id) {
    try {
        const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function') ? window.showConfirm : (msg => Promise.resolve(confirm(String(msg))));
        const ok = await confirmFn('Restore this submission back to active?', 'Restore Submission');
        if (!ok) return;
        const res = await fetch(`${API_BASE_URL}/contact-us/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'pending' })
        });
        if (!res.ok) throw new Error('Failed to restore');
        showNotification('Submission restored', 'success');
        fetchArchived(archCurrentPage);
    } catch (e) {
        console.warn('restoreSubmission error', e);
        showNotification('Failed to restore submission', 'error');
    }
}

async function deleteSubmission(id) {
    try {
        const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function') ? window.showConfirm : (msg => Promise.resolve(confirm(String(msg))));
        const ok = await confirmFn('Permanently delete this submission? This cannot be undone.', 'Delete Submission');
        if (!ok) return;
        const res = await fetch(`${API_BASE_URL}/contact-us/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to delete');
        showNotification('Submission deleted', 'success');
        fetchArchived(archCurrentPage);
    } catch (e) {
        console.warn('deleteSubmission error', e);
        showNotification('Failed to delete submission', 'error');
    }
}

function bindArchivedEvents() {
    const input = document.getElementById('archSearchInput');
    if (input) {
        input.addEventListener('input', () => {
            // debounce lightly
            clearTimeout(bindArchivedEvents._t);
            bindArchivedEvents._t = setTimeout(() => fetchArchived(1), 250);
        });
    }
}

function initArchived() {
    bindArchivedEvents();
    fetchArchived(1);
}

// expose for inline handlers
window.restoreSubmission = restoreSubmission;
window.deleteSubmission = deleteSubmission;

// init
initArchived();
