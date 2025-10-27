import fetchCompanyDetails from "../api/loadCompanyInfo.js";
import { getDashboardMetrics, getPaymentsDistribution, getMonthlyExpectedIncome, getTickets as apiGetTickets, getLeases as apiGetLeases, getContactSubmissions } from "../api/adminApi.js";

fetch("/components/sidebar.html")
  .then((res) => res.text())
  .then((html) => {
    document.getElementById("sidebarContainer").innerHTML = html;
  
    const sidebar = document.getElementById("sidebar");
    const sidebarToggle = document.getElementById("sidebarToggle");
    const mainContent = document.getElementById("mainContent");
    const overlay = document.getElementById("overlay");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  
    let isCollapsed = false;
    let isMobile = window.innerWidth <= 768;
  
    function updateLayout() {
      isMobile = window.innerWidth <= 768;
      if (isMobile) {
        sidebar?.classList.remove("collapsed");
        mainContent?.classList.remove("sidebar-collapsed");
        mainContent?.classList.add("sidebar-hidden");
      } else {
        sidebar?.classList.remove("open");
        overlay?.classList.remove("active");
        mainContent?.classList.remove("sidebar-hidden");
        if (isCollapsed) {
          sidebar?.classList.add("collapsed");
          mainContent?.classList.add("sidebar-collapsed");
        } else {
          sidebar?.classList.remove("collapsed");
          mainContent?.classList.remove("sidebar-collapsed");
        }
      }
    }
  
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", function () {
        if (!isMobile) {
          isCollapsed = !isCollapsed;
          sidebar?.classList.toggle("collapsed");
          mainContent?.classList.toggle("sidebar-collapsed");
          const arrow = sidebarToggle.querySelector("span");
          arrow.textContent = isCollapsed ? "→" : "←";
        }
      });
    }
  
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", function () {
        if (isMobile) {
          sidebar?.classList.toggle("open");
          overlay?.classList.toggle("active");
        }
      });
    }
  
    if (overlay) {
      overlay.addEventListener("click", function () {
        if (isMobile) {
          sidebar?.classList.remove("open");
          overlay?.classList.remove("active");
        }
      });
    }
  
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", function () {
        if (isMobile) {
          sidebar?.classList.remove("open");
          overlay?.classList.remove("active");
        }
        document
          .querySelectorAll(".nav-link")
          .forEach((l) => l.classList.remove("active"));
        this.classList.add("active");
      });
    });
  
    window.addEventListener("resize", updateLayout);
    updateLayout();
  })
  


document.addEventListener("DOMContentLoaded", () => {
  const profileBtn = document.getElementById("profileBtn");
  const dropdownMenu = document.getElementById("profileMenu");

  if (profileBtn && dropdownMenu) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
    });

    window.addEventListener("click", (e) => {
      if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove("show");
      }
    });
  }

  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-5px)";
    });
    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
    });
  });

  document.querySelectorAll(".bar").forEach((bar) => {
    bar.addEventListener("mouseenter", function () {
      this.style.transform = "scaleY(1.1)";
      this.style.background = "linear-gradient(to top, #3b82f6, #3b82f6)";
    });
    bar.addEventListener("mouseleave", function () {
      this.style.transform = "scaleY(1)";
      this.style.background = "linear-gradient(to top, #3b82f6, #60a5fa)";
    });
  });

  setDynamicInfo();

  try {
    const cfg = window.ADMIN_DASHBOARD_CONFIG || DEFAULT_DASHBOARD_CONFIG;
    renderDashboard(cfg);
    
    try { renderSummaryKpis(); } catch {}
  } catch (e) {
    console.warn("Dashboard render failed", e);
  }

  try {
    wireDashboardShortcuts();
  } catch (e) {
    console.warn("Failed to wire dashboard shortcuts", e);
  }

  
  try {
    loadDashboardMetrics();
  } catch (e) {
    console.warn("Dashboard metrics init failed", e);
  }
});


