


async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    try { return await res.json(); } catch { return null; }
  }
  return await res.json();
}

export async function getProperties(limit = 1000, query = '') {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  if (query) qs.set('q', String(query));
  const data = await fetchJson(`/api/v1/properties?${qs.toString()}`);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.properties)
      ? data.properties
      : Array.isArray(data?.data)
        ? data.data
        : [];
  const total = Number(data?.total) || list.length;
  return { list, total };
}

export async function getTenants(limit = 1000, query = '') {
  const qs = new URLSearchParams();
  qs.set('role', 'TENANT');
  if (limit) qs.set('limit', String(limit));
  if (query) qs.set('q', String(query));
  const data = await fetchJson(`/api/v1/users?${qs.toString()}`);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
      ? data.users
      : Array.isArray(data?.data)
        ? data.data
        : [];
  const total = Number(data?.total) || list.length;
  return { list, total };
}

export async function getPaymentsStats() {
  const stats = await fetchJson('/api/v1/payments/stats');
  return {
    totalPayments: Number(stats?.totalPayments ?? stats?.total ?? 0),
    collectedThisMonth: Number(stats?.collectedThisMonth ?? 0),
    totalCollected: Number(stats?.totalCollected ?? 0),
    pendingCount: Number(stats?.pendingCount ?? 0),
  };
}

export async function getChargesStats() {
  const stats = await fetchJson('/api/v1/charges/stats');
  return {
    total: Number(stats?.total ?? 0),
    overdue: Number(stats?.overdue ?? 0),
    dueSoon: Number(stats?.dueSoon ?? 0),
  };
}

export async function getTickets(limit = 1000) {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  const data = await fetchJson(`/api/v1/tickets?${qs.toString()}`);
  const list = Array.isArray(data?.tickets) ? data.tickets : Array.isArray(data) ? data : [];
  return { list, total: list.length };
}

export async function getRecentPayments(limit = 5) {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  const data = await fetchJson(`/api/v1/payments?${qs.toString()}`);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.payments)
      ? data.payments
      : [];
  return list;
}

export async function getLeases(limit = 1000, status = '') {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  if (status) qs.set('status', status);
  const data = await fetchJson(`/api/v1/leases?${qs.toString()}`);
  const list = Array.isArray(data?.leases) ? data.leases : Array.isArray(data) ? data : [];
  const total = Number(data?.total) || list.length;
  return { list, total };
}

export async function getContactSubmissions(limit = 100, status = '') {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  if (status) qs.set('status', String(status));
  const data = await fetchJson(`/api/v1/contact-us?${qs.toString()}`);
  const list = Array.isArray(data?.submissions) ? data.submissions : Array.isArray(data) ? data : [];
  const total = Number(data?.total) || list.length;
  const stats = data?.stats || data?.totals || data?.counts || null;
  return { list, total, stats };
}


export async function getPaymentsCountByStatus(status) {
  const qs = new URLSearchParams();
  qs.set('limit', '1');
  if (status) qs.set('status', status);
  const data = await fetchJson(`/api/v1/payments?${qs.toString()}`);
  const total = Number(data?.total || 0);
  return total;
}

export async function getPaymentsSumByStatus(status) {
  const qs = new URLSearchParams();
  qs.set('limit', '1000');
  if (status) qs.set('status', status);
  const data = await fetchJson(`/api/v1/payments?${qs.toString()}`);
  const list = Array.isArray(data?.payments) ? data.payments : Array.isArray(data) ? data : [];
  const sum = list.reduce((s, p) => s + (Number(p?.amount_paid ?? p?.amount ?? 0) || 0), 0);
  return sum;
}

export async function getPaymentsDistribution() {
  const statuses = ['Confirmed', 'Pending', 'Rejected'];
  const [confirmedCount, pendingCount, rejectedCount] = await Promise.all([
    getPaymentsCountByStatus('Confirmed').catch(() => 0),
    getPaymentsCountByStatus('Pending').catch(() => 0),
    getPaymentsCountByStatus('Rejected').catch(() => 0),
  ]);
  const [confirmedSum, pendingSum, rejectedSum] = await Promise.all([
    getPaymentsSumByStatus('Confirmed').catch(() => 0),
    getPaymentsSumByStatus('Pending').catch(() => 0),
    getPaymentsSumByStatus('Rejected').catch(() => 0),
  ]);
  return {
    statuses,
    counts: { Confirmed: confirmedCount, Pending: pendingCount, Rejected: rejectedCount },
    sums: { Confirmed: confirmedSum, Pending: pendingSum, Rejected: rejectedSum },
  };
}


