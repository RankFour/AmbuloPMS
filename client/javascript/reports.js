import { getProperties, getTenants } from "../api/adminApi.js";

async function fetchJson(url) {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}: ${url}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) {
        try { return await res.json(); } catch { return null; }
    }
    return await res.json();
}

function qs(params = {}) {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.set(k, String(v)); });
    return u.toString();
}

const API = {
    financial: async (p) => fetchJson(`/api/v1/reports/financial?${qs(p)}`),
    tenants: async (p) => fetchJson(`/api/v1/reports/tenants?${qs(p)}`),
    properties: async (p) => fetchJson(`/api/v1/reports/properties?${qs(p)}`),
    maintenance: async (p) => fetchJson(`/api/v1/reports/maintenance?${qs(p)}`),
};

function fmtCurrency(n) {
    try { const v = Number(n) || 0; return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; } catch { return `₱${Number(n) || 0}`; }
}
function fmtInt(n) { return (Number(n) || 0).toLocaleString('en-US'); }

function tableFrom(keyValues, headers) {
    if (!Array.isArray(keyValues) || keyValues.length === 0) { return `<div style="color:#64748b;">No data</div>`; }
    const cols = headers || Object.keys(keyValues[0]);
    const thead = `<thead><tr>${cols.map(c => `<th style="padding:8px 10px; font-size:12px; color:#64748b; text-transform:uppercase; text-align:left; border-bottom:1px solid #e5e7eb;">${c.replace(/_/g, ' ')}</th>`).join('')}</tr></thead>`;
    const rows = keyValues.map(r => `<tr>${cols.map(c => {
        const val = r[c];
        const txt = typeof val === 'number' && /total|amount|rent|recurring|one|avg|count/i.test(c)
            ? (c.match(/amount|total|rent|recurring|one/i) ? fmtCurrency(val) : fmtInt(val))
            : (val ?? '');
        return `<td style="padding:8px 10px; border-bottom:1px solid #f1f5f9;">${txt}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="table-responsive"><table style="width:100%; border-collapse:separate; border-spacing:0;">${thead}<tbody>${rows}</tbody></table></div>`;
}

function set(elId, html) { const el = document.getElementById(elId); if (el) el.innerHTML = html; }
function setText(elId, txt) { const el = document.getElementById(elId); if (el) el.textContent = txt; }

function getActiveTab() { const btn = document.querySelector('.reports-tabs .tab-btn.active'); return btn ? btn.getAttribute('data-tab') : 'financial'; }
function getFilters() {
    const from = document.getElementById('fromDate')?.value || '';
    const to = document.getElementById('toDate')?.value || '';
    const propertyId = document.getElementById('propertySelect')?.value || '';
    const tenantId = document.getElementById('tenantSelect')?.value || '';
    const groupBy = document.getElementById('groupBy')?.value || 'month';
    return { from, to, propertyId, tenantId, groupBy };
}

async function loadPropertiesTenants() {
    try {
        const [props, tenants] = await Promise.all([
            getProperties(1000, ''),
            getTenants(1000, ''),
        ]);
        const propSel = document.getElementById('propertySelect');
        const tenSel = document.getElementById('tenantSelect');
        if (propSel) {
            const cur = propSel.value; propSel.innerHTML = `<option value="">All</option>` + (props.list || []).map(p => `<option value="${p.property_id}">${p.property_name || `Property ${p.property_id}`}</option>`).join('');
            if (cur) propSel.value = cur;
        }
        if (tenSel) {
            const cur = tenSel.value; tenSel.innerHTML = `<option value="">All</option>` + (tenants.list || []).map(t => `<option value="${t.user_id}">${(t.first_name || '') + ' ' + (t.last_name || '')}</option>`).join('');
            if (cur) tenSel.value = cur;
        }
    } catch (e) { console.warn('Failed to load properties/tenants', e); }
}

async function loadFinancial() {
    try {
        const { from, to, propertyId, tenantId, groupBy } = getFilters();
        const data = await API.financial({ from, to, propertyId, tenantId, groupBy });
        set('financialCollected', tableFrom(data.totalCollectedByPeriod || [], ['period', 'total']));
        setText('financialOutstanding', fmtCurrency(data.outstandingBalances || 0));
        const dep = data.depositsSummary || { advance: 0, security: 0 };
        set('financialDeposits', tableFrom([{ advance: dep.advance, security: dep.security }], ['advance', 'security']));
        set('financialRevPerProperty', tableFrom(data.revenuePerProperty || [], ['property_id', 'total']));
        const r = data.recurringVsOneTime || { recurring: 0, oneTime: 0 };
        set('financialRecurring', tableFrom([{ recurring: r.recurring, one_time: r.oneTime }], ['recurring', 'one_time']));
    } catch (e) {
        try { window.showAlert && window.showAlert(`Failed to load Financial report: ${e.message || e}`, 'error'); } catch { }
    }
}

async function loadTenants() {
    try {
        const { from, to, propertyId } = getFilters();
        const data = await API.tenants({ from, to, propertyId });
        const ai = data.activeVsInactive || { active: 0, inactive: 0 };
        set('tenantActiveInactive', tableFrom([{ active: ai.active, inactive: ai.inactive }], ['active', 'inactive']));
        setText('tenantOverdue', fmtInt(data.tenantsWithOverdue || 0));
        setText('tenantAvgTenure', fmtInt(data.averageTenureMonths || 0));
        setText('tenantUpcomingExp', fmtInt(data.upcomingLeaseExpirations || 0));
        set('tenantByProperty', tableFrom(data.tenantsByProperty || [], ['property_id', 'tenants']));
    } catch (e) {
        try { window.showAlert && window.showAlert(`Failed to load Tenant report: ${e.message || e}`, 'error'); } catch { }
    }
}

async function loadProperties() {
    try {
        const { from, to } = getFilters();
        const data = await API.properties({ from, to });
        set('propOccupancy', tableFrom(data.occupancyPerProperty || [], ['property_id', 'activeLeases', 'totalLeases']));
        set('propAvgRent', tableFrom(data.averageRentPerProperty || [], ['property_id', 'avgRent']));
        const rt = data.renewalsVsTerminations || { renewals: 0, terminations: 0 };
        set('propRenewTerm', tableFrom([{ renewals: rt.renewals, terminations: rt.terminations }], ['renewals', 'terminations']));
        setText('propActiveLeases', fmtInt(data.totalActiveLeases || 0));
        setText('propUpcomingVac', fmtInt(data.upcomingVacancies || 0));
    } catch (e) {
        try { window.showAlert && window.showAlert(`Failed to load Property & Lease report: ${e.message || e}`, 'error'); } catch { }
    }
}

async function loadMaintenance() {
    try {
        const { from, to, propertyId } = getFilters();
        const data = await API.maintenance({ from, to, propertyId });
        set('maintByMonth', tableFrom(data.ticketsByMonth || [], ['period', 'total']));
        set('maintByStatus', tableFrom(data.ticketsByStatus || [], ['status', 'total']));
        setText('maintAvgRes', fmtInt(Math.round(Number(data.averageResolutionHours || 0))));
        set('maintCommon', tableFrom(data.commonIssues || [], ['type', 'total']));
        const r = data.ratings || { count: 0, average: 0 };
        set('maintRatings', tableFrom([{ count: r.count, average: r.average }], ['count', 'average']));
    } catch (e) {
        try { window.showAlert && window.showAlert(`Failed to load Maintenance report: ${e.message || e}`, 'error'); } catch { }
    }
}

function showTab(tab) {
    document.querySelectorAll('.reports-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`tab-${tab}`).style.display = 'block';
    
    document.getElementById('tenantFilterGroup').style.display = (tab === 'financial') ? '' : 'none';
    document.getElementById('groupByGroup').style.display = (tab === 'financial') ? '' : 'none';
}

async function applyFilters() {
    const tab = getActiveTab();
    try {
        if (tab === 'financial') return await loadFinancial();
        if (tab === 'tenants') return await loadTenants();
        if (tab === 'properties') return await loadProperties();
        if (tab === 'maintenance') return await loadMaintenance();
    } catch (e) {
        try { window.showAlert && window.showAlert(`Failed to load ${tab} report: ${e.message || e}`, 'error'); } catch { }
    }
}

function exportCsv() {
    const tab = getActiveTab();
    const { from, to, propertyId, tenantId, groupBy } = getFilters();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (propertyId) params.set('propertyId', propertyId);
    if (tenantId && tab === 'financial') params.set('tenantId', tenantId);
    if (groupBy && tab === 'financial') params.set('groupBy', groupBy);
    params.set('format', 'csv');
    const url = `/api/v1/reports/${tab}?${params.toString()}`;
    window.open(url, '_blank');
}

function bindEvents() {
    document.querySelectorAll('.reports-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', async () => { showTab(btn.getAttribute('data-tab')); await applyFilters(); });
    });
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportCsv);
}

function initDefaultDates() {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    const f = document.getElementById('fromDate');
    const t = document.getElementById('toDate');
    if (f) f.value = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
    if (t) t.value = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
}

async function boot() {
    initDefaultDates();
    bindEvents();
    await loadPropertiesTenants();
    showTab('financial');
    try { await applyFilters(); } catch (e) { try { window.showAlert && window.showAlert(`Failed to load reports: ${e.message || e}`, 'error'); } catch { } }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
