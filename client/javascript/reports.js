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
    let cols = headers || Object.keys(keyValues[0]);

    
    let mergeProperty = false;
    if (cols.includes('property_id') && cols.includes('property_name')) {
        mergeProperty = true;
        
        const newCols = [];
        for (const c of cols) {
            if (c === 'property_name') continue; 
            if (c === 'property_id') { newCols.push('property'); continue; }
            newCols.push(c);
        }
        cols = newCols;
    }

    const thead = `<thead><tr>${cols.map(c => `<th style="padding:8px 10px; font-size:12px; color:#64748b; text-transform:uppercase; text-align:left; border-bottom:1px solid #e5e7eb;">${(c==='property' ? 'Property' : c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead>`;

    const rows = keyValues.map(r => `<tr>${cols.map(c => {
        const val = r[c];
        
        
        
        const currencyKeys = /amount|price|rent|paid|outstanding|balance|fee|total_amount|total_paid/i;
        const intKeys = /count|total$|^total$|avg|number|tenants|renewals|terminations|active|inactive|hours|hrs/i;
        let txt = val ?? '';
        if (typeof val === 'number') {
            if (currencyKeys.test(c)) txt = fmtCurrency(val);
            else if (intKeys.test(c)) txt = fmtInt(val);
            else txt = String(val);
        }

        
        if (mergeProperty && c === 'property') {
            const id = r['property_id'] ?? '';
            const name = r['property_name'] ?? '';
            const display = `<div style="display:flex; flex-direction:column;"><span style="font-weight:700;">${id}</span><span style="font-size:12px; color:#64748b;">${name}</span></div>`;
            return `<td style="padding:8px 10px; border-bottom:1px solid #f1f5f9;">${display}</td>`;
        }

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
    set('financialRevPerProperty', tableFrom(data.revenuePerProperty || [], ['property_id', 'property_name', 'total']));
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
    set('propOccupancy', tableFrom(data.occupancyPerProperty || [], ['property_id', 'property_name', 'activeLeases', 'totalLeases']));
    set('propAvgRent', tableFrom(data.averageRentPerProperty || [], ['property_id', 'property_name', 'avgRent']));
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
    
    return (async () => {
        const filters = getFilters();

        
        const [financial, tenants, properties, maintenance] = await Promise.allSettled([
            API.financial(filters),
            API.tenants(filters),
            API.properties(filters),
            API.maintenance(filters),
        ]);

        const currencyKeys = /amount|price|rent|paid|outstanding|balance|fee|total_amount|total_paid|total/i;
        const intKeys = /count|qty|number|tenants|renewals|terminations|active|inactive|hours|hrs|total_count|total/i;

        const escapeCell = (v, key) => {
            if (v === null || v === undefined) return '';
            
            if (typeof v === 'object') return `"${JSON.stringify(v).replace(/"/g,'""')}"`;
            
            const num = Number(v);
            if (v !== '' && !isNaN(num) && !currencyKeys.test(key) && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(v))) {
                
                return String(num);
            }
            
            if (currencyKeys.test(key) && !isNaN(num)) return String(Number(num).toFixed(2));
            
            return `"${String(v).replace(/"/g, '""')}"`;
        };

        function unionHeaders(rows) {
            const seen = new Set();
            const headers = [];
            for (const r of rows) {
                Object.keys(r || {}).forEach(k => { if (!seen.has(k)) { seen.add(k); headers.push(k); } });
            }
            return headers;
        }

        function arrayToCsv(rows) {
            if (!Array.isArray(rows) || rows.length === 0) return '';
            const headers = unionHeaders(rows);
            const lines = [];
            
            lines.push(headers.map(h => `"${h}"`).join(','));
            for (const r of rows) {
                const line = headers.map(h => escapeCell(r && (h in r) ? r[h] : '', h)).join(',');
                lines.push(line);
            }
            return lines.join('\n');
        }

        function objectToKeyValueCsv(obj) {
            if (!obj || typeof obj !== 'object') return '';
            const lines = [];
            lines.push('Key,Value');
            for (const k of Object.keys(obj)) {
                const v = obj[k];
                lines.push([`"${k}"`, escapeCell(v, k)].join(','));
            }
            return lines.join('\n');
        }

        const parts = [];
        
        const now = new Date();
        parts.push(`"Report Export","${now.toISOString()}"`);
        parts.push('');

        
        parts.push('"Filters"');
        parts.push('Key,Value');
        for (const [k, v] of Object.entries(filters)) {
            parts.push([`"${k}"`, escapeCell(v, k)].join(','));
        }
        parts.push('');

        const pushSection = (title, settledResult) => {
            parts.push('');
            parts.push(`"${title.toUpperCase()}"`);
            parts.push('');
            if (settledResult.status !== 'fulfilled') {
                parts.push('Error');
                parts.push([`"message"`, escapeCell(settledResult.reason?.message || String(settledResult.reason || 'failed'), 'message')].join(','));
                parts.push('');
                return;
            }
            const data = settledResult.value;
            
            if (Array.isArray(data)) {
                const block = arrayToCsv(data) || '(No data)';
                parts.push(block);
                parts.push('');
                return;
            }
            
            for (const key of Object.keys(data)) {
                const val = data[key];
                parts.push(`"${key}"`);
                if (Array.isArray(val)) {
                    parts.push(arrayToCsv(val) || '(No data)');
                } else if (val && typeof val === 'object') {
                    parts.push(objectToKeyValueCsv(val));
                } else {
                    parts.push([`"value"`, escapeCell(val, key)].join(','));
                }
                parts.push('');
            }
        };

        pushSection('Financial', financial);
        pushSection('Tenants', tenants);
        pushSection('Properties', properties);
        pushSection('Maintenance', maintenance);

        const csvBody = parts.join('\n');
        
        const csv = '\uFEFF' + csvBody;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fname = `reports_export_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.csv`;
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    })();
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