export async function getMonthlyExpectedIncome(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  const qs = new URLSearchParams();
  qs.set('due_date_from', from);
  qs.set('due_date_to', to);
  qs.set('limit', '1000');
  const data = await fetchJson(`/api/v1/charges?${qs.toString()}`);
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const sum = list.reduce((acc, c) => {
    const canon = String(c?.canonical_status || c?.status || '').toUpperCase();
    if (canon === 'WAIVED' || canon === 'CANCELLED' || canon === 'CANCELED') return acc;
    const orig = Number(c?.original_amount ?? c?.amount ?? 0) || 0;
    return acc + orig;
  }, 0);
  return sum;
}

export async function getDashboardMetrics() {
  const [props, tenants, payStats, chStats, tickets, recent] = await Promise.all([
    getProperties().catch(() => ({ list: [], total: 0 })),
    getTenants().catch(() => ({ list: [], total: 0 })),
    getPaymentsStats().catch(() => ({ totalPayments: 0, collectedThisMonth: 0, totalCollected: 0, pendingCount: 0 })),
    getChargesStats().catch(() => ({ total: 0, overdue: 0, dueSoon: 0 })),
    getTickets().catch(() => ({ list: [], total: 0 })),
    getRecentPayments().catch(() => ([])),
  ]);
  return {
    propertiesCount: Number(props?.total || 0),
    tenantsCount: Number(tenants?.total || 0),
    paymentsStats: payStats,
    chargesStats: chStats,
    ticketsList: tickets?.list || [],
    recentPayments: Array.isArray(recent) ? recent : [],
  };
}

// ===== Tenant-specific helpers =====
export async function getPaymentsForTenant(tenantId, limit = 1000) {
  const qs = new URLSearchParams();
  if (tenantId != null) qs.set('user_id', String(tenantId));
  if (limit) qs.set('limit', String(limit));
  const data = await fetchJson(`/api/v1/payments?${qs.toString()}`);
  const list = Array.isArray(data?.payments) ? data.payments : Array.isArray(data) ? data : [];
  return list;
}

export async function getChargesForTenant(tenantId, status = '', limit = 1000) {
  const qs = new URLSearchParams();
  if (tenantId != null) qs.set('user_id', String(tenantId));
  if (status) qs.set('status', String(status));
  if (limit) qs.set('limit', String(limit));
  const data = await fetchJson(`/api/v1/charges?${qs.toString()}`);
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return list;
}

export async function getTicketsForTenant(tenantId, limit = 1000) {
  const qs = new URLSearchParams();
  if (tenantId != null) qs.set('user_id', String(tenantId));
  if (limit) qs.set('limit', String(limit));
  const data = await fetchJson(`/api/v1/tickets?${qs.toString()}`);
  const list = Array.isArray(data?.tickets) ? data.tickets : Array.isArray(data) ? data : [];
  return list;
}

export async function getLeasesForTenant(tenantId, limit = 100) {
  const qs = new URLSearchParams();
  if (tenantId != null) qs.set('user_id', String(tenantId));
  if (limit) qs.set('limit', String(limit));
  const data = await fetchJson(`/api/v1/leases?${qs.toString()}`);
  const list = Array.isArray(data?.leases) ? data.leases : Array.isArray(data) ? data : [];
  return list;
}

export default {
  getProperties,
  getTenants,
  getPaymentsStats,
  getChargesStats,
  getTickets,
  getRecentPayments,
  getLeases,
  getContactSubmissions,
  getPaymentsCountByStatus,
  getPaymentsSumByStatus,
  getPaymentsDistribution,
  getMonthlyExpectedIncome,
  getDashboardMetrics,
  getPaymentsForTenant,
  getChargesForTenant,
  getTicketsForTenant,
  getLeasesForTenant,
};