function fmtCurrency(n) {
  try {
    const v = Number(n) || 0;
    return `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return `₱${Number(n) || 0}`;
  }
}

function fmtInt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US");
}



function findCardByTitle(regex) {
  const cards = Array.from(document.querySelectorAll(".dashboard-grid .card, .transactions-section .card"));
  for (const card of cards) {
    const t = card.querySelector(".card-title");
    const title = (t && t.textContent || "").trim();
    if (regex.test(title)) return card;
  }
  return null;
}

function setCardValueByTitle(regex, valueText, changeText) {
  const card = findCardByTitle(regex);
  if (!card) return false;
  const val = card.querySelector(".card-value");
  if (val) val.textContent = String(valueText ?? "—");
  if (typeof changeText === "string") {
    const ch = card.querySelector(".card-change");
    if (ch) ch.textContent = changeText;
  }
  return true;
}

function findCardByKey(key) {
  const esc = (window.CSS && CSS.escape) ? CSS.escape : (s) => String(s).replace(/"/g, '\\"').replace(/\]/g, '\\]');
  return document.querySelector(`.dashboard-grid .card[data-card-key="${esc(key)}"]`);
}

function setCardValueByKey(key, valueText, changeText) {
  const card = findCardByKey(key);
  if (!card) return false;
  const val = card.querySelector(".card-value");
  if (val) val.textContent = String(valueText ?? "—");
  if (typeof changeText === "string") {
    const ch = card.querySelector(".card-change");
    if (ch) ch.textContent = changeText;
  }
  return true;
}

function createMetricCard({ title, value, change, icon, accentClass, onClick }) {
  const card = document.createElement("div");
  card.className = `card ${accentClass || ""}`.trim();
  
  const iconHtml = icon ? `<i class="${icon}"></i>` : '';
  
  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${iconHtml}${title}</h3>
    </div>
    <div class="card-value">${value}</div>
    ${change ? `<div class="card-change">${change}</div>` : ""}
  `;
  card.style.cursor = onClick ? "pointer" : card.style.cursor;
  if (typeof onClick === "function") card.addEventListener("click", onClick);
  
  return card;
}

function createChartCard({ title, icon }) {
  const card = document.createElement("div");
  card.className = "card";
  
  const iconHtml = icon ? `<i class="${icon}"></i>` : '';
  
  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${iconHtml}${title}</h3>
    </div>
    <div class="chart-slot" style="padding: 8px 12px; min-height: 90px;">
      <div style="color:#64748b; font-size: 12px;">Loading…</div>
    </div>
  `;
  return card;
}

function setCardContentByKey(key, htmlOrNode) {
  const card = findCardByKey(key);
  if (!card) return false;
  const slot = card.querySelector(".chart-slot");
  if (!slot) return false;
  if (typeof htmlOrNode === "string") slot.innerHTML = htmlOrNode;
  else if (htmlOrNode instanceof Node) {
    slot.innerHTML = "";
    slot.appendChild(htmlOrNode);
  }
  return true;
}

// ----- Summary KPI row (top compact KPIs) -----
function ensureSummaryRow() {
  const grid = document.querySelector(".dashboard-grid");
  if (!grid) return null;
  let row = document.getElementById("summaryRow");
  if (row) return row;
  row = document.createElement("div");
  row.id = "summaryRow";
  row.style.display = "contents"; 
  
  grid.insertAdjacentElement("afterbegin", row);
  return row;
}

function renderSummaryKpis() {
  const row = ensureSummaryRow();
  if (!row) return;
  
  Array.from(row.querySelectorAll('.card[data-card-key^="kpi"]')).forEach((el) => el.remove());

  const make = (key, title, icon, href, deepLink) => {
    const card = createMetricCard({ title, value: "—", change: "", icon });
    card.dataset.cardKey = key;
    if (href) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        try {
          if (deepLink && /paymentAdmin\.html$/i.test(href)) {
            localStorage.setItem("paymentAdminDeepLink", JSON.stringify(deepLink));
          }
        } catch {}
        window.location.href = href;
      });
    }
    row.appendChild(card);
  };

  make('kpiTotalProperties', 'Total Properties', 'fas fa-building', '/propertyAdmin.html');
  
  make('kpiOccupancyRate', 'Occupancy Rate', 'fas fa-chart-pie');
  make('kpiActiveLeases', 'Active Leases', 'fas fa-file-contract', '/leaseAdmin.html');
  make('kpiExpectedIncomeMonth', 'Expected Income (This month)', 'fas fa-dollar-sign', '/paymentAdmin.html', { tab: 'charges', chargesStatus: 'due' });
  make('kpiPendingPayments', 'Pending Payments', 'fas fa-clock', '/paymentAdmin.html', { tab: 'payments', view: 'pending', pendingStatus: 'Pending' });
}

const DEFAULT_DASHBOARD_CONFIG = {
  metrics: [
    
    { key: "alerts", title: "Alerts & Actions", icon: "fas fa-bell", type: "chart", visible: true },
    { key: "revenueTrend", title: "Revenue Trend", icon: "fas fa-chart-line", type: "chart", visible: true },
    
    { key: "paymentStatusDonut", title: "Status Distribution", icon: "fas fa-chart-pie", type: "chart", visible: true },
    { key: "paymentsByStatus", title: "Payment Status", icon: "fas fa-chart-bar", type: "chart", visible: true },
  
  { key: "maintenanceByCategory", title: "Maintenance Categories", icon: "fas fa-wrench", type: "chart", visible: true },
  { key: "resolvedTicketsThisMonth", title: "Resolved This Month", icon: "fas fa-check-circle", visible: true, click: { href: "/maintenance.html" } },
  { key: "avgResolutionTime", title: "Avg. Resolution", icon: "fas fa-stopwatch", visible: true },
  
  
  { key: "expectedIncomeThisMonth", title: "Expected Income (This month)", icon: "fas fa-calendar", visible: true },
  { key: "totalIncome", title: "Total Collected", icon: "fas fa-money-bill-wave", visible: true, click: { href: "/paymentAdmin.html", deepLink: { tab: "payments", view: "all" } } },
  { key: "totalProperty", title: "Total Properties", icon: "fas fa-building", visible: true, click: { href: "/propertyAdmin.html" } },
  { key: "totalTransactions", title: "Total Transactions", icon: "fas fa-receipt", visible: true, click: { href: "/paymentAdmin.html", deepLink: { tab: "payments", view: "all" } } },
    
    { key: "tenants", title: "Tenants", icon: "fas fa-users", visible: true, click: { href: "/tenants.html" } },
    { key: "pendingPayments", title: "Pending Payments", icon: "fas fa-hourglass-half", visible: true, click: { href: "/paymentAdmin.html", deepLink: { tab: "payments", view: "pending", pendingStatus: "Pending" } } },
    { key: "overdueCharges", title: "Overdue Charges", icon: "fas fa-exclamation-triangle", visible: true, click: { href: "/paymentAdmin.html", deepLink: { tab: "charges", chargesStatus: "overdue" } } },
  { key: "openTickets", title: "Open Tickets", icon: "fas fa-tools", visible: true, click: { href: "/maintenance.html" } },
  ],
};

function ensureMetricsRow() {
  const grid = document.querySelector(".dashboard-grid");
  if (!grid) return null;
  let row = document.getElementById("metricsRow");
  if (row) return row;
  row = document.createElement("div");
  row.id = "metricsRow";
  row.style.display = "contents"; 
  
  const tasksCard = Array.from(grid.querySelectorAll(".card .card-title"))
    .find((t) => /tasks/i.test((t.textContent || "").trim()));
  if (tasksCard && tasksCard.closest(".card") && tasksCard.closest(".card").parentNode === grid) {
    const after = tasksCard.closest(".card");
    after.insertAdjacentElement("afterend", row);
  } else {
    grid.appendChild(row);
  }
  return row;
}

export function renderDashboard(config) {
  const cfg = config && Array.isArray(config.metrics) ? config : DEFAULT_DASHBOARD_CONFIG;
  const container = ensureMetricsRow();
  if (!container) return;
  
  Array.from(container.querySelectorAll(".card[data-card-key]")).forEach((el) => el.remove());

  const navigate = (href, deepLink) => {
    try {
      if (deepLink && href && /paymentAdmin\.html$/i.test(href)) {
        localStorage.setItem("paymentAdminDeepLink", JSON.stringify(deepLink));
      }
    } catch {}
    if (href) window.location.href = href;
  };

  cfg.metrics.filter((m) => m && m.visible !== false).forEach((m) => {
    const card = m.type === "chart"
      ? createChartCard({ title: m.title, icon: m.icon })
      : createMetricCard({ title: m.title, value: "—", change: "", icon: m.icon });
    card.dataset.cardKey = m.key;
    if (m.click && m.click.href) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => navigate(m.click.href, m.click.deepLink));
    }
    container.appendChild(card);
  });
}

export async function loadDashboardMetrics() {
  
  setCardValueByKey("totalProperty", "Loading…");
  setCardValueByKey("totalIncome", "Loading…");
  setCardValueByKey("expectedIncomeThisMonth", "Loading…");
  setCardValueByKey("totalTransactions", "Loading…");
  
  setCardValueByKey('kpiTotalProperties', 'Loading…');
  setCardValueByKey('kpiOccupancyRate', 'Loading…');
  setCardValueByKey('kpiActiveLeases', 'Loading…');
  setCardValueByKey('kpiExpectedIncomeMonth', 'Loading…');
  setCardValueByKey('kpiPendingPayments', 'Loading…');
  
  setCardValueByTitle(/^total\s*(property|properties)/i, "Loading…");
  setCardValueByTitle(/^total\s*(income|collected\s*payments)/i, "Loading…");
  setCardValueByTitle(/total\s+number\s+of\s+transactions?/i, "Loading…");

  
  const {
    propertiesCount,
    tenantsCount,
    paymentsStats,
    chargesStats,
    ticketsList,
    recentPayments,
  } = await getDashboardMetrics();

  
  const paymentsTotal = Number(paymentsStats?.totalPayments || paymentsStats?.total || 0);
  const collectedThisMonth = Number(paymentsStats?.collectedThisMonth || 0);
  const collectedTotal = Number(paymentsStats?.totalCollected || paymentsStats?.total || 0);
  const pendingPaymentsCount = Number(paymentsStats?.pendingCount || 0);

  const overdueCharges = Number(chargesStats?.overdue || 0);
  const dueSoonCharges = Number(chargesStats?.dueSoon || 0);
  const totalCharges = Number(chargesStats?.total || 0);

  const openTickets = (Array.isArray(ticketsList) ? ticketsList : [])
    .filter((t) => String(t.ticket_status || t.status || "").toLowerCase() !== "completed").length;

  
  setCardValueByKey("totalProperty", fmtInt(propertiesCount));
  setCardValueByKey("totalTransactions", fmtInt(paymentsTotal));
  setCardValueByKey("totalIncome", fmtCurrency(collectedTotal));
  setCardValueByKey("tenants", fmtInt(tenantsCount));
  setCardValueByKey("pendingPayments", fmtInt(pendingPaymentsCount), dueSoonCharges > 0 ? `${fmtInt(dueSoonCharges)} due soon` : "");
  setCardValueByKey("overdueCharges", fmtInt(overdueCharges), totalCharges ? `${Math.round((overdueCharges / totalCharges) * 100)}% of charges` : "");
  setCardValueByKey("openTickets", fmtInt(openTickets));

  
  setCardValueByKey('kpiTotalProperties', fmtInt(propertiesCount));
  
  setCardValueByKey('kpiPendingPayments', fmtInt(pendingPaymentsCount));

  setCardValueByTitle(/^total\s*(property|properties)/i, fmtInt(propertiesCount));
  setCardValueByTitle(/total\s+number\s+of\s+transactions?/i, fmtInt(paymentsTotal));
  setCardValueByTitle(/^total\s*(income|collected\s*payments)/i, fmtCurrency(collectedTotal));

  
  try {
    const lateCard = findCardByTitle(/^late\s*payments/i);
    if (lateCard) {
      const body = lateCard.querySelector(".no-records");
      if (body) body.textContent = overdueCharges > 0 ? `${fmtInt(overdueCharges)} overdue` : "No Records";
    }
  } catch {}

  

  
  try {
    const card = findCardByTitle(/^last\s*transaction/i);
    if (card && recentPayments) {
      
      const rows = Array.isArray(recentPayments) ? recentPayments : [];

      const items = rows.slice(0, 3);
      const existing = card.querySelectorAll(".transaction-item");
      existing.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
      items.forEach((p) => {
        const el = document.createElement("div");
        el.className = "transaction-item";
        const unit = p.property_name || p.unit || "—";
        const when = p.created_at || p.paymentDate || p.createdAt;
        el.innerHTML = `
              <div class="transaction-icon"><i class="fas fa-receipt"></i></div>
          <div class="transaction-details">
            <h4>${(p.charge_description || p.description || "Payment").toString().slice(0, 48)}</h4>
            <p>${unit}</p>
            <small>${when ? new Date(when).toLocaleString() : ""}</small>
          </div>
          <span class="transaction-type payment">Payment</span>
        `;
        card.appendChild(el);
      });

      const seeAll = card.querySelector(".see-all");
      if (seeAll) {
        seeAll.href = "/paymentAdmin.html";
        seeAll.addEventListener("click", (e) => {
          e.preventDefault();
          try {
            localStorage.setItem("paymentAdminDeepLink", JSON.stringify({ tab: "payments", view: "all" }));
          } catch {}
          window.location.href = "/paymentAdmin.html";
        });
      }
    }
  } catch (e) {
    console.warn("Failed to populate Last Transaction", e);
  }

  
  try {
    
    const amt = (p) => {
      const n = Number(p?.amount_paid ?? p?.amount ?? p?.total_amount ?? (p?.amount_cents ? p.amount_cents / 100 : 0));
      return isFinite(n) ? n : 0;
    };

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short' }) });
    }

    const byMonth = new Map(months.map(m => [m.key, 0]));
    (Array.isArray(recentPayments) ? recentPayments : []).forEach(p => {
      const dtStr = p?.created_at || p?.paymentDate || p?.createdAt;
      const d = dtStr ? new Date(dtStr) : null;
      if (!d || isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byMonth.has(key)) byMonth.set(key, byMonth.get(key) + amt(p));
    });
    const series = months.map(m => byMonth.get(m.key) || 0);

    const sparkWidth = 400, sparkHeight = 180, pad = 20;
    const max = Math.max(...series, 1);
    const min = Math.min(...series, 0);
    const span = Math.max(max - min, 1);
    const stepX = (sparkWidth - pad * 2) / Math.max(series.length - 1, 1);
    
    
    const pathPoints = series.map((v, i) => {
      const x = pad + i * stepX;
      const y = sparkHeight - pad - ((v - min) / span) * (sparkHeight - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    
    
    const firstX = pad;
    const lastX = pad + (series.length - 1) * stepX;
    const bottomY = sparkHeight - pad;
    const polyPoints = `${firstX},${bottomY} ${pathPoints} ${lastX},${bottomY}`;
    
    const sparkSvg = `
      <svg width="100%" height="${sparkHeight}" viewBox="0 0 ${sparkWidth} ${sparkHeight}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%;">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.05" />
          </linearGradient>
        </defs>
        <!-- Y-axis gridlines and labels -->
        ${(() => {
          const ticks = 4; 
          const lines = [];
          for (let i = 0; i <= ticks; i++) {
            const t = i / ticks; 
            const y = sparkHeight - pad - t * (sparkHeight - pad * 2);
            const val = min + (span * t);
            lines.push(`<line x1="${pad}" y1="${y.toFixed(1)}" x2="${(sparkWidth - pad)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1" />`);
            lines.push(`<text x="${pad - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#94a3b8">${fmtCurrency(val).replace('₱','')}</text>`);
          }
          return lines.join('');
        })()}
        <polygon fill="url(#areaGradient)" points="${polyPoints}" />
        <polyline fill="none" stroke="#3b82f6" stroke-width="3" points="${pathPoints}" />
        ${series.map((v,i)=>{
          const x = pad + i * stepX; 
          const y = sparkHeight - pad - ((v - min) / span) * (sparkHeight - pad * 2);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#ffffff" stroke="#3b82f6" stroke-width="2" />`;
        }).join('')}
      </svg>
      <div style="display:flex; gap:8px; justify-content:space-between; color:#64748b; font-size:12px; padding-top:12px; font-weight: 500;">
        ${months.map(m => `<span style="flex:1; text-align:center;">${m.label}</span>`).join('')}
      </div>
    `;
    setCardContentByKey('revenueTrend', sparkSvg);

    
    const counts = {};
    (Array.isArray(recentPayments) ? recentPayments : []).forEach(p => {
      const raw = String(p?.status || p?.payment_status || p?.state || '').toLowerCase();
      let key = 'other';
      if (/paid|success|approved|completed/.test(raw)) key = 'paid';
      else if (/pending|await|processing/.test(raw)) key = 'pending';
      else if (/failed|declined|rejected|error/.test(raw)) key = 'failed';
      counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts);
    const total = entries.reduce((a, [,v]) => a + v, 0) || 1;
    const colors = { paid: '#10b981', pending: '#f59e0b', failed: '#ef4444', other: '#64748b' };
    const labels = { paid: 'Completed', pending: 'Pending', failed: 'Failed', other: 'Other' };
    
    const barsHtml = entries.length ? `
      <div style="padding: 16px 0;">
        ${entries.map(([k,v]) => {
          const pct = Math.round((v / total) * 100);
          return `<div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 13px; font-weight: 600; color: #334155;">${labels[k]}</span>
              <span style="font-size: 13px; font-weight: 700; color: ${colors[k]};">${v} (${pct}%)</span>
            </div>
            <div style="height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; position: relative;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, ${colors[k]}, ${colors[k]}dd); border-radius: 6px; transition: width 0.6s ease;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    ` : `<div style="color:#64748b; font-size:12px; padding: 40px 0; text-align: center;">No recent payments</div>`;
    setCardContentByKey('paymentsByStatus', barsHtml);
  } catch (e) {
    console.warn('Failed to render charts', e);
  }

  
  try {
    const [expectedIncome, payDist, ticketsResp, leasesResp, contactsResp] = await Promise.all([
      getMonthlyExpectedIncome().catch(() => 0),
      getPaymentsDistribution().catch(() => ({ counts: {}, sums: {} })),
      apiGetTickets(1000).catch(() => ({ list: [], total: 0 })),
      apiGetLeases(1000, '').catch(() => ({ list: [], total: 0 })),
      
      getContactSubmissions(1, 'pending').catch(() => ({ list: [], total: 0 })),
    ]);

    
    setCardValueByKey('expectedIncomeThisMonth', fmtCurrency(expectedIncome));
    setCardValueByKey('kpiExpectedIncomeMonth', fmtCurrency(expectedIncome));

    
  const pendingAmt = Number(payDist?.sums?.Pending || 0);
  setCardValueByKey('pendingPayments', fmtInt(pendingPaymentsCount), pendingAmt > 0 ? `${fmtCurrency(pendingAmt)} pending` : "");
  setCardValueByKey('kpiPendingPayments', fmtInt(pendingPaymentsCount), pendingAmt > 0 ? `${fmtCurrency(pendingAmt)} pending` : "");

    
    try {
      const counts = payDist?.counts || {};
      const paid = Number(counts.Confirmed || 0);
      const pending = Number(counts.Pending || 0);
      const rejected = Number(counts.Rejected || 0);
      const totalC = Math.max(1, paid + pending + rejected);
      const segments = [
        { label: 'Confirmed', value: paid, color: '#10b981' },
        { label: 'Pending', value: pending, color: '#f59e0b' },
        { label: 'Rejected', value: rejected, color: '#ef4444' },
      ];
      const circumference = 2 * Math.PI * 45; 
      let offset = 0;
      const segs = segments.map(s => {
        const pct = s.value / totalC;
        const len = pct * circumference;
        const dash = `${len} ${circumference - len}`;
        const el = `<circle r="45" cx="60" cy="60" fill="transparent" stroke="${s.color}" stroke-width="16" stroke-dasharray="${dash}" stroke-dashoffset="${offset}"></circle>`;
        offset -= len;
        return el;
      }).join('');
      
      const donut = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px 0;">
          <svg viewBox="0 0 120 120" width="180" height="180" style="transform: rotate(-90deg); margin-bottom: 24px;">
            <circle r="45" cx="60" cy="60" fill="transparent" stroke="#f1f5f9" stroke-width="16"></circle>
            ${segs}
            <g transform="rotate(90 60 60)">
              <text x="60" y="58" text-anchor="middle" font-size="20" font-weight="700" fill="#1e293b">${totalC}</text>
              <text x="60" y="72" text-anchor="middle" font-size="11" fill="#64748b">Total</text>
            </g>
          </svg>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 100%;">
            ${segments.map(s => `
              <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
                <div style="width: 12px; height: 12px; background: ${s.color}; border-radius: 3px; margin: 0 auto 8px;"></div>
                <div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">${s.value}</div>
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">${s.label}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      setCardContentByKey('paymentStatusDonut', donut);
    } catch (e) {
      console.warn('Failed to render payments donut', e);
    }

    
    try {
  const tickets = Array.isArray(ticketsResp?.list) ? ticketsResp.list : Array.isArray(ticketsResp?.tickets) ? ticketsResp.tickets : [];
      const isActive = (s) => (/PENDING|ASSIGNED|IN_PROGRESS/i.test(String(s||'')));
      const activeCount = tickets.filter(t => isActive(t.ticket_status)).length;
      setCardValueByKey('openTickets', fmtInt(activeCount));

      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const completedThisMonth = tickets.filter(t => {
        const s = String(t.ticket_status||'');
        if (!/COMPLETED/i.test(s)) return false;
        const ed = t.end_datetime ? new Date(t.end_datetime) : null;
        if (!ed || isNaN(ed)) return false;
        return `${ed.getFullYear()}-${String(ed.getMonth()+1).padStart(2,'0')}` === ym;
      });
      setCardValueByKey('resolvedTicketsThisMonth', fmtInt(completedThisMonth.length));

      
      const durations = completedThisMonth.map(t => {
        const start = t.start_datetime ? new Date(t.start_datetime) : (t.created_at ? new Date(t.created_at) : null);
        const end = t.end_datetime ? new Date(t.end_datetime) : null;
        if (!start || !end || isNaN(start) || isNaN(end)) return 0;
        return Math.max(0, (end.getTime() - start.getTime()) / (1000*60*60));
      }).filter(v => isFinite(v) && v > 0);
      const avgHrs = durations.length ? (durations.reduce((a,b)=>a+b,0) / durations.length) : 0;
      const friendly = avgHrs >= 48 ? `${(avgHrs/24).toFixed(1)} d` : `${avgHrs.toFixed(1)} h`;
      setCardValueByKey('avgResolutionTime', friendly);

      
      const countsByCat = tickets.reduce((m, t) => {
        const k = (t.request_type || 'Other').toString();
        m[k] = (m[k] || 0) + 1; return m;
      }, {});
      const entries = Object.entries(countsByCat).sort((a,b)=>b[1]-a[1]).slice(0,7);
      const maxV = Math.max(1, ...entries.map(([,v])=>v));
      const totalTickets = entries.reduce((sum, [,v]) => sum + v, 0);
      
      const categoryIcons = {
        'Plumbing': 'fas fa-wrench',
        'Electrical': 'fas fa-bolt',
        'HVAC': 'fas fa-fan',
        'Cleaning': 'fas fa-broom',
        'Painting': 'fas fa-paint-roller',
        'Carpentry': 'fas fa-hammer',
        'Security': 'fas fa-shield-alt',
        'Other': 'fas fa-clipboard-list'
      };
      
      const bars = entries.map(([k,v], idx) => {
        const pct = Math.round((v/maxV)*100);
        const sharePct = Math.round((v/totalTickets)*100);
        const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
        const color = colors[idx % colors.length];
  const icon = categoryIcons[k] || 'fas fa-clipboard-list';
        
        return `<div style="margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="${icon}" style="font-size:16px;color:${color};"></i>
              <span style="font-size: 13px; font-weight: 600; color: #334155;">${k}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 11px; color: #64748b;">${sharePct}%</span>
              <span style="font-size: 14px; font-weight: 700; color: ${color};">${v}</span>
            </div>
          </div>
          <div style="height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, ${color}, ${color}cc); border-radius: 5px; transition: width 0.6s ease;"></div>
          </div>
        </div>`;
      }).join('');
      
      setCardContentByKey('maintenanceByCategory', bars || `<div style="color:#64748b; font-size:12px; padding: 40px 0; text-align: center;">No maintenance data</div>`);
    } catch (e) {
      console.warn('Failed to compute maintenance stats', e);
    }

    
    try {
      const leases = Array.isArray(leasesResp?.list) ? leasesResp.list : Array.isArray(leasesResp?.leases) ? leasesResp.leases : [];
      const isActiveLease = (s) => /ACTIVE|PENDING/i.test(String(s || ''));
      const activeLeases = leases.filter(l => isActiveLease(l.lease_status));
      const activeLeasesCount = activeLeases.length;

      
      const activeTenantIds = new Set();
      activeLeases.forEach(l => {
        if (l.tenant_id != null) activeTenantIds.add(String(l.tenant_id));
      });
      const activeTenantsCount = activeTenantIds.size;

      
      const activePropertyIds = new Set();
      activeLeases.forEach(l => { if (l.property_id != null) activePropertyIds.add(String(l.property_id)); });
      const occupiedProps = activePropertyIds.size;
      const denom = Math.max(1, Number(propertiesCount || 0));
      const occPct = Math.max(0, Math.min(100, Math.round((occupiedProps / denom) * 100)));

  setCardValueByKey('kpiActiveLeases', fmtInt(activeLeasesCount));
      setCardValueByKey('kpiOccupancyRate', `${occPct}%`, `${fmtInt(occupiedProps)} of ${fmtInt(denom)} properties occupied`);
    } catch (e) {
      console.warn('Failed to compute summary KPIs from leases', e);
    }

    
    try {
      
      const leases = Array.isArray(leasesResp?.list) ? leasesResp.list : Array.isArray(leasesResp?.leases) ? leasesResp.leases : [];
      const now = new Date();
      const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
      const expiringSoon = leases.filter(l => {
        const end = l?.lease_end_date ? new Date(l.lease_end_date) : null;
        if (!end || isNaN(end)) return false;
        const status = String(l.lease_status || '').toUpperCase();
        return end >= now && end <= soon && (status === 'ACTIVE' || status === 'PENDING');
      }).length;

      const unresolvedTickets = (Array.isArray(ticketsResp?.list) ? ticketsResp.list : Array.isArray(ticketsResp?.tickets) ? ticketsResp.tickets : [])
        .filter(t => !/COMPLETED|CANCELLED/i.test(String(t.ticket_status||''))).length;

      
      const newContacts = Number(
        (contactsResp?.stats && (contactsResp.stats.pending ?? contactsResp.stats.unresponded))
        ?? contactsResp?.total
        ?? 0
      );

      const alertsHtml = `
        <div class="alerts-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#fff7ed; border:1px solid #fde68a; border-radius:10px;">
            <div style="display:flex; align-items:center; gap:10px; color:#92400e;">
              <i class="fas fa-calendar-alt"></i>
              <div>
                <div style="font-weight:700; font-size:13px;">Leases expiring ≤ 30 days</div>
                <div style="font-size:12px; color:#9a3412;">Review upcoming renewals</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-weight:800; color:#b45309;">${fmtInt(expiringSoon)}</span>
              <button type="button" data-action="goto-leases" class="btn-link">View</button>
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#fef2f2; border:1px solid #fecaca; border-radius:10px;">
            <div style="display:flex; align-items:center; gap:10px; color:#991b1b;">
              <i class="fas fa-exclamation-triangle"></i>
              <div>
                <div style="font-weight:700; font-size:13px;">Overdue payments</div>
                <div style="font-size:12px; color:#9f1239;">Take action on late charges</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-weight:800; color:#b91c1c;">${fmtInt(overdueCharges)}</span>
              <button type="button" data-action="goto-overdue" class="btn-link">Review</button>
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px;">
            <div style="display:flex; align-items:center; gap:10px; color:#1e3a8a;">
              <i class="fas fa-hourglass-half"></i>
              <div>
                <div style="font-weight:700; font-size:13px;">Pending confirmations</div>
                <div style="font-size:12px; color:#1d4ed8;">Approve or decline payments</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-weight:800; color:#1d4ed8;">${fmtInt(pendingPaymentsCount)}</span>
              <button type="button" data-action="goto-pending" class="btn-link">Process</button>
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#ecfeff; border:1px solid #a5f3fc; border-radius:10px;">
            <div style="display:flex; align-items:center; gap:10px; color:#075985;">
              <i class="fas fa-tools"></i>
              <div>
                <div style="font-weight:700; font-size:13px;">Unresolved maintenance</div>
                <div style="font-size:12px; color:#0369a1;">View active tickets</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-weight:800; color:#0ea5e9;">${fmtInt(unresolvedTickets)}</span>
              <button type="button" data-action="goto-maint" class="btn-link">Open</button>
            </div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; grid-column: span 2;">
            <div style="display:flex; align-items:center; gap:10px; color:#065f46;">
              <i class="fas fa-envelope"></i>
              <div>
                <div style="font-weight:700; font-size:13px;">New Contact Us inquiries</div>
                <div style="font-size:12px; color:#047857;">Respond to incoming messages</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-weight:800; color:#059669;">${fmtInt(newContacts)}</span>
              <button type="button" data-action="goto-contacts" class="btn-link">View</button>
            </div>
          </div>
        </div>
      `;
      setCardContentByKey('alerts', alertsHtml);

      
      try {
        const card = findCardByKey('alerts');
        if (card) {
          card.querySelector('[data-action="goto-leases"]')?.addEventListener('click', () => {
            window.location.href = '/leaseAdmin.html';
          });
          card.querySelector('[data-action="goto-overdue"]')?.addEventListener('click', () => {
            try { localStorage.setItem('paymentAdminDeepLink', JSON.stringify({ tab: 'charges', chargesStatus: 'overdue' })); } catch {}
            window.location.href = '/paymentAdmin.html';
          });
          card.querySelector('[data-action="goto-pending"]')?.addEventListener('click', () => {
            try { localStorage.setItem('paymentAdminDeepLink', JSON.stringify({ tab: 'payments', view: 'pending', pendingStatus: 'Pending' })); } catch {}
            window.location.href = '/paymentAdmin.html';
          });
          card.querySelector('[data-action="goto-maint"]')?.addEventListener('click', () => {
            window.location.href = '/maintenance.html';
          });
          card.querySelector('[data-action="goto-contacts"]')?.addEventListener('click', () => {
            
            window.location.href = '/messagesAdmin.html';
          });
        }
      } catch {}
    } catch (e) {
      console.warn('Failed to render alerts section', e);
    }
  } catch (e) {
    console.warn('Extended metrics load failed', e);
  }
}

export async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `${company.company_name} Admin Dashboard`
    : "Ambulo Properties Admin Dashboard";
}


export function wireDashboardShortcuts() {
  
  const cards = Array.from(document.querySelectorAll(".dashboard-grid .card, .transactions-section .card"));

  function navigateTo(target, deepLink) {
    try {
      if (deepLink && target && /paymentAdmin\.html$/i.test(target)) {
        localStorage.setItem("paymentAdminDeepLink", JSON.stringify(deepLink));
      }
    } catch (_) {}
    if (target) window.location.href = target;
  }

  cards.forEach((card) => {
    const titleEl = card.querySelector(".card-title");
    const title = (titleEl && titleEl.textContent || "").trim();
    if (!title) return;

    if (/^total\s*property/i.test(title)) {
      card.style.cursor = "pointer";
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", "Go to Properties");
      card.addEventListener("click", () => navigateTo("/propertyAdmin.html"));
    }
    if (/total\s+number\s+of\s+transaction/i.test(title)) {
      card.style.cursor = "pointer";
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", "Go to Payments - History");
      card.addEventListener("click", () =>
        navigateTo("/paymentAdmin.html", { tab: "payments", view: "all" })
      );
    }
    if (/^total\s*income/i.test(title)) {
      card.style.cursor = "pointer";
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", "Go to Payments - Totals");
      card.addEventListener("click", () =>
        navigateTo("/paymentAdmin.html", { tab: "payments", view: "all" })
      );
    }
    if (/maintenance\s*request/i.test(title)) {
      const seeAll = card.querySelector(".see-all");
      if (seeAll) {
        seeAll.href = "/maintenance.html";
        seeAll.addEventListener("click", (e) => {
          e.preventDefault();
          navigateTo("/maintenance.html");
        });
      }
    }
    if (/last\s*transaction/i.test(title)) {
      const seeAll = card.querySelector(".see-all");
      if (seeAll) {
        seeAll.href = "/paymentAdmin.html";
        seeAll.addEventListener("click", (e) => {
          e.preventDefault();
          navigateTo("/paymentAdmin.html", { tab: "payments", view: "all" });
        });
      }
    }
  });

  
  const latePaymentsCard = Array.from(document.querySelectorAll(".transactions-section .card"))
    .find((c) => /late\s*payments/i.test((c.querySelector(".card-title")?.textContent || "").trim()));
  if (latePaymentsCard) {
    latePaymentsCard.style.cursor = "pointer";
    latePaymentsCard.setAttribute("role", "link");
    latePaymentsCard.setAttribute("aria-label", "Go to Payments - Pending");
    latePaymentsCard.addEventListener("click", () =>
      navigateTo("/paymentAdmin.html", { tab: "payments", view: "pending", pendingStatus: "Pending" })
    );
  }
}


window.AdminDashboard = Object.assign(window.AdminDashboard || {}, {
  loadMetrics: loadDashboardMetrics,
  wireShortcuts: wireDashboardShortcuts,
  setTitleBranding: setDynamicInfo,
  render: renderDashboard,
});