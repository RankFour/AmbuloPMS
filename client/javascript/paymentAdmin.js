import fetchCompanyDetails from "../api/loadCompanyInfo.js";
import { getJwtToken } from "../utils/getCookie.js";

const tenantsCache = { data: null, fetchedAt: 0, ttl: 1000 * 60 * 5 };
const leasesCache = {};
const propertiesCache = {};

const leasesData = [];

let filteredCharges = [];
let filteredPayments = [];
let filteredData = [...leasesData];
let editingChargeId = null;
let currentPaymentCharge = null;
let currentViewingCharge = null;
let chargeToDelete = null;
let currentPaymentFilter = "all";
let currentEditingCharge = null;

let charges = [];
let payments = [];
let paymentsPage = 1;
let paymentsLimit = 10;
let paymentsTotal = 0;

let currentSort = { key: null, dir: "asc" };

let chargesGrouping = "status";
let chargesGroupCollapsed = {};

const CHARGE_TYPES_LIST = (window.AppConstants &&
    window.AppConstants.CHARGE_TYPES) ||
    (typeof CHARGE_TYPES !== "undefined" && CHARGE_TYPES) || [
        { value: "Rent", label: "Rent" },
        { value: "Utility", label: "Utility" },
        { value: "Maintenance", label: "Maintenance" },
        { value: "Late Fee", label: "Late Fee" },
        { value: "Others", label: "Others" },
    ];

const CHARGE_STATUSES_CONST = (window.AppConstants &&
    window.AppConstants.CHARGE_STATUSES) ||
    (typeof CHARGE_STATUSES !== "undefined" && CHARGE_STATUSES) || {
    UNPAID: "UNPAID",
    PARTIALLY_PAID: "PARTIALLY_PAID",
    PAID: "PAID",
    WAIVED: "WAIVED",
};

const CHARGE_STATUS_MAPPINGS_CONST = (window.AppConstants &&
    window.AppConstants.CHARGE_STATUS_MAPPINGS) ||
    (typeof CHARGE_STATUS_MAPPINGS !== "undefined" && CHARGE_STATUS_MAPPINGS) || {
    [CHARGE_STATUSES_CONST.UNPAID]: {
        label: "Unpaid",
        color: "#ef4444",
        textColor: "#ffffff",
    },
    [CHARGE_STATUSES_CONST.PARTIALLY_PAID]: {
        label: "Partially Paid",
        color: "#f59e0b",
        textColor: "#ffffff",
    },
    [CHARGE_STATUSES_CONST.PAID]: {
        label: "Paid",
        color: "#10b981",
        textColor: "#ffffff",
    },
    [CHARGE_STATUSES_CONST.WAIVED]: {
        label: "Waived",
        color: "#6b7280",
        textColor: "#ffffff",
    },
};

const API_BASE_URL = "/api/v1";




const showAlert = (message, type = "info") => {
    try {
        if (window.ModalHelpers && typeof window.ModalHelpers.showAlert === "function") {
            return window.ModalHelpers.showAlert(message, type);
        }
        if (typeof window.showAlert === "function") {
            return window.showAlert(message, type);
        }
    } catch (e) {
        console.warn("showAlert binding failed, falling back to window.alert", e);
    }
    return window.alert((type ? type.toUpperCase() + ": " : "") + String(message));
};

const showConfirm = (message, title = "Confirm") => {
    try {
        if (window.ModalHelpers && typeof window.ModalHelpers.showConfirm === "function") {
            return window.ModalHelpers.showConfirm(message, title);
        }
        if (typeof window.showConfirm === "function") {
            return window.showConfirm(message, title);
        }
    } catch (e) {
        console.warn("showConfirm binding failed, falling back to native confirm", e);
    }
    return Promise.resolve(window.confirm(String(message)));
};

const showPrompt = (message, placeholder = "", title = "Input") => {
    try {
        if (window.ModalHelpers && typeof window.ModalHelpers.showPrompt === "function") {
            return window.ModalHelpers.showPrompt(message, placeholder, title);
        }
        if (typeof window.showPrompt === "function") {
            return window.showPrompt(message, placeholder, title);
        }
    } catch (e) {
        console.warn("showPrompt binding failed, falling back to native prompt", e);
    }
    return Promise.resolve(window.prompt(String(message)));
};

const CACHE_TTLS = {
    payments: 60 * 1000,
    charges: 60 * 1000,
    stats: 30 * 1000,
    allocations: 5 * 60 * 1000,
};

const paymentsListCache = new Map();
const chargesListCache = new Map();
let statsCache = { data: null, fetchedAt: 0 };

function makeCacheKey(base, params) {
    try {
        const entries = [];
        for (const [k, v] of params.entries()) entries.push([k, v]);
        entries.sort((a, b) =>
            a[0] > b[0]
                ? 1
                : a[0] < b[0]
                    ? -1
                    : String(a[1]).localeCompare(String(b[1]))
        );
        return `${base}?${entries.map(([k, v]) => `${k}=${v}`).join("&")}`;
    } catch {
        return `${base}`;
    }
}

function isFresh(ts, ttl) {
    return ts && Date.now() - ts < ttl;
}

function invalidatePaymentsCache() {
    paymentsListCache.clear();
}
function invalidateChargesCache() {
    chargesListCache.clear();
}
function invalidateStatsCache() {
    statsCache = { data: null, fetchedAt: 0 };
}

async function fetchPaymentAllocations(paymentId) {
    const token = getJwtToken();
    const resp = await fetch(
        `${API_BASE_URL}/payments/${encodeURIComponent(paymentId)}/allocations`,
        {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
    );
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(
            body.message || `Failed to load allocations (${resp.status})`
        );
    }
    const data = await resp.json().catch(() => ({ allocations: [] }));
    return Array.isArray(data.allocations) ? data.allocations : [];
}

const adminPaymentAllocCache = {};
const adminPaymentAllocCacheTs = {};
async function preloadAdminAllocationsForPayments() {
    try {
        const list = Array.isArray(filteredPayments) ? filteredPayments : [];
        const ids = list.map((p) => p.id).filter(Boolean);
        const promises = ids.map(async (pid, index) => {
            const p = list[index];
            if (!pid) return;
            if (adminPaymentAllocCache[pid]) {
                p.__hasAllocations =
                    Array.isArray(adminPaymentAllocCache[pid]) &&
                    adminPaymentAllocCache[pid].length > 0;
                return;
            }
            const allocs = await fetchPaymentAllocations(pid).catch(() => []);
            adminPaymentAllocCache[pid] = allocs;
            adminPaymentAllocCacheTs[pid] = Date.now();
            p.__hasAllocations = Array.isArray(allocs) && allocs.length > 0;
        });
        await Promise.allSettled(promises);
    } catch { }
}

function getCachedAllocations(paymentId) {
    const ttl = CACHE_TTLS.allocations;
    const ts = adminPaymentAllocCacheTs[paymentId] || 0;
    if (adminPaymentAllocCache[paymentId] && isFresh(ts, ttl)) {
        return adminPaymentAllocCache[paymentId];
    }
    return null;
}

function setCachedAllocations(paymentId, allocs) {
    adminPaymentAllocCache[paymentId] = allocs;
    adminPaymentAllocCacheTs[paymentId] = Date.now();
}

function ensureAllocationsModal() {
    let modal = document.getElementById("allocations-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "allocations-modal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-list-ul"></i> Payment Allocations</h2>
                    <button class="close-btn" onclick="closeAdminAllocationsModal()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body" id="allocations-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    return modal;
}

window.viewPaymentAllocations = async function (paymentId) {
    try {
        const modal = ensureAllocationsModal();
        const body = modal.querySelector("#allocations-modal-body");
        body.innerHTML = `<div class="loading" style="margin: 1rem 0;">Loading allocations…</div>`;
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
        const allocations = await fetchPaymentAllocations(paymentId).catch(
            () => []
        );
        body.innerHTML = buildAdminAllocationsHtml(allocations);
    } catch (e) {
        try {
            showAlert(e.message || "Failed to load allocations", "error");
        } catch { }
    }
};

window._paymentsRefHidden = true;
window.toggleReferenceVisibility = function () {
    window._paymentsRefHidden = !window._paymentsRefHidden;
    try {
        renderPaymentsTable();
    } catch (e) {
        console.error(e);
    }
};

function renderPaymentsTable() {
    const tbody = document.getElementById("payments-tbody");
    if (!tbody) return;

    if (!Array.isArray(filteredPayments) || filteredPayments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12">
                    <div class="empty-state" style="text-align: center; padding: 40px 20px;">
                        <i class="fas fa-inbox" style="font-size: 2rem; color: #94a3b8; margin-bottom: 12px;"></i>
                        <h3 style="color: #64748b; margin-bottom: 8px;">No payments found</h3>
                        <p style="color: #94a3b8;">No payment history available</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const baseIndex = (paymentsPage - 1) * paymentsLimit;
    const refHidden = !!window._paymentsRefHidden;
    const maskedRef = (ref) => {
        const s = String(ref || "");
        if (!s) return "";
        const last4 = s.slice(-4);

        return `•••• ${last4}`;
    };

    tbody.innerHTML = filteredPayments
        .map((payment, idx) => {
            const hasAlloc = !!payment.__hasAllocations;
            const allocIndicatorPill = hasAlloc
                ? `<span class="alloc-indicator" style="margin-top:6px;background:#eef2ff;color:#4f46e5;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:6px;max-width:max-content;"><i class="fas fa-layer-group"></i> Allocations</span>`
                : "";
            const allocToggle = hasAlloc
                ? `<button class="btn btn-sm btn-light" title="Toggle Allocations" onclick="event.stopPropagation(); toggleAdminPaymentAllocationsRow('${payment.id}')"><i class="fas fa-chevron-down" id="admin-alloc-chevron-${payment.id}"></i></button>`
                : "";
            const invoiceButtons =
                String(payment.status || "").toLowerCase() === "confirmed"
                    ? `
                <button onclick="event.stopPropagation(); viewInvoicePDF('${payment.id}')" class="btn btn-sm btn-secondary" title="View Invoice (PDF)">
                    <i class="fas fa-file-pdf"></i>
                </button>
                <button onclick="event.stopPropagation(); downloadInvoicePDF('${payment.id}')" class="btn btn-sm btn-primary" title="Download Invoice (PDF)">
                    <i class="fas fa-download"></i>
                </button>`
                    : ``;

            const mainRow = `
                <tr ${hasAlloc
                    ? `onclick="toggleAdminPaymentAllocationsRow('${payment.id}')" style="cursor:pointer;"`
                    : ""
                }>
                    <td class="row-number">${String(
                    baseIndex + idx + 1
                ).padStart(2, "0")}</td>
                    <td class="reference-cell">
                        <code class="reference-code ${refHidden ? "masked" : ""
                }">${refHidden
                    ? maskedRef(payment.reference)
                    : escapeHtml(String(payment.reference || ""))
                }</code>
                    </td>
                    <td>
                        <div class="tenant-info">
                            <strong>${escapeHtml(
                    payment.tenant || "—"
                )}</strong>
                        </div>
                    </td>
                    <td>
                        <div class="unit-info"><strong>${escapeHtml(
                    payment.unit || "—"
                )}</strong></div>
                    </td>
                    <td class="payment-description">${escapeHtml(
                    payment.description ||
                    payment.charge_description ||
                    `Charge #${payment.charge_id || "N/A"}`
                )}</td>
                    <td class="payment-amount">${formatCurrency(
                    Number(payment.amount) || 0
                )}${allocIndicatorPill ? `<div>${allocIndicatorPill}</div>` : ""
                }</td>
                    <td><span class="payment-method">${escapeHtml(
                    capitalizeFirst(payment.paymentMethod || "")
                )}</span></td>
                    <td class="payment-notes">${escapeHtml(
                    payment.notes || ""
                )}</td>
                    <td class="payment-date">${formatDate(
                    payment.paymentDate
                )}</td>
                    <td class="payment-status">${renderPaymentStatusBadge(
                    payment.status
                )}</td>
                    <td class="payment-processed-by">${escapeHtml(
                    payment.processedBy || ""
                )}</td>
                    <td class="actions-cell">
                        ${allocToggle}
                        ${invoiceButtons}
                    </td>
                </tr>`;
            const allocRow = hasAlloc
                ? `
                <tr id="admin-alloc-row-${payment.id}" class="payment-alloc-row" style="display:none;background:#fafafa;">
                    <td colspan="12" style="padding:12px 16px;">
                        <div id="admin-alloc-content-${payment.id}" class="allocations-list">
                            <div class="loading" style="margin:4px 0;">Loading allocations…</div>
                        </div>
                    </td>
                </tr>`
                : "";
            return mainRow + allocRow;
        })
        .join("");

    const mobileCards = document.getElementById("payments-mobile");
    if (mobileCards) {
        mobileCards.innerHTML = filteredPayments
            .map((payment) => {
                const hasAlloc = !!payment.__hasAllocations;
                const allocIndicatorPillMobile = hasAlloc
                    ? `<span class="alloc-indicator" style="margin-top:6px;background:#eef2ff;color:#4f46e5;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:6px;max-width:max-content;"><i class="fas fa-layer-group"></i> Allocations</span>`
                    : "";
                const allocToggle = hasAlloc
                    ? `<button class="btn btn-sm btn-light" title="Toggle Allocations" onclick="toggleAdminPaymentAllocationsCard('${payment.id}')"><i class="fas fa-chevron-down" id="admin-alloc-chevron-mobile-${payment.id}"></i></button>`
                    : "";
                const invoiceButtons =
                    String(payment.status || "").toLowerCase() === "confirmed"
                        ? `
                <button onclick="viewInvoicePDF('${payment.id}')" class="btn btn-sm btn-secondary" title="View Invoice (PDF)">\n<i class="fas fa-file-pdf"></i></button>
                <button onclick="downloadInvoicePDF('${payment.id}')" class="btn btn-sm btn-primary" title="Download Invoice (PDF)">\n<i class="fas fa-download"></i></button>`
                        : ``;
                const refValue = String(payment.reference || "");
                const masked = refHidden
                    ? refValue
                        ? `•••• ${refValue.slice(-4)}`
                        : ""
                    : refValue;
                const headerClick = hasAlloc
                    ? `onclick=\"toggleAdminPaymentAllocationsCard('${payment.id}')\" style=\"cursor:pointer;\"`
                    : "";
                return `
                <div class="payment-card">
                    <div class="card-header" ${headerClick}>
                        <div class="card-title">${escapeHtml(
                    payment.tenant || "—"
                )} - ${escapeHtml(payment.unit || "—")}</div>
                        <div class="card-amount payment">${formatCurrency(
                    Number(payment.amount) || 0
                )}${hasAlloc
                        ? `<div style=\"margin-top:6px;\">${allocIndicatorPillMobile}</div>`
                        : ""
                    }</div>
                    </div>
                    <div class="card-details">
                        <div class="card-detail-row"><span class="card-detail-label">Reference</span><span class="card-detail-value"><code id="mobile-ref-${payment.id
                    }" class="reference-code ${refHidden ? "masked" : ""
                    }" data-full="${escapeHtml(refValue)}" data-masked="${escapeHtml(
                        masked
                    )}" onclick="toggleMobileReference('${payment.id
                    }')" style="cursor:pointer;">${escapeHtml(masked)}</code></span></div>
                        <div class="card-detail-row"><span class="card-detail-label">Description</span><span class="card-detail-value">${escapeHtml(
                        payment.description ||
                        payment.charge_description ||
                        `Charge #${payment.charge_id || "N/A"}`
                    )}</span></div>
                        <div class="card-detail-row"><span class="card-detail-label">Method</span><span class="card-detail-value"><span class="payment-method">${escapeHtml(
                        capitalizeFirst(payment.paymentMethod || "")
                    )}</span></span></div>
                        <div class="card-detail-row"><span class="card-detail-label">Payment Date</span><span class="card-detail-value">${formatDate(
                        payment.paymentDate
                    )}</span></div>
                        <div class="card-detail-row"><span class="card-detail-label">Status</span><span class="card-detail-value">${renderPaymentStatusBadge(
                        payment.status
                    )}</span></div>
                        <div class="card-detail-row"><span class="card-detail-label">Processed By</span><span class="card-detail-value">${escapeHtml(
                        payment.processedBy || ""
                    )}</span></div>
                    </div>
                    <div class="card-actions">
                        ${allocToggle}
                        ${invoiceButtons}
                    </div>
                    <div class="mobile-allocations" id="admin-alloc-card-${payment.id
                    }" style="display:none;padding:8px 12px;background:#fafafa;border-top:1px dashed #e5e7eb;"></div>
                </div>`;
            })
            .join("");
    }
}

window.toggleAdminPaymentAllocationsCard = async function (paymentId) {
    try {
        const container = document.getElementById(`admin-alloc-card-${paymentId}`);
        if (!container) return;
        const isHidden = getComputedStyle(container).display === "none";
        if (isHidden) {
            if (!container.dataset.loaded) {
                container.innerHTML =
                    '<div class="loading" style="margin:4px 0;">Loading allocations…</div>';
                let allocs = getCachedAllocations(paymentId);
                if (!allocs) {
                    allocs = await fetchPaymentAllocations(paymentId).catch(() => []);
                    setCachedAllocations(paymentId, allocs);
                }
                container.innerHTML = buildAdminAllocationsHtml(allocs);
                container.dataset.loaded = "1";
            }
            container.style.display = "block";
        } else {
            container.style.display = "none";
        }
        const chev = document.getElementById(
            `admin-alloc-chevron-mobile-${paymentId}`
        );
        if (chev) chev.className = `fas fa-chevron-${isHidden ? "up" : "down"}`;
    } catch (e) {
        console.error(e);
        showAlert("Failed to toggle allocations", "error");
    }
};

window.toggleMobileReference = function (paymentId) {
    const el = document.getElementById(`mobile-ref-${paymentId}`);
    if (!el) return;
    const isMasked = el.classList.contains("masked");
    if (isMasked) {
        el.textContent = el.dataset.full || "";
        el.classList.remove("masked");
    } else {
        el.textContent = el.dataset.masked || "";
        el.classList.add("masked");
    }
};

async function fetchAllPayments(
    page = 1,
    limit = paymentsLimit,
    { force = false } = {}
) {
    try {
        const methodEl = document.getElementById("payments-method");
        const typeEl = document.getElementById("payments-type");
        const dateEl = document.getElementById("payments-date");
        const searchEl = document.getElementById("payments-search");

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        const method = methodEl ? methodEl.value : "";
        const paymentType = typeEl ? typeEl.value : "";
        const month = dateEl ? dateEl.value : "";
        const search = searchEl ? searchEl.value : "";
        if (method) params.set("payment_method", method);
        if (paymentType) params.set("payment_type", paymentType);
        if (month) params.set("month", month);
        if (search) params.set("q", search);

        const cacheKey = makeCacheKey(`${API_BASE_URL}/payments`, params);
        const cached = paymentsListCache.get(cacheKey);
        if (!force && cached && isFresh(cached.fetchedAt, CACHE_TTLS.payments)) {
            payments = cached.data;
            paymentsPage = cached.page;
            paymentsLimit = cached.limit;
            paymentsTotal = cached.total;
            filteredPayments = [...payments];
            await preloadAdminAllocationsForPayments();
            renderPaymentsTable();
            renderPaymentsPagination();
            requestStatisticsUpdate();
            return;
        }

        setPaymentsLoading(true, force ? "Refreshing…" : "Loading…");

        const res = await fetch(`${API_BASE_URL}/payments?${params.toString()}`, {
            credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to fetch payments: ${res.status}`);
        const json = await res.json();
        const rows = json.payments || [];
        payments = rows.map((p) => ({
            id: p.payment_id,
            charge_id: p.charge_id,
            tenant: p.tenant_name || "—",
            unit: p.property_name || "—",
            paymentDate: p.created_at,
            description: p.charge_description || "",
            type: p.charge_type || "",
            amount: Number(p.amount_paid) || 0,
            paymentMethod: p.payment_method || "",
            reference: p.payment_id,
            notes: p.notes || p.payment_notes || p.remarks || "",
            status: p.status || p.payment_status || p.state || "",
            processedBy: p.processed_by_name || "",
            proofs: p.proofs || [],
        }));
        paymentsPage = Number(json.page) || page;
        paymentsLimit = Number(json.limit) || limit;
        paymentsTotal = Number(json.total) || rows.length;

        paymentsListCache.set(cacheKey, {
            data: payments,
            page: paymentsPage,
            limit: paymentsLimit,
            total: paymentsTotal,
            fetchedAt: Date.now(),
        });

        filteredPayments = [...payments];
        await preloadAdminAllocationsForPayments();
        renderPaymentsTable();
        renderPaymentsPagination();
        requestStatisticsUpdate();
    } catch (err) {
        console.error(err);
    }
}

function buildAdminAllocationsHtml(allocs) {
    if (!Array.isArray(allocs) || allocs.length === 0) {
        return `<div class="empty-state"><div class="empty-icon"><i class="fas fa-file-invoice"></i></div><div>No allocations recorded for this payment.</div></div>`;
    }
    return `
        <div class="allocations-list">
            ${allocs
            .map(
                (a) => `
                <div class="allocation-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">
                    <div class="allocation-main">
                        <div class="alloc-desc"><strong>${escapeHtml(
                    a.description || "Charge"
                )}</strong> <small style="color:#6b7280;">${escapeHtml(
                    a.charge_type || ""
                )}</small></div>
                        <div class="alloc-meta">Charge ID: ${escapeHtml(
                    String(a.charge_id || "")
                )}</div>
                    </div>
                    <div class="allocation-amount">${formatCurrency(
                    a.amount
                )}</div>
                </div>
            `
            )
            .join("")}
        </div>
    `;
}

window.toggleAdminPaymentAllocationsRow = async function (paymentId) {
    try {
        const row = document.getElementById(`admin-alloc-row-${paymentId}`);
        const chev = document.getElementById(`admin-alloc-chevron-${paymentId}`);
        if (!row) return;
        const cs = window.getComputedStyle(row);
        const isHidden = cs.display === "none";
        if (isHidden) {
            const container = document.getElementById(
                `admin-alloc-content-${paymentId}`
            );
            const cached = getCachedAllocations(paymentId);
            if (cached) {
                container.innerHTML = buildAdminAllocationsHtml(cached);
            } else {
                container.innerHTML = `<div class="loading" style="margin:4px 0;">Loading allocations…</div>`;
                const allocs = await fetchPaymentAllocations(paymentId).catch(() => []);
                setCachedAllocations(paymentId, allocs);
                container.innerHTML = buildAdminAllocationsHtml(allocs);
            }
            row.style.display = "";
            if (chev) {
                chev.classList.remove("fa-chevron-down");
                chev.classList.add("fa-chevron-up");
            }
        } else {
            row.style.display = "none";
            if (chev) {
                chev.classList.remove("fa-chevron-up");
                chev.classList.add("fa-chevron-down");
            }
        }
    } catch (e) {
        console.warn("toggleAdminPaymentAllocationsRow error", e);
    }
};

async function fetchInvoiceBlob(paymentId, download = false) {
    try {
        const token = typeof getJwtToken === "function" ? getJwtToken() : null;
        const url = `${API_BASE_URL}/payments/${encodeURIComponent(
            paymentId
        )}/invoice.pdf${download ? "?download=1" : ""}`;
        const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: token ? "same-origin" : "include",
        });
        if (!res.ok) throw new Error(`Failed to fetch invoice: ${res.status}`);
        const blob = await res.blob();
        return blob;
    } catch (e) {
        console.error("Invoice fetch failed", e);
        showAlert("Unable to load invoice PDF.", "error");
        return null;
    }
}

window.viewInvoicePDF = async function (paymentId) {
    try {
        const token = typeof getJwtToken === "function" ? getJwtToken() : null;
        const url = `${API_BASE_URL}/payments/${encodeURIComponent(
            paymentId
        )}/invoice.pdf`;
        const res = await fetch(url, {
            method: "GET",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: "include",
        });
        if (!res.ok) {
            console.error("Invoice fetch failed", res.status, res.statusText);
            showAlert("Unable to load invoice PDF.", "error");
            return;
        }
        const ctype = (res.headers.get("content-type") || "").toLowerCase();
        if (!ctype.includes("application/pdf")) {
            const txt = await res.text();
            console.error("Unexpected content-type for invoice:", ctype, txt);
            showAlert("Invoice response is not a PDF.", "error");
            return;
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
        console.error("Invoice preview error", e);
        showAlert("Unable to open invoice PDF.", "error");
    }
};

window.downloadInvoicePDF = function (paymentId) {
    const url = `${API_BASE_URL}/payments/${encodeURIComponent(
        paymentId
    )}/invoice.pdf?download=1`;

    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
};

function renderPaymentsPagination() {
    const container = document.getElementById("payments-pagination");
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(paymentsTotal / paymentsLimit));
    const page = paymentsPage;
    const makeBtn = (label, disabled, onClick, active) => `
        <button class="page-btn ${active ? "active" : ""}" ${disabled ? "disabled" : ""
        } data-action="${onClick}">${label}</button>
    `;
    const parts = [];
    parts.push(makeBtn("Prev", page <= 1, "prev", false));
    const maxButtons = 5;
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    if (start > 1) parts.push(`<span class="ellipsis">...</span>`);
    for (let p = start; p <= end; p++)
        parts.push(makeBtn(String(p), false, `page:${p}`, p === page));
    if (end < totalPages) parts.push(`<span class="ellipsis">...</span>`);
    parts.push(makeBtn("Next", page >= totalPages, "next", false));
    container.innerHTML = parts.join("");
    container.querySelectorAll(".page-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const action = btn.getAttribute("data-action");
            if (action === "prev" && paymentsPage > 1)
                fetchAllPayments(paymentsPage - 1, paymentsLimit);
            else if (action === "next" && paymentsPage < totalPages)
                fetchAllPayments(paymentsPage + 1, paymentsLimit);
            else if (action && action.startsWith("page:")) {
                const p = parseInt(action.split(":")[1], 10);
                if (!isNaN(p)) fetchAllPayments(p, paymentsLimit);
            }
        });
    });
}

async function setDynamicInfo() {
    const company = await fetchCompanyDetails();
    if (!company) return;

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && company.icon_logo_url) {
        favicon.href = company.icon_logo_url;
    }

    document.title = company.company_name
        ? `Manage Payment - ${company.company_name}`
        : "Manage Payment";
}

function onReady(fn) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
        fn();
    }
}

function ensureLoadingStyles() {
    if (document.getElementById("admin-loading-styles")) return;
    const style = document.createElement("style");
    style.id = "admin-loading-styles";
    style.textContent = `
        .loading-row { display:flex; justify-content:center; align-items:center; gap:8px; color:#64748b; padding:16px; }
        .loading-row .spinner { width:14px; height:14px; border:2px solid #cbd5e1; border-top-color:#3b82f6; border-radius:50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
}

function setChargesLoading(isLoading, message = "Loading…") {
    const tbody = document.getElementById("charges-tbody");
    const mobile = document.getElementById("charges-mobile");
    if (!tbody) return;
    if (isLoading) {
        ensureLoadingStyles();
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-state">
                    <div class="loading-row"><span class="spinner"></span>${message}</div>
                </td>
            </tr>
        `;
        if (mobile)
            mobile.innerHTML = `<div class="loading-row"><span class="spinner"></span>${message}</div>`;
    }
}

function setPaymentsLoading(isLoading, message = "Loading…") {
    const tbody = document.getElementById("payments-tbody");
    if (!tbody) return;
    if (isLoading) {
        ensureLoadingStyles();
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-state">
                    <div class="loading-row"><span class="spinner"></span>${message}</div>
                </td>
            </tr>
        `;
    }
}

function setStatsLoading(isLoading) {
    const outstandingElement = document.getElementById("outstanding-charges");
    const collectedElement = document.getElementById("collected-amount");
    const pendingElement = document.getElementById("pending-charges");
    const revenueElement = document.getElementById("total-revenue");
    if (!isLoading) return;
    const set = (el) => el && (el.textContent = "Refreshing…");
    set(outstandingElement);
    set(collectedElement);
    set(pendingElement);
    set(revenueElement);
}

let statsUpdateTimer = null;
let statsUpdateForcePending = false;
function requestStatisticsUpdate({ force = false } = {}) {
    statsUpdateForcePending = statsUpdateForcePending || !!force;
    setStatsLoading(true);
    if (statsUpdateTimer) clearTimeout(statsUpdateTimer);
    statsUpdateTimer = setTimeout(async () => {
        const useForce = statsUpdateForcePending;
        statsUpdateForcePending = false;
        statsUpdateTimer = null;
        await updateStatistics({ force: useForce });
    }, 250);
}

onReady(() => {
    setDynamicInfo();
    requestStatisticsUpdate();
});

function hydrateChargesFromServer(serverCharges) {
    try {
        leasesData.length = 0;
        charges = [];
        payments = [];
        filteredCharges = [];
        filteredPayments = [];

        (serverCharges || []).forEach((row) => {
            const mappedCharge = {
                id: row.charge_id || row.id,
                type: row.charge_type || row.type,
                description: row.description || "",
                amount:
                    typeof row.amount === "number"
                        ? row.amount
                        : parseFloat(row.amount) || 0,
                original_amount:
                    row.original_amount != null
                        ? typeof row.original_amount === "number"
                            ? row.original_amount
                            : parseFloat(row.original_amount) || 0
                        : null,
                late_fee_amount:
                    row.late_fee_amount != null
                        ? typeof row.late_fee_amount === "number"
                            ? row.late_fee_amount
                            : parseFloat(row.late_fee_amount) || 0
                        : 0,
                total_paid:
                    typeof row.total_paid === "number"
                        ? row.total_paid
                        : parseFloat(row.total_paid) || 0,
                canonical_status:
                    row.canonical_status ||
                    (row.status
                        ? String(row.status).toUpperCase().replace(/\s+/g, "_")
                        : null),
                dueDate: row.due_date || row.dueDate || row.due_date_time || null,
                status: row.status || "Unpaid",
                createdDate: row.charge_date || row.createdDate || null,
                notes: row.notes || "",
                isRecurring: !!row.is_recurring,
                template_id: row.template_id || null,
                leaseId: row.lease_id || row.leaseId || null,
                gracePeriodDays:
                    parseInt(
                        row.grace_period_days || row.gracePeriodDays || row.grace || 0,
                        10
                    ) || 0,
                tenant: row.tenant || row.tenant_name || row.tenantName || "",
                unit: row.unit || row.unit_number || row.unitNumber || "",
            };

            let lease = null;
            if (mappedCharge.leaseId) {
                lease = leasesData.find(
                    (l) =>
                        l.id === mappedCharge.leaseId || l.lease_id === mappedCharge.leaseId
                );
            }

            if (lease) {
                lease.charges = lease.charges || [];

                if (
                    (lease.late_fee_percentage === undefined ||
                        lease.late_fee_percentage === null) &&
                    (row.lease_late_fee_percentage !== undefined ||
                        row.late_fee_percentage !== undefined ||
                        row.lateFeePercentage !== undefined)
                ) {
                    lease.late_fee_percentage =
                        typeof row.lease_late_fee_percentage === "number" &&
                            row.lease_late_fee_percentage >= 0
                            ? row.lease_late_fee_percentage
                            : typeof row.late_fee_percentage === "number" &&
                                row.late_fee_percentage >= 0
                                ? row.late_fee_percentage
                                : typeof row.lateFeePercentage === "number" &&
                                    row.lateFeePercentage >= 0
                                    ? row.lateFeePercentage
                                    : 0;
                }
                const exists = lease.charges.some((c) => c.id === mappedCharge.id);
                if (!exists) lease.charges.push(mappedCharge);
            } else {
                const placeholderLease = {
                    id: mappedCharge.leaseId || `lease-${mappedCharge.id}`,
                    lease_id: mappedCharge.leaseId || null,
                    tenant: row.tenant_name
                        ? row.tenant_name
                        : row.tenant || "Unknown Tenant",
                    unit: row.unit || row.unit_number || row.property_name || "",
                    property_name: row.property_name || "",
                    email: row.email || "",
                    phone: row.phone_number || "",
                    paymentHistory: [],
                    charges: [mappedCharge],
                    grace_period_days:
                        parseInt(
                            row.lease_grace_period_days ||
                            row.grace_period_days ||
                            row.gracePeriodDays ||
                            0,
                            10
                        ) || 0,
                    late_fee_percentage:
                        typeof row.lease_late_fee_percentage === "number" &&
                            row.lease_late_fee_percentage >= 0
                            ? row.lease_late_fee_percentage
                            : typeof row.late_fee_percentage === "number" &&
                                row.late_fee_percentage >= 0
                                ? row.late_fee_percentage
                                : typeof row.lateFeePercentage === "number" &&
                                    row.lateFeePercentage >= 0
                                    ? row.lateFeePercentage
                                    : 0,
                };
                leasesData.push(placeholderLease);
            }
        });

        syncDataArrays();
        filteredCharges = [...charges];
    } catch (e) {
        console.warn("hydrateChargesFromServer failed", e);
    }
}

async function fetchCharges({ force = false } = {}) {
    try {
        const searchEl = document.getElementById("charges-search");
        const typeEl = document.getElementById("charges-type");
        const statusEl = document.getElementById("charges-status");
        const dateEl = document.getElementById("charges-date");

        const params = new URLSearchParams();
        if (searchEl && searchEl.value.trim())
            params.append("q", searchEl.value.trim());
        if (typeEl && typeEl.value) params.append("charge_type", typeEl.value);
        if (statusEl && statusEl.value) params.append("status", statusEl.value);
        if (dateEl && dateEl.value) {
            const v = dateEl.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                params.append("due_date", v);
            } else if (/^\d{4}-\d{2}$/.test(v)) {
                const [y, m] = v.split("-").map(Number);
                const from = `${y}-${String(m).padStart(2, "0")}-01`;
                const lastDay = new Date(y, m, 0).getDate();
                const to = `${y}-${String(m).padStart(2, "0")}-${String(
                    lastDay
                ).padStart(2, "0")}`;
                params.append("due_date_from", from);
                params.append("due_date_to", to);
            }
        }

        if (typeof window.chargesPage === "undefined") window.chargesPage = 1;
        if (typeof window.chargesLimit === "undefined") window.chargesLimit = 10;
        params.set("page", String(window.chargesPage));
        params.set("limit", String(window.chargesLimit));

        const base = `${API_BASE_URL}/charges`;
        const cacheKey = makeCacheKey(base, params);
        const cached = chargesListCache.get(cacheKey);
        if (!force && cached && isFresh(cached.fetchedAt, CACHE_TTLS.charges)) {
            const serverCharges = cached.payload || [];
            window.chargesTotal = cached.total;
            window.chargesPage = cached.page;
            window.chargesLimit = cached.limit;
            hydrateChargesFromServer(serverCharges);
            applyCurrentSort();
            renderChargesTable();
            if (typeof renderChargesPagination === "function")
                renderChargesPagination();
            renderPaymentsTable();
            return;
        }

        setChargesLoading(true, force ? "Refreshing…" : "Loading…");

        const url = base + (params.toString() ? `?${params.toString()}` : "");
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch charges from server");
        const payload = await res.json();

        let serverCharges = Array.isArray(payload)
            ? payload
            : payload && Array.isArray(payload.data)
                ? payload.data
                : [];

        window.chargesTotal = Array.isArray(payload)
            ? payload.length || 0
            : Number(payload?.total) || 0;
        if (!Number.isFinite(window.chargesTotal))
            window.chargesTotal = serverCharges.length;
        if (payload && !Array.isArray(payload)) {
            if (Number(payload.page)) window.chargesPage = Number(payload.page);
            if (Number(payload.limit)) window.chargesLimit = Number(payload.limit);
        }

        hydrateChargesFromServer(serverCharges);

        chargesListCache.set(cacheKey, {
            payload: serverCharges,
            total: window.chargesTotal,
            page: window.chargesPage,
            limit: window.chargesLimit,
            fetchedAt: Date.now(),
        });

        applyCurrentSort();
        renderChargesTable();
        if (typeof renderChargesPagination === "function") {
            renderChargesPagination();
        }
        renderPaymentsTable();
    } catch (error) {
        console.error("Error fetching charges from server:", error);
    }
}

onReady(() => {
    setupChargeFilters();

    setupChargesGroupingControl();
    fetchCharges().finally(() => requestStatisticsUpdate());

    try {
        const methodEl = document.getElementById("payments-method");
        const typeEl = document.getElementById("payments-type");
        if (window.AppConstants) {
            if (methodEl) {
                const methods = window.AppConstants.PAYMENT_METHODS || [];
                methodEl.innerHTML =
                    '<option value="">All Methods</option>' +
                    methods
                        .map((m) => `<option value="${m.value}">${m.label}</option>`)
                        .join("");
            }
            if (typeEl) {
                const types = window.AppConstants.CHARGE_TYPES || [];
                typeEl.innerHTML =
                    '<option value="">All Types</option>' +
                    types
                        .map((t) => `<option value="${t.value}">${t.label}</option>`)
                        .join("");
            }
        }

        const searchEl = document.getElementById("payments-search");
        const dateEl = document.getElementById("payments-date");
        if (searchEl)
            searchEl.addEventListener("input", () =>
                fetchAllPayments(1, paymentsLimit).finally(() =>
                    requestStatisticsUpdate()
                )
            );
        if (methodEl)
            methodEl.addEventListener("change", () =>
                fetchAllPayments(1, paymentsLimit).finally(() =>
                    requestStatisticsUpdate()
                )
            );
        if (typeEl)
            typeEl.addEventListener("change", () =>
                fetchAllPayments(1, paymentsLimit).finally(() =>
                    requestStatisticsUpdate()
                )
            );
        if (dateEl)
            dateEl.addEventListener("change", () =>
                fetchAllPayments(1, paymentsLimit).finally(() =>
                    requestStatisticsUpdate()
                )
            );
    } catch (e) {
        console.warn("Failed to initialize Payment History filters", e);
    }
});

function setupChargeFilters() {
    const typeEl = document.getElementById("charges-type");
    if (typeEl) {
        const currentVal = typeEl.value || "";
        typeEl.innerHTML =
            '<option value="">All Types</option>' +
            CHARGE_TYPES_LIST.map(
                (t) => `<option value="${t.value}">${t.label}</option>`
            ).join("");
        if (currentVal) typeEl.value = currentVal;
        typeEl.addEventListener("change", () => {
            window.chargesPage = 1;
            fetchCharges();
        });
    }

    const searchEl = document.getElementById("charges-search");
    if (searchEl) {
        let timeout = null;
        searchEl.addEventListener("input", () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                window.chargesPage = 1;
                fetchCharges();
            }, 300);
        });
    }

    const statusEl = document.getElementById("charges-status");
    if (statusEl) {
        const entries = [
            { value: "", label: "All Statuses" },
            {
                value: CHARGE_STATUSES_CONST.UNPAID,
                label:
                    CHARGE_STATUS_MAPPINGS_CONST[CHARGE_STATUSES_CONST.UNPAID]?.label ||
                    "Unpaid",
            },
            {
                value: CHARGE_STATUSES_CONST.PARTIALLY_PAID,
                label:
                    CHARGE_STATUS_MAPPINGS_CONST[CHARGE_STATUSES_CONST.PARTIALLY_PAID]
                        ?.label || "Partially Paid",
            },
            {
                value: CHARGE_STATUSES_CONST.PAID,
                label:
                    CHARGE_STATUS_MAPPINGS_CONST[CHARGE_STATUSES_CONST.PAID]?.label ||
                    "Paid",
            },
            {
                value: CHARGE_STATUSES_CONST.WAIVED,
                label:
                    CHARGE_STATUS_MAPPINGS_CONST[CHARGE_STATUSES_CONST.WAIVED]?.label ||
                    "Waived",
            },
        ];
        statusEl.innerHTML = entries
            .map((e) => `<option value="${e.value}">${e.label}</option>`)
            .join("");
        statusEl.addEventListener("change", () => {
            window.chargesPage = 1;
            fetchCharges();
        });
    }

    const dateEl = document.getElementById("charges-date");
    if (dateEl)
        dateEl.addEventListener("change", () => {
            window.chargesPage = 1;
            fetchCharges();
        });

    const groupEl = document.getElementById("charges-group-by");
    if (groupEl) {
        groupEl.value = chargesGrouping;
        groupEl.addEventListener("change", () => {
            chargesGrouping = groupEl.value;
            chargesGroupCollapsed = {};
            renderChargesTable();
        });
    }
}

function syncDataArrays() {
    charges = [];
    payments = [];

    leasesData.forEach((lease) => {
        lease.charges.forEach((charge) => {
            if (charge.status !== "paid") {
                charges.push({
                    ...charge,
                    tenant: lease.tenant,
                    email: lease.email,
                    unit: lease.unit,

                    gracePeriodDays:
                        parseInt(
                            lease.grace_period_days || lease.gracePeriodDays || 0,
                            10
                        ) || 0,
                });
            }
        });

        if (lease.paymentHistory) {
            lease.paymentHistory.forEach((payment) => {
                payments.push({
                    ...payment,
                    tenant: lease.tenant,
                    email: lease.email,
                    unit: lease.unit,
                });
            });
        }
    });

    filteredCharges = [...charges];
    filteredPayments = [...payments];
}

function formatCurrency(amount) {
    return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
}

function formatForDateInput(d) {
    if (!d) return "";
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, "0");
            const day = String(parsed.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        }
    } catch (e) {
        console.error("formatForDateInput parse error", e);
    }
    return "";
}

function getDaysUntilDue(dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function getChargeStatus(charge) {
    if (charge.status === "paid") return "paid";
    if (charge.status === "overdue") return "overdue";
    if (charge.status === "due-soon") return "due-soon";
    if (charge.status === "pending") return "pending";

    const daysUntilDue = getDaysUntilDue(charge.dueDate);
    const grace =
        parseInt(charge.gracePeriodDays || charge.grace_period_days || 0, 10) || 0;

    if (daysUntilDue < -grace) return "overdue";
    if (daysUntilDue <= 3) return "due-soon";
    return "pending";
}

function getChargeStatusByDate(dueDate) {
    const daysUntilDue = getDaysUntilDue(dueDate);

    if (daysUntilDue < 0) return "overdue";
    if (daysUntilDue <= 3) return "due-soon";
    return "pending";
}

function getPaidAmountForCharge(chargeId) {
    const ch =
        charges.find((c) => c.id === chargeId) ||
        filteredCharges.find((c) => c.id === chargeId);
    if (ch && typeof ch.total_paid !== "undefined") {
        return Number(ch.total_paid) || 0;
    }
    return payments
        .filter((payment) => payment.chargeId === chargeId)
        .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
}

function getStatusDisplay(charge) {
    const chargeStatus = getChargeStatus(charge);
    const daysUntilDue = getDaysUntilDue(charge.dueDate);

    let mapped = null;
    if (charge.canonical_status) {
        mapped = String(charge.canonical_status).toUpperCase();
    } else {
        if (chargeStatus === "paid") mapped = CHARGE_STATUSES_CONST.PAID;
        else if (chargeStatus === "partial")
            mapped = CHARGE_STATUSES_CONST.PARTIALLY_PAID;
        else mapped = CHARGE_STATUSES_CONST.UNPAID;
    }

    const cfg = CHARGE_STATUS_MAPPINGS_CONST[mapped];
    if (cfg) {
        const label = cfg.label || mapped;
        let extra = "";
        if (chargeStatus === "overdue")
            extra = ` &middot; ${Math.abs(daysUntilDue)}d overdue`;
        else if (chargeStatus === "due-soon")
            extra = ` &middot; Due in ${daysUntilDue}d`;
        const bg = cfg.color || "#e5e7eb";
        const color = cfg.textColor || "#111827";

        const iconHtml = (function () {
            switch (chargeStatus) {
                case "overdue":
                    return "";
                case "paid":
                    return '<i class="fas fa-circle" style="color:#10b981;margin-right:6px;"></i>';
                case "due-soon":
                    return '<i class="fas fa-circle" style="color:#f59e0b;margin-right:6px;"></i>';
                case "pending":
                default:
                    return '<i class="fas fa-circle" style="color:#64748b;margin-right:6px;"></i>';
            }
        })();
        return `<span class="status-indicator" style="background: ${bg}; color: ${color};">${iconHtml}${label}${extra}</span>`;
    }

    switch (chargeStatus) {
        case "overdue":
            return `<span class="status-indicator overdue">${Math.abs(
                daysUntilDue
            )} days overdue</span>`;
        case "due-soon":
            return `<span class="status-indicator due-soon"><i class="fas fa-circle" style="color:#f59e0b;margin-right:6px;"></i>Due in ${daysUntilDue} days</span>`;
        case "paid":
            return `<span class="status-indicator paid"><i class="fas fa-circle" style="color:#10b981;margin-right:6px;"></i>Paid</span>`;
        case "pending":
            return `<span class="status-indicator pending"><i class="fas fa-circle" style="color:#64748b;margin-right:6px;"></i>Due in ${daysUntilDue} days</span>`;
        default:
            return `<span class="status-indicator pending"><i class="fas fa-circle" style="color:#64748b;margin-right:6px;"></i>Pending</span>`;
    }
}

function sortTable(key) {
    if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
    } else {
        currentSort.key = key;
        currentSort.dir = "asc";
    }
    applyCurrentSort();
    renderChargesTable();
}

function applyCurrentSort() {
    if (!currentSort.key) return;
    const dir = currentSort.dir === "asc" ? 1 : -1;
    const key = currentSort.key;

    const getWeightForStatus = (c) => {
        const st = (c.canonical_status || "").toUpperCase();
        switch (st) {
            case CHARGE_STATUSES_CONST.WAIVED:
                return 3;
            case CHARGE_STATUSES_CONST.PAID:
                return 2;
            case CHARGE_STATUSES_CONST.PARTIALLY_PAID:
                return 1;
            case CHARGE_STATUSES_CONST.UNPAID:
                return 0;
            default:
                return -1;
        }
    };

    filteredCharges.sort((a, b) => {
        let av, bv;
        switch (key) {
            case "tenant":
                av = (a.tenant || "").toLowerCase();
                bv = (b.tenant || "").toLowerCase();
                break;
            case "unit":
                av = (a.unit || "").toLowerCase();
                bv = (b.unit || "").toLowerCase();
                break;
            case "type":
                av = (a.type || "").toLowerCase();
                bv = (b.type || "").toLowerCase();
                break;
            case "description":
                av = (a.description || "").toLowerCase();
                bv = (b.description || "").toLowerCase();
                break;
            case "amount":
                av = Number(a.amount) || 0;
                bv = Number(b.amount) || 0;
                break;
            case "paid":
                av = getPaidAmountForCharge(a.id);
                bv = getPaidAmountForCharge(b.id);
                break;
            case "status":
                av = getWeightForStatus(a);
                bv = getWeightForStatus(b);
                break;
            case "dueDate":
                av = new Date(a.dueDate || 0).getTime();
                bv = new Date(b.dueDate || 0).getTime();
                break;
            default:
                av = 0;
                bv = 0;
        }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
    });
}

function injectEnhancedButtonStyles() {
    if (document.getElementById("enhanced-modal-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "enhanced-modal-styles";
    styleSheet.textContent = `
        .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            align-items: center;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }

        .modal-actions button {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-family: system-ui, -apple-system, sans-serif;
        }

        .btn-primary {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
        }

        .btn-primary:hover {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            color: #475569;
            border: 1px solid #cbd5e1;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .btn-secondary:hover {
            background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
            color: #334155;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }

        .btn-success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
        }

        .btn-success:hover {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            transform: translateY(-1px);
        }

        .btn-danger {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
        }

        .btn-danger:hover {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            transform: translateY(-1px);
        }

        /* Button loading spinner */
        .btn-primary.loading,
        .btn-secondary.loading,
        .btn-success.loading,
        .btn-danger.loading {
            opacity: 0.9;
            cursor: wait;
        }
        .btn-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.6);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            display: inline-block;
        }
        .btn-primary.loading .btn-spinner,
        .btn-secondary.loading .btn-spinner,
        .btn-success.loading .btn-spinner,
        .btn-danger.loading .btn-spinner {
            margin-right: 8px;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;

    document.head.appendChild(styleSheet);
}

if (!document.getElementById("lease-tooltip-styles")) {
    const ltStyles = document.createElement("style");
    ltStyles.id = "lease-tooltip-styles";
    ltStyles.textContent = `
        .lease-tooltip { 
            background: #ffffff; 
            color: #0f172a; 
            border: 1px solid rgba(226,232,240,0.9);
            box-shadow: 0 18px 40px rgba(2,6,23,0.12);
            border-radius: 8px; 
            padding: 12px 16px; 
            font-size: 13px; 
            line-height: 1.25; 
            max-width: 360px; 
            max-height: 320px; 
            overflow: auto; 
            z-index: 1000000; 
        }
        .lease-tooltip .lt-row { display:flex; justify-content:space-between; gap:8px; padding:4px 0; }
        .lease-tooltip .lt-label { color:#6b7280; margin-right:12px; }
        .lease-tooltip .lt-value { text-align:right; font-weight:600; }
    .lease-tooltip:before { content: ''; position: absolute; width:12px; height:12px; background: #ffffff; transform: rotate(45deg); border-left:1px solid rgba(226,232,240,0.9); border-top:1px solid rgba(226,232,240,0.9); top:-6px; right:22px; box-shadow: -2px -2px 6px rgba(2,6,23,0.04); }
        .floating-lease-tooltip { position: fixed !important; }
    `;
    document.head.appendChild(ltStyles);
}

function generateReference(method) {
    const prefixes = {
        cash: "CSH",
        gcash: "GC",
    };

    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");

    return `${prefixes[method] || "PAY"}-${dateStr.slice(0, 4)}-${dateStr.slice(
        4,
        8
    )}-${random}`;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}



if (typeof showAlert === "undefined") {
    window.showAlert = function (message, type = "info") {
        try {
            if (window.ModalHelpers && typeof window.ModalHelpers.showAlert === "function") {
                return window.ModalHelpers.showAlert(message, type);
            }
        } catch (e) {}
        
        alert((type ? type.toUpperCase() + ': ' : '') + String(message));
    };
}

if (typeof showConfirm === "undefined") {
    window.showConfirm = function (message, title) {
        try {
            if (window.ModalHelpers && typeof window.ModalHelpers.showConfirm === "function") {
                return window.ModalHelpers.showConfirm(message, title);
            }
        } catch (e) {}
        return Promise.resolve(confirm(String(message)));
    };
}

if (typeof showPrompt === "undefined") {
    window.showPrompt = function (message, placeholder, title) {
        try {
            if (window.ModalHelpers && typeof window.ModalHelpers.showPrompt === "function") {
                return window.ModalHelpers.showPrompt(message, placeholder, title);
            }
        } catch (e) {}
        return Promise.resolve(prompt(String(message)));
    };
}

async function updateStatistics({ force = false } = {}) {
    try {
        let chargeStats = null;
        let paymentStats = null;
        if (
            !force &&
            isFresh(statsCache.fetchedAt, CACHE_TTLS.stats) &&
            statsCache.data
        ) {
            ({ chargeStats, paymentStats } = statsCache.data);
        } else {
            const [c, p] = await Promise.all([
                fetch(`/api/v1/charges/stats`, { credentials: "include" })
                    .then((r) => r.json())
                    .catch(() => null),
                fetch(`/api/v1/payments/stats`, { credentials: "include" })
                    .then((r) => r.json())
                    .catch(() => null),
            ]);
            chargeStats = c;
            paymentStats = p;
            statsCache = {
                data: { chargeStats, paymentStats },
                fetchedAt: Date.now(),
            };
        }

        const outstandingElement = document.getElementById("outstanding-charges");
        const collectedElement = document.getElementById("collected-amount");
        const pendingElement = document.getElementById("pending-charges");
        const revenueElement = document.getElementById("total-revenue");

        if (outstandingElement && chargeStats)
            outstandingElement.textContent = String(chargeStats.outstanding ?? 0);
        if (collectedElement && paymentStats)
            collectedElement.textContent = formatCurrency(
                Number(paymentStats.collectedThisMonth || 0)
            );
        if (pendingElement && paymentStats)
            pendingElement.textContent = String(paymentStats.pendingCount ?? 0);
        if (revenueElement && paymentStats)
            revenueElement.textContent = formatCurrency(
                Number(paymentStats.totalCollected || 0)
            );

        const chargesTotalStat = document.getElementById("charges-total-stat");
        const chargesOverdueStat = document.getElementById("charges-overdue-stat");
        const chargesActiveStat = document.getElementById("charges-active-stat");
        if (chargesTotalStat && chargeStats)
            chargesTotalStat.textContent = `${Number(chargeStats.total || 0)} Total`;
        if (chargesOverdueStat && chargeStats)
            chargesOverdueStat.textContent = `${Number(
                chargeStats.overdue || 0
            )} Overdue`;
        if (chargesActiveStat && chargeStats)
            chargesActiveStat.textContent = `${Number(
                chargeStats.dueSoon || 0
            )} Due Soon`;

        const paymentsCountStat = document.getElementById("payments-count-stat");
        const paymentsAmountStat = document.getElementById("payments-amount-stat");
        const paymentsMonthStat = document.getElementById("payments-month-stat");
        if (paymentsCountStat && paymentStats)
            paymentsCountStat.textContent = `${Number(
                paymentStats.totalPayments || 0
            )} Payments`;
        if (paymentsAmountStat && paymentStats)
            paymentsAmountStat.textContent = `${formatCurrency(
                Number(paymentStats.totalCollected || 0)
            )} Collected`;
        if (paymentsMonthStat && paymentStats)
            paymentsMonthStat.textContent = `This Month: ${formatCurrency(
                Number(paymentStats.collectedThisMonth || 0)
            )}`;
    } catch (e) {
        console.warn("Failed to fetch or render stats", e);
    }
}

function findChargeById(chargeId) {
    for (let lease of leasesData) {
        const charge = lease.charges.find((charge) => charge.id === chargeId);
        if (charge) return charge;
    }
    return null;
}

function findLeaseByChargeId(chargeId) {
    return leasesData.find((lease) =>
        lease.charges.some((charge) => charge.id === chargeId)
    );
}

function findPaymentById(paymentId) {
    for (let lease of leasesData) {
        if (lease.paymentHistory) {
            const payment = lease.paymentHistory.find(
                (payment) => payment.id === paymentId
            );
            if (payment) return payment;
        }
    }
    return null;
}

function findLeaseByPaymentId(paymentId) {
    return leasesData.find(
        (lease) =>
            lease.paymentHistory &&
            lease.paymentHistory.some((payment) => payment.id === paymentId)
    );
}

function addNewCharge() {
    fetchTenants()
        .then((tenants) => {
            createAdvancedAddChargesModal(tenants);
            openModal("advancedAddChargeModal");
        })
        .catch((err) => {
            console.error(
                "Failed to fetch tenants, opening modal with sample data",
                err
            );
            createAdvancedAddChargesModal();
            openModal("advancedAddChargeModal");
        });
}

async function fetchTenants() {
    const now = Date.now();
    if (tenantsCache.data && now - tenantsCache.fetchedAt < tenantsCache.ttl) {
        return tenantsCache.data;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/users?role=TENANT&limit=1000`);
        if (!res.ok) {
            console.warn("fetchTenants: non-ok response", res.status);
            return tenantsCache.data || [];
        }
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.users || json.data || [];
        const normalized = list.map((u) => ({
            user_id: u.user_id || u.id || u.userId || "",
            first_name: u.first_name || u.firstName || u.first || "",
            last_name: u.last_name || u.lastName || u.last || "",
            suffix: u.suffix || "",
            unit: u.unit || u.unit_number || u.unitNumber || "",
            email: u.email || "",
            phone: u.phone_number || u.phone || "",
        }));
        tenantsCache.data = normalized;
        tenantsCache.fetchedAt = Date.now();
        return normalized;
    } catch (error) {
        console.error("Error fetching tenants:", error);
        return tenantsCache.data || [];
    }
}

async function fetchLeasesForUser(userId) {
    if (!userId) return [];
    const now = Date.now();
    if (
        leasesCache[userId] &&
        now - leasesCache[userId].fetchedAt < 1000 * 60 * 5
    ) {
        return leasesCache[userId].data;
    }
    try {
        const res = await fetch(
            `${API_BASE_URL}/leases?user_id=${encodeURIComponent(userId)}&limit=1000`
        );
        if (!res.ok) return [];
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.leases || json.data || [];
        leasesCache[userId] = { data: list, fetchedAt: Date.now() };
        return list;
    } catch (err) {
        console.error("Error fetching leases for user", userId, err);
        return [];
    }
}

async function fetchLeaseById(leaseId) {
    if (!leaseId) return null;
    try {
        const key = String(leaseId);
        const cached = leasesCache[key];
        const now = Date.now();
        if (cached && now - cached.fetchedAt < 1000 * 60 * 5) {
            return cached.data;
        }

        const token = typeof getJwtToken === "function" ? getJwtToken() : null;
        const res = await fetch(
            `${API_BASE_URL}/leases/${encodeURIComponent(leaseId)}`,
            {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
        );
        if (!res.ok) {
            return null;
        }
        const json = await res.json();

        const raw = json && typeof json === "object" ? json.lease || json : null;
        if (!raw) {
            leasesCache[key] = { data: null, fetchedAt: Date.now() };
            return null;
        }

        const normalized = {
            start_date:
                raw.lease_start_date || raw.lease_start || raw.start_date || null,
            end_date: raw.lease_end_date || raw.lease_end || raw.end_date || null,
            monthly_rent:
                raw.monthly_rent != null
                    ? raw.monthly_rent
                    : raw.rent || raw.base_rent || null,
            lease_term_months:
                raw.lease_term_months != null
                    ? raw.lease_term_months
                    : raw.lease_term || raw.term_months || null,
            late_fee_percentage:
                raw.late_fee_percentage != null
                    ? raw.late_fee_percentage
                    : raw.late_fee || raw.late_fee_percent || null,
        };

        leasesCache[key] = { data: normalized, fetchedAt: Date.now() };
        return normalized;
    } catch (e) {
        return null;
    }
}

async function fetchPropertyName(propertyId) {
    if (!propertyId) return null;
    const cached = propertiesCache[propertyId];
    const now = Date.now();
    if (cached && now - cached.fetchedAt < 1000 * 60 * 10) return cached.name;
    try {
        const res = await fetch(
            `${API_BASE_URL}/properties/${encodeURIComponent(propertyId)}`
        );
        if (!res.ok) return null;
        const json = await res.json();

        const name =
            (json &&
                (json.property_name ||
                    (json.property && json.property.property_name))) ||
            null;
        propertiesCache[propertyId] = { name, fetchedAt: Date.now() };
        return name;
    } catch (e) {
        console.warn("Failed to fetch property name for", propertyId, e);
        return null;
    }
}

window.populateLeaseOptionsForCharge = async function (id, selectedLeaseId) {
    try {
        const tenantSelect = document.querySelector(
            `select[name="advancedTenant_${id}"]`
        );
        const leaseSelect = document.getElementById(`advancedLease_${id}`);
        if (!tenantSelect || !leaseSelect) return;

        const userId = tenantSelect.value;

        leaseSelect.disabled = true;
        leaseSelect.innerHTML = '<option value="">Loading leases...</option>';

        if (!userId) {
            leaseSelect.innerHTML = '<option value="">Select lease...</option>';
            leaseSelect.disabled = false;
            return;
        }

        const userKey = String(userId);
        let leases = await fetchLeasesForUser(userId);

        const enriched = await Promise.all(
            (leases || []).map(async (l) => {
                if (!l.property_name && l.property_id) {
                    const pName = await fetchPropertyName(l.property_id);
                    if (pName) l.property_name = pName;
                }
                return l;
            })
        );
        leases = enriched;

        const directMatches = (leases || []).filter((l) => {
            if (!l) return false;

            if (l.user_id && String(l.user_id) === userKey) return true;
            if (l.userId && String(l.userId) === userKey) return true;
            return false;
        });

        if (directMatches.length > 0) {
            leases = directMatches;
        } else {
            const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
            const tenantName = selectedOption ? selectedOption.text : "";
            const tenantUnit = selectedOption
                ? selectedOption.getAttribute("data-unit")
                : "";
            const fallbackMatches = (leases || []).filter((l) => {
                if (!l) return false;
                if (
                    tenantName &&
                    l.tenant &&
                    String(l.tenant).toLowerCase() === String(tenantName).toLowerCase()
                )
                    return true;
                if (
                    tenantUnit &&
                    (l.unit || l.unit_number) &&
                    String(l.unit || l.unit_number) === String(tenantUnit)
                )
                    return true;
                return false;
            });
            if (fallbackMatches.length > 0) {
                leases = fallbackMatches;
            } else {
                leases = [];
            }
        }
        leaseSelect.innerHTML = "";
        if (!leases || leases.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "No leases found for tenant";
            leaseSelect.appendChild(opt);
            leaseSelect.disabled = false;
            return;
        }

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Select lease...";
        leaseSelect.appendChild(placeholder);

        leases.forEach((lease) => {
            const opt = document.createElement("option");
            const leaseId = lease.lease_id || lease.id || "";
            const propertyName = lease.property_name || lease.property || "";
            const unit = lease.unit || lease.unit_number || "";

            const labelParts = [];
            if (unit) labelParts.push(unit);
            if (propertyName) labelParts.push(propertyName);
            opt.value = leaseId;
            opt.textContent = labelParts.length
                ? labelParts.join(" — ")
                : leaseId || "Lease";
            opt.dataset.propertyId = lease.property_id || "";

            try {
                opt.dataset.leaseJson = JSON.stringify({
                    lease_id: lease.lease_id || lease.id || "",
                    start_date:
                        lease.lease_start_date ||
                        lease.lease_start ||
                        lease.start_date ||
                        "",
                    end_date:
                        lease.lease_end_date || lease.lease_end || lease.end_date || "",
                    monthly_rent:
                        lease.monthly_rent || lease.rent || lease.base_rent || "",
                    lease_term_months: lease.lease_term_months || lease.term_months || "",
                    late_fee_percentage:
                        lease.late_fee_percentage ||
                        lease.late_fee ||
                        lease.late_fee_percent ||
                        "",
                    unit: unit || "",
                    property_name: propertyName || "",
                });
            } catch (e) {
                opt.dataset.leaseJson = "";
            }
            leaseSelect.appendChild(opt);
        });

        if (selectedLeaseId) {
            const want = String(selectedLeaseId);
            const match = Array.from(leaseSelect.options).find(
                (o) => String(o.value) === want
            );
            if (match) {
                leaseSelect.value = want;
            }
        }

        leaseSelect.disabled = false;
    } catch (err) {
        console.error("populateLeaseOptionsForCharge error", err);
    }
};

window.toggleLeaseTooltip = async function (chargeIndex) {
    try {
        const tooltip = document.getElementById(`leaseTooltip_${chargeIndex}`);
        const leaseSelect = document.getElementById(`advancedLease_${chargeIndex}`);
        const btn = document.getElementById(`viewLeaseBtn_${chargeIndex}`);
        if (!tooltip || !leaseSelect) return;

        if (tooltip.style.display === "none" || !tooltip.style.display) {
            const leaseId = leaseSelect.value;
            if (!leaseId) {
                tooltip.innerHTML = `<div class="lt-row"><div class="lt-label">No lease selected</div></div>`;
                tooltip.style.display = "block";
                return;
            }

            const opt = leaseSelect.options[leaseSelect.selectedIndex];
            let leaseData = null;
            if (opt && opt.dataset && opt.dataset.leaseJson) {
                try {
                    leaseData = JSON.parse(opt.dataset.leaseJson);
                } catch (e) {
                    leaseData = null;
                }
            }

            if (!leaseData) {
                try {
                    const parent = leaseSelect.closest(".advanced-charge-item");
                    const tenantSelect = parent
                        ? parent.querySelector('select[name^="advancedTenant_"]')
                        : null;
                    const userId = tenantSelect ? tenantSelect.value : null;
                    if (userId) {
                        const leases = await fetchLeasesForUser(userId);
                        const found = (leases || []).find(
                            (l) => String(l.lease_id || l.id) === String(leaseId)
                        );
                        if (found) {
                            leaseData = {
                                lease_id: found.lease_id || found.id || "",
                                start_date: found.start_date || found.lease_start || "",
                                end_date: found.end_date || found.lease_end || "",
                                monthly_rent:
                                    found.monthly_rent || found.rent || found.base_rent || "",
                                lease_term_months:
                                    found.lease_term_months || found.term_months || "",
                                late_fee_percentage:
                                    found.late_fee_percentage ||
                                    found.late_fee ||
                                    found.late_fee_percent ||
                                    "",
                                unit: found.unit || found.unit_number || "",
                                property_name: found.property_name || found.property || "",
                            };
                        }
                    }
                } catch (e) {
                    /* noop */
                }
            }

            renderLeaseTooltip(tooltip, leaseData);
            tooltip.style.display = "block";
        } else {
            tooltip.style.display = "none";
        }
    } catch (e) {
        console.error("toggleLeaseTooltip error", e);
    }
};

function renderLeaseTooltip(container, leaseData) {
    if (!container) return;
    if (!leaseData) {
        container.innerHTML = `<div class="lt-row"><div class="lt-label">Lease details not available</div></div>`;
        return;
    }

    const fmt = (v) => (v === null || v === undefined || v === "" ? "—" : v);
    const fmtDateSafe = (d) => {
        if (!d) return "—";
        try {
            const t = new Date(d);
            if (isNaN(t.getTime())) return escapeHtml(String(d));
            return formatDate(t.toISOString());
        } catch (e) {
            return escapeHtml(String(d));
        }
    };

    const rent = leaseData.monthly_rent
        ? typeof leaseData.monthly_rent === "number"
            ? formatCurrency(leaseData.monthly_rent)
            : escapeHtml(String(leaseData.monthly_rent))
        : "—";

    if (leaseData._loading) {
        container.innerHTML = `
            <div style="font-weight:700; margin-bottom:6px;">${escapeHtml(
            leaseData.property_name || leaseData.unit || ""
        )}</div>
            <div class="lt-row"><div class="lt-label">Loading lease details...</div></div>
        `;
        return;
    }

    var propName = leaseData.property_name || leaseData.property || "";
    var unitStr =
        leaseData.unit || leaseData.unit_number || leaseData.unit_number || "";
    var header = "";
    if (propName) {
        header = escapeHtml(propName);
        try {
            var pnLower = String(propName).toLowerCase();
            var unitLower = String(unitStr || "").toLowerCase();
            if (unitStr && unitLower && pnLower.indexOf(unitLower) === -1) {
                header += unitStr ? " — " + escapeHtml(unitStr) : "";
            }
        } catch (e) {
            header += unitStr ? " — " + escapeHtml(unitStr) : "";
        }
    } else if (unitStr) {
        header = escapeHtml(unitStr);
    }

    container.innerHTML = `
        <div style="font-weight:700; margin-bottom:6px;">${header}</div>
        <div class="lt-row"><div class="lt-label">Start</div><div class="lt-value">${fmtDateSafe(
        leaseData.start_date
    )}</div></div>
        <div class="lt-row"><div class="lt-label">End</div><div class="lt-value">${fmtDateSafe(
        leaseData.end_date
    )}</div></div>
        <div class="lt-row"><div class="lt-label">Monthly Rent</div><div class="lt-value">${rent}</div></div>
        <div class="lt-row"><div class="lt-label">Term (months)</div><div class="lt-value">${fmt(
        leaseData.lease_term_months
    )}</div></div>
        <div class="lt-row"><div class="lt-label">Late Fee %</div><div class="lt-value">${fmt(
        leaseData.late_fee_percentage
    )}</div></div>
    `;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

window.toggleModalLeaseTooltip = async function (tooltipId) {
    try {
        const container = document.getElementById(tooltipId);

        if (!container) return;

        const existingFloating = document.querySelector(
            `.floating-lease-tooltip[data-for="${tooltipId}"]`
        );
        if (existingFloating) {
            existingFloating.remove();
            return;
        }

        document
            .querySelectorAll(".floating-lease-tooltip")
            .forEach((el) => el.remove());

        let leaseData = null;
        try {
            const ds = container.dataset || {};
            if (
                ds &&
                (ds.propertyName ||
                    ds.unit ||
                    ds.monthlyRent ||
                    ds.leaseStart ||
                    ds.leaseEnd)
            ) {
                leaseData = {
                    property_name:
                        ds.propertyName || ds.property || ds.propertyname || "",
                    unit: ds.unit || ds.unitnumber || ds.unit_number || "",
                    monthly_rent:
                        ds.monthlyRent || ds.monthlyrent || ds.monthly_rent || "",
                    start_date: ds.leaseStart || ds.leasestart || ds.lease_start || "",
                    end_date: ds.leaseEnd || ds.leaseend || ds.lease_end || "",
                    lease_term_months:
                        ds.leaseTermMonths ||
                        ds.leasetermmonths ||
                        ds.lease_term_months ||
                        "",
                    late_fee_percentage:
                        ds.lateFeePercentage ||
                        ds.latefeepercentage ||
                        ds.late_fee_percentage ||
                        "",
                    lease_id: ds.leaseId || ds.lease_id || ds.leaseid || "",
                };
            }

            if (!leaseData && ds && (ds.leaseId || ds.lease_id || ds.leaseid)) {
                leaseData = {
                    lease_id: ds.leaseId || ds.lease_id || ds.leaseid || "",
                    email: ds.email || "",
                    phone: ds.phone || "",
                };
                leaseData._loading = true;
            }
        } catch (e) {
            /* noop */
        }

        try {
            if (
                leaseData &&
                (!leaseData.lease_term_months ||
                    !leaseData.late_fee_percentage ||
                    !leaseData.email ||
                    !leaseData.phone)
            ) {
                const lid = leaseData.lease_id || leaseData.leaseId || "";
                if (lid) {
                    leaseData._loading = true;
                }
            }
        } catch (e) {
            /* noop */
        }

        if (!leaseData) {
            if (tooltipId === "editLeaseTooltip") {
                const tenantInfo = document.getElementById("editChargeTenantInfo");
                const text = tenantInfo ? tenantInfo.textContent || "" : "";
                const parts = text.split(" - ").map((s) => s.trim());
                const tenant = parts[0] || "";
                const unit = parts[1] || "";
                leaseData = leasesData.find(
                    (l) =>
                        String(l.tenant).toLowerCase() === String(tenant).toLowerCase() &&
                        String(l.unit).toLowerCase() === String(unit).toLowerCase()
                );
            }

            if (!leaseData && tooltipId === "recurringLeaseTooltip") {
                const recurringTooltip = document.getElementById(
                    "recurringLeaseTooltip"
                );
                const recurringModal = recurringTooltip
                    ? recurringTooltip.closest(".modal-content")
                    : null;
                if (recurringModal) {
                    const tenantCtx = recurringModal.querySelector(
                        ".tenant-context strong"
                    );
                    if (tenantCtx) {
                        const parts = (tenantCtx.textContent || "")
                            .split(" - ")
                            .map((s) => s.trim());
                        const tenant = parts[0] || "";
                        const unit = parts[1] || "";
                        leaseData = leasesData.find(
                            (l) =>
                                String(l.tenant).toLowerCase() ===
                                String(tenant).toLowerCase() &&
                                String(l.unit).toLowerCase() === String(unit).toLowerCase()
                        );
                    }
                }
            }
        }

        const floatEl = document.createElement("div");
        floatEl.className = "lease-tooltip floating-lease-tooltip";
        floatEl.setAttribute("data-for", tooltipId);
        floatEl.style.position = "fixed";
        floatEl.style.display = "block";
        floatEl.style.opacity = "0";
        renderLeaseTooltip(floatEl, leaseData || null);

        try {
            floatEl.style.zIndex = "1000001";
            floatEl.style.background = floatEl.style.background || "#ffffff";
            floatEl.style.pointerEvents = "auto";
            floatEl.setAttribute("role", "dialog");
            floatEl.setAttribute("aria-hidden", "false");
            floatEl.tabIndex = -1;
        } catch (e) {
            /* noop */
        }
        document.body.appendChild(floatEl);
        try {
            floatEl.style.display = "block";
            floatEl.style.visibility = "visible";
            floatEl.style.transform = "translateZ(0)";
        } catch (e) { }

        let btn = null;
        try {
            btn = container.parentElement
                ? container.parentElement.querySelector(".view-lease-btn")
                : null;
            if (!btn) btn = document.querySelector(`button[onclick*="${tooltipId}"]`);

            if (!btn) {
                const map = {
                    editLeaseTooltip: "editViewLeaseBtn",
                    recurringLeaseTooltip: "recurringViewLeaseBtn",
                };
                const maybeId = map[tooltipId];
                if (maybeId) btn = document.getElementById(maybeId);
            }
        } catch (e) {
            btn = null;
        }

        try {
            const rect = btn
                ? btn.getBoundingClientRect()
                : container.getBoundingClientRect
                    ? container.getBoundingClientRect()
                    : { left: 0, right: 0, top: 0, bottom: 0 };

            const fw = Math.min(380, Math.max(220, floatEl.offsetWidth || 260));
            floatEl.style.maxWidth = fw + "px";

            let left = rect.right - fw;
            if (left < 8) left = rect.left;
            if (left + fw > window.innerWidth - 8)
                left = Math.max(8, window.innerWidth - fw - 8);

            let top = rect.bottom + 8;
            if (top + floatEl.offsetHeight > window.innerHeight - 8) {
                top = rect.top - floatEl.offsetHeight - 8;
            }
            floatEl.style.left = left + "px";
            floatEl.style.top = top + "px";
            floatEl.style.opacity = "1";

            setTimeout(() => {
                try {
                    floatEl.style.left = left + "px";
                    floatEl.style.top = top + "px";
                    floatEl.style.zIndex = "1000001";
                } catch (e) {
                    /* noop */
                }
            }, 20);

            try {
                const cs = window.getComputedStyle(floatEl);
            } catch (e) {
                /* noop */
            }
        } catch (e) {
            floatEl.style.left = "50%";
            floatEl.style.top = "50%";
            console.warn(
                "[toggleModalLeaseTooltip] positioning failed, falling back to center",
                e
            );
        }

        const outsideHandler = function (ev) {
            if (
                !ev.target.closest(".floating-lease-tooltip") &&
                !ev.target.closest(".view-lease-btn")
            ) {
                floatEl.remove();
                document.removeEventListener("click", outsideHandler);
                window.removeEventListener("resize", outsideHandler);
            }
        };
        document.addEventListener("click", outsideHandler);
        window.addEventListener("resize", outsideHandler);

        try {
            if (leaseData && leaseData._loading && leaseData.lease_id) {
                const fetched = await fetchLeaseById(leaseData.lease_id);
                if (fetched) {
                    leaseData._loading = false;
                    leaseData.tenant =
                        leaseData.tenant || fetched.tenant || fetched.name || "";
                    leaseData.email =
                        leaseData.email || fetched.email || fetched.contact_email || "";
                    leaseData.phone =
                        leaseData.phone || fetched.phone || fetched.phone_number || "";
                    leaseData.lease_term_months =
                        leaseData.lease_term_months ||
                        fetched.lease_term_months ||
                        fetched.term_months ||
                        "";
                    leaseData.late_fee_percentage =
                        leaseData.late_fee_percentage ||
                        fetched.late_fee_percentage ||
                        fetched.late_fee ||
                        fetched.late_fee_percent ||
                        "";
                    leaseData.property_name =
                        leaseData.property_name ||
                        fetched.property_name ||
                        fetched.property ||
                        "";
                    leaseData.unit =
                        leaseData.unit || fetched.unit || fetched.unit_number || "";
                    leaseData.monthly_rent =
                        leaseData.monthly_rent ||
                        fetched.monthly_rent ||
                        fetched.rent ||
                        fetched.base_rent ||
                        "";
                    leaseData.start_date =
                        leaseData.start_date ||
                        fetched.lease_start_date ||
                        fetched.start_date ||
                        "";
                    leaseData.end_date =
                        leaseData.end_date ||
                        fetched.lease_end_date ||
                        fetched.end_date ||
                        "";

                    renderLeaseTooltip(floatEl, leaseData);
                }
            }
        } catch (e) {
            /* noop */
        }
    } catch (e) {
        console.error("toggleModalLeaseTooltip error", e);
    }
};

function handleAddChargeSubmission(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const chargeData = {
        tenant: formData.get("tenant").trim(),
        unit: formData.get("unit").trim(),
        type: formData.get("type"),
        description: formData.get("description").trim(),
        amount: parseFloat(formData.get("amount")),
        dueDate: formData.get("dueDate"),
        notes: formData.get("notes").trim(),
        createdDate: new Date().toISOString().split("T")[0],
        status: "pending",
    };

    if (!chargeData.tenant || !chargeData.unit) {
        showAlert("Tenant name and unit are required", "error");
        return;
    }

    if (!chargeData.description) {
        showAlert("Description is required", "error");
        return;
    }

    if (chargeData.amount <= 0) {
        showAlert("Amount must be greater than zero", "error");
        return;
    }

    if (!chargeData.dueDate) {
        showAlert("Due date is required", "error");
        return;
    }

    let lease = leasesData.find(
        (l) =>
            l.tenant.toLowerCase() === chargeData.tenant.toLowerCase() &&
            l.unit.toLowerCase() === chargeData.unit.toLowerCase()
    );

    if (!lease) {
        lease = {
            id: `lease-${Date.now()}`,
            tenant: chargeData.tenant,
            unit: chargeData.unit,
            period: "New Lease",
            email: "contact@property.com",
            phone: "Not provided",
            paymentHistory: [],
            charges: [],
        };
        leasesData.push(lease);
    }

    const newCharge = {
        id: Date.now(),
        type: chargeData.type,
        description: chargeData.description,
        amount: chargeData.amount,
        dueDate: chargeData.dueDate,
        status: getChargeStatusByDate(chargeData.dueDate),
        createdDate: chargeData.createdDate,
        notes:
            chargeData.notes ||
            `Charge created on ${formatDate(chargeData.createdDate)}`,
    };

    lease.charges.push(newCharge);

    syncDataArrays();
    filteredCharges = [...charges];
    invalidateChargesCache();
    invalidateStatsCache();
    requestStatisticsUpdate({ force: true });
    renderChargesTable();
    closeModal("addChargeModal");

    showAlert(
        `New charge of ${formatCurrency(chargeData.amount)} added successfully!`,
        "success"
    );
}

function editCharge(id) {
    const charge = findChargeById(id);
    const lease = findLeaseByChargeId(id);

    if (!charge || !lease) {
        showAlert("Charge not found", "error");
        return;
    }

    currentEditingCharge = charge;

    const isRecurring =
        !!charge.isRecurring ||
        (typeof charge.description === "string" &&
            charge.description.toLowerCase().includes("recurring"));

    if (isRecurring) {
        showRecurringEditChoice(id, charge, lease);
    } else {
        openStandardEditModal(charge, lease);
    }
}

function showRecurringEditChoice(id, charge, lease) {
    const existingChoice = document.getElementById("recurringEditChoiceModal");
    if (existingChoice) existingChoice.remove();

    const choiceHTML = `
        <div id="recurringEditChoiceModal" class="modal" style="display: flex;">
            <div class="modal-content modal-choice">
                <div class="modal-header modal-header-blue">
                    <h3><i class="fas fa-rotate"></i> Edit Recurring Charge</h3>
                    <span class="close" onclick="closeModal('recurringEditChoiceModal')">&times;</span>
                </div>
                <div class="modal-body">
                    <p class="choice-description">This is a recurring charge. What would you like to edit?</p>
                    
                    <div class="choice-cards">
                        <div class="choice-card" onclick="window.editSingleChargeInstance(${id})">
                            <div class="choice-icon">
                                <i class="fas fa-file-invoice"></i>
                            </div>
                            <h4>Edit This Charge</h4>
                            <p>Modify only this specific charge instance without affecting future recurring charges.</p>
                        </div>
                        
                        <div class="choice-card" onclick="window.editRecurringTemplate(${id})">
                            <div class="choice-icon recurring">
                                <i class="fas fa-rotate"></i>
                            </div>
                            <h4>Edit Recurring Charge</h4>
                            <p>Update the recurring charge settings that will apply to all future charges.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", choiceHTML);
}

window.editSingleChargeInstance = function (id) {
    closeModal("recurringEditChoiceModal");
    const charge = findChargeById(id);
    const lease = findLeaseByChargeId(id);
    if (charge && lease) {
        openStandardEditModal(charge, lease);
    }
};

window.editRecurringTemplate = function (id) {
    closeModal("recurringEditChoiceModal");
    const charge = findChargeById(id);
    const lease = findLeaseByChargeId(id);
    if (charge && lease) {
        openRecurringEditModal(charge, lease);
    }
};

async function openStandardEditModal(charge, lease) {
    let serverCharge = null;
    try {
        const resp = await fetch(`${API_BASE_URL}/charges/${charge.id}`);
        if (resp.ok) {
            serverCharge = await resp.json();
        }
    } catch (e) {
        console.error("Failed to fetch latest charge for edit:", e);
    }

    const use = serverCharge || charge;

    const toInputDate = (d) => {
        if (!d) return "";

        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

        if (d.indexOf && d.indexOf("T") > -1) return d.split("T")[0];

        if (d.indexOf && d.indexOf(" ") > -1) return d.split(" ")[0];

        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }
        return "";
    };

    const mapped = {
        id: use.charge_id || use.id,
        type: use.charge_type || use.type,
        description: use.description,
        amount: parseFloat(use.amount || use.amount_paid || 0) || 0,
        dueDate: formatForDateInput(use.due_date || use.dueDate || ""),
        status: use.status,
        template_id: use.template_id || null,
    };

    document.getElementById("editChargeId").value = mapped.id;
    document.getElementById("editChargeType").value = mapped.type;
    document.getElementById("editChargeDescription").value =
        mapped.description || "";
    document.getElementById("editChargeAmount").value = mapped.amount;
    document.getElementById("editChargeDueDate").value = mapped.dueDate;

    document.getElementById(
        "editChargeTenantInfo"
    ).textContent = `${lease.tenant} - ${lease.unit}`;

    currentEditingCharge = mapped;

    createModalsAndDialogs();
    openModal("editChargeModal");

    setTimeout(() => {
        const tooltip = document.getElementById("editLeaseTooltip");
        if (tooltip) {
            try {
                tooltip.dataset.propertyName =
                    lease.property_name || lease.property || "";
                tooltip.dataset.leaseId = lease.lease_id || lease.id || "";
                tooltip.dataset.unit = lease.unit || lease.unit_number || "";
                tooltip.dataset.monthlyRent = lease.monthly_rent || lease.rent || "";
                tooltip.dataset.leaseStart =
                    lease.lease_start_date || lease.start_date || "";
                tooltip.dataset.leaseEnd = lease.lease_end_date || lease.end_date || "";
                tooltip.dataset.leaseTermMonths =
                    lease.lease_term_months || lease.term_months || "";
                tooltip.dataset.lateFeePercentage =
                    lease.late_fee_percentage ||
                    lease.late_fee ||
                    lease.late_fee_percent ||
                    "";
            } catch (e) {
                /* noop */
            }
        }
    }, 50);
}

async function openRecurringEditModal(charge, lease) {
    const existingModal = document.getElementById("editRecurringModal");
    if (existingModal) existingModal.remove();

    injectEnhancedButtonStyles();

    const embeddedNextDue = formatForDateInput(
        charge.dueDate || charge.next_due || ""
    );
    const modalHTML = `
        <div id="editRecurringModal" class="modal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header modal-header-blue">
                    <h3><i class="fas fa-rotate"></i> Edit Recurring Charge Template</h3>
                    <p class="modal-subtitle">Changes will apply to all future recurring charges</p>
                    <span class="close" onclick="closeModal('editRecurringModal')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="tenant-context" style="display:flex; gap:8px; align-items:center; position:relative;">
                        <strong>${lease.tenant} - ${lease.unit}</strong>
                        <button type="button" id="recurringViewLeaseBtn" class="view-lease-btn" onclick="toggleModalLeaseTooltip('recurringLeaseTooltip')" title="View Lease Details" style="margin-left:8px;">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <div class="lease-tooltip" id="recurringLeaseTooltip" style="display:none; position:absolute; z-index:9999; margin-top:36px;">
                            <!-- Lease preview for recurring modal -->
                        </div>
                    </div>
                    
                    <form id="editRecurringForm" onsubmit="handleEditRecurringSubmission(event)">
                        <input type="hidden" id="editRecurringTemplateId" value="${charge.template_id || ""
        }">
                        <input type="hidden" id="editRecurringChargeId" value="${charge.id
        }">
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editRecurringFrequency">Frequency <span class="required-indicator">*</span></label>
                                <select id="editRecurringFrequency" name="frequency" required>
                                    <option value="Monthly">Monthly</option>
                                    <option value="Quarterly">Quarterly</option>
                                    <option value="Semi-annually">Semi-Annually</option>
                                    <option value="Annually">Annually</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="editRecurringAmount">Amount <span class="required-indicator">*</span></label>
                                <input type="number" id="editRecurringAmount" name="amount" step="0.01" min="0" value="${charge.amount || 0
        }" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editRecurringNextDue">Next Due Date <span class="required-indicator">*</span></label>
                                <input type="date" id="editRecurringNextDue" name="next_due" value="${embeddedNextDue}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="editRecurringAutoGenUntil">Auto-Generate Until</label>
                                <input type="date" id="editRecurringAutoGenUntil" name="auto_gen_until">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="editRecurringActive" name="is_active" checked>
                                <span>Keep this recurring charge active</span>
                            </label>
                            <p class="help-text">Uncheck to pause future automatic charge generation</p>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeModal('editRecurringModal')">Cancel</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Update Recurring Charge
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    setTimeout(() => {
        const tooltip = document.getElementById("recurringLeaseTooltip");
        if (tooltip) {
            try {
                tooltip.dataset.propertyName =
                    lease.property_name || lease.property || "";
                tooltip.dataset.leaseId = lease.lease_id || lease.id || "";
                tooltip.dataset.unit = lease.unit || lease.unit_number || "";
                tooltip.dataset.monthlyRent = lease.monthly_rent || lease.rent || "";
                tooltip.dataset.leaseStart =
                    lease.lease_start_date || lease.start_date || "";
                tooltip.dataset.leaseEnd = lease.lease_end_date || lease.end_date || "";
                tooltip.dataset.leaseTermMonths =
                    lease.lease_term_months || lease.term_months || "";
                tooltip.dataset.lateFeePercentage =
                    lease.late_fee_percentage ||
                    lease.late_fee ||
                    lease.late_fee_percent ||
                    "";
            } catch (e) {
                /* noop */
            }
        }
    }, 50);

    const templateId = charge.template_id;
    if (templateId) {
        try {
            const token = getJwtToken();
            const resp = await fetch(
                `${API_BASE_URL}/charges/recurring-templates/${templateId}`,
                {
                    headers: {
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                }
            );
            if (resp.ok) {
                const tmpl = await resp.json();

                const freqEl = document.getElementById("editRecurringFrequency");
                const amtEl = document.getElementById("editRecurringAmount");
                const nextEl = document.getElementById("editRecurringNextDue");
                const autoEl = document.getElementById("editRecurringAutoGenUntil");
                const activeEl = document.getElementById("editRecurringActive");
                const tmplIdEl = document.getElementById("editRecurringTemplateId");

                tmplIdEl.value = tmpl.template_id || templateId;
                if (freqEl) freqEl.value = tmpl.frequency || "Monthly";
                if (amtEl) amtEl.value = tmpl.amount || 0;
                if (nextEl)
                    nextEl.value = formatForDateInput(
                        tmpl.next_due || tmpl.nextDue || tmpl.due_date || ""
                    );
                if (autoEl)
                    autoEl.value = formatForDateInput(
                        tmpl.auto_generate_until ||
                        tmpl.auto_gen_until ||
                        tmpl.autoGenerateUntil ||
                        ""
                    );
                if (activeEl)
                    activeEl.checked = tmpl.is_active == 1 || tmpl.is_active === true;
            }
        } catch (e) {
            console.error("Failed to fetch recurring charge:", e);
        }
    }
}

window.handleEditRecurringSubmission = async function (event) {
    event.preventDefault();

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn && submitBtn.setAttribute("disabled", "true");
    submitBtn && submitBtn.classList.add("loading");

    const formData = new FormData(form);
    const templateId = document.getElementById("editRecurringTemplateId").value;
    if (!templateId) {
        showAlert(
            "This recurring charge doesn't have a template to edit.",
            "error"
        );
        submitBtn && submitBtn.removeAttribute("disabled");
        submitBtn && submitBtn.classList.remove("loading");
        return;
    }

    const payload = {
        frequency: formData.get("frequency"),
        amount: parseFloat(formData.get("amount")),
        next_due: formData.get("next_due"),
        auto_generate_until: formData.get("auto_gen_until") || null,
        is_active: document.getElementById("editRecurringActive").checked ? 1 : 0,
    };

    try {
        const token = getJwtToken();
        const resp = await fetch(
            `${API_BASE_URL}/charges/recurring-templates/${templateId}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(payload),
            }
        );

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(
                err.message || `Failed to update recurring charge (${resp.status})`
            );
        }

        showAlert("Recurring charge updated successfully!", "success");
        closeModal("editRecurringModal");

        fetchCharges();
    } catch (e) {
        console.error(e);
        showAlert(e.message || "Failed to update recurring charge", "error");
    } finally {
        submitBtn && submitBtn.removeAttribute("disabled");
        submitBtn && submitBtn.classList.remove("loading");
    }
};

async function handleEditChargeSubmission(event) {
    event.preventDefault();

    if (!currentEditingCharge) {
        showAlert("No charge selected for editing", "error");
        return;
    }

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn && submitBtn.setAttribute("disabled", "true");
    submitBtn && submitBtn.classList.add("loading");

    const formData = new FormData(form);
    const updatedData = {
        type: formData.get("type"),
        description: (formData.get("description") || "").trim(),
        amount: parseFloat(formData.get("amount")),
        dueDate: formData.get("dueDate"),
    };

    if (!updatedData.description) {
        showAlert("Description is required", "error");
        submitBtn && submitBtn.removeAttribute("disabled");
        submitBtn && submitBtn.classList.remove("loading");
        return;
    }
    if (isNaN(updatedData.amount) || updatedData.amount <= 0) {
        showAlert("Amount must be greater than zero", "error");
        submitBtn && submitBtn.removeAttribute("disabled");
        submitBtn && submitBtn.classList.remove("loading");
        return;
    }
    if (!updatedData.dueDate) {
        showAlert("Due date is required", "error");
        submitBtn && submitBtn.removeAttribute("disabled");
        submitBtn && submitBtn.classList.remove("loading");
        return;
    }

    const payload = {
        charge_type: updatedData.type,
        description: updatedData.description,
        amount: updatedData.amount,
        due_date: updatedData.dueDate,
    };

    try {
        const token = getJwtToken();
        const resp = await fetch(
            `${API_BASE_URL}/charges/${currentEditingCharge.id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(payload),
            }
        );

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(
                err.message || `Failed to update charge (${resp.status})`
            );
        }

        showAlert("Charge updated successfully!", "success");
        closeModal("editChargeModal");

        invalidateChargesCache();
        invalidateStatsCache();
        await fetchCharges({ force: true });
        requestStatisticsUpdate({ force: true });
        renderChargesTable();
    } catch (e) {
        console.error(e);
        showAlert(e.message || "Failed to update charge", "error");
    } finally {
        submitBtn && submitBtn.removeAttribute("disabled");
        submitBtn && submitBtn.classList.remove("loading");
    }
}

function removeCharge(id) {
    const charge = findChargeById(id);
    const lease = findLeaseByChargeId(id);

    if (!charge || !lease) {
        showAlert("Charge not found", "error");
        return;
    }

    chargeToDelete = { charge, lease };

    document.getElementById("deleteChargeTenant").textContent = lease.tenant;
    document.getElementById("deleteChargeUnit").textContent = lease.unit;
    document.getElementById("deleteChargeDescription").textContent =
        charge.description;
    document.getElementById("deleteChargeAmount").textContent = formatCurrency(
        charge.amount
    );
    document.getElementById("deleteChargeDueDate").textContent = formatDate(
        charge.dueDate
    );

    createModalsAndDialogs();
    openModal("deleteChargeModal");
}

async function confirmDeleteCharge() {
    if (!chargeToDelete) {
        showAlert("No charge selected for deletion", "error");
        return;
    }

    const { charge } = chargeToDelete;
    try {
        // Call API to delete charge
        const res = await fetch(`${API_BASE_URL}/charges/${encodeURIComponent(
            String(charge.id)
        )}`, {
            method: "DELETE",
            credentials: "include",
        });
        if (!res.ok) {
            let msg = "Failed to delete charge";
            try {
                const j = await res.json();
                if (j && j.message) msg = j.message;
            } catch {}
            throw new Error(msg);
        }

        // Refresh cached data and UI after successful delete
        invalidateChargesCache();
        invalidateStatsCache();
        await fetchCharges({ force: true });
        requestStatisticsUpdate({ force: true });
        renderChargesTable();
        renderPaymentsTable();

        closeModal("deleteChargeModal");
        showAlert("Charge deleted successfully!", "success");
    } catch (e) {
        console.error("Delete charge failed:", e);
        showAlert(e.message || "Failed to delete charge", "error");
    } finally {
        chargeToDelete = null;
    }
}

function recordPayment(chargeId) {
    const charge = findChargeById(chargeId);
    const lease = findLeaseByChargeId(chargeId);

    if (!charge || !lease) {
        showAlert("Charge not found", "error");
        return;
    }

    currentPaymentCharge = charge;
    document.getElementById("paymentChargeId").value = chargeId;
    document.getElementById("paymentAmount").value = charge.amount;
    document.getElementById("paymentDate").value = new Date()
        .toISOString()
        .split("T")[0];

    createModalsAndDialogs();
    openModal("paymentModal");
}

function handlePaymentSubmission(event) {
    event.preventDefault();

    if (!currentPaymentCharge) {
        showAlert("No charge selected for payment", "error");
        return;
    }

    const formData = new FormData(event.target);
    const paymentData = {
        amount: parseFloat(formData.get("amount")),
        paymentMethod: formData.get("method"),
        reference: formData.get("reference").trim(),
        paymentDate: formData.get("date"),
        notes: "Payment recorded through admin interface",
    };

    if (paymentData.amount <= 0) {
        showAlert("Payment amount must be greater than zero", "error");
        return;
    }

    if (!paymentData.paymentMethod) {
        showAlert("Please select a payment method", "error");
        return;
    }

    if (!paymentData.reference) {
        paymentData.reference = generateReference(paymentData.paymentMethod);
    }

    const lease = findLeaseByChargeId(currentPaymentCharge.id);
    const charge = findChargeById(currentPaymentCharge.id);

    if (!lease || !charge) {
        showAlert("Charge or lease not found", "error");
        return;
    }

    const newPayment = {
        id: `pay-${Date.now()}`,
        chargeId: currentPaymentCharge.id,
        ...paymentData,
        description: currentPaymentCharge.description,
        type: currentPaymentCharge.type,
        processedBy: "Admin User",
    };

    if (!lease.paymentHistory) {
        lease.paymentHistory = [];
    }

    lease.paymentHistory.unshift(newPayment);
    charge.status = "paid";

    syncDataArrays();
    filteredCharges = [...charges];
    filteredPayments = [...payments];
    updateStatistics();
    renderChargesTable();
    renderPaymentsTable();
    closeModal("paymentModal");

    showAlert(
        `Payment of ${formatCurrency(paymentData.amount)} recorded successfully!`,
        "success"
    );
    currentPaymentCharge = null;
}

function viewChargeDetails(chargeId) {
    const charge = findChargeById(chargeId);
    const lease = findLeaseByChargeId(chargeId);

    if (!charge || !lease) {
        showAlert("Charge not found", "error");
        return;
    }

    currentViewingCharge = charge;

    document.getElementById("viewChargeTenant").textContent = lease.tenant;
    document.getElementById("viewChargeUnit").textContent = lease.unit;
    document.getElementById("viewChargeType").textContent = capitalizeFirst(
        charge.type
    );
    document.getElementById("viewChargeDescription").textContent =
        charge.description;

    const totalAmt = Number(charge.amount) || 0;
    const baseAmt =
        typeof charge.original_amount === "number" &&
            charge.original_amount !== null
            ? Number(charge.original_amount) || 0
            : totalAmt;
    const lateFeeAmt =
        typeof charge.late_fee_amount === "number"
            ? Number(charge.late_fee_amount) || 0
            : 0;
    const amountEl = document.getElementById("viewChargeAmount");
    if (amountEl) {
        amountEl.innerHTML = `${formatCurrency(totalAmt)}${lateFeeAmt > 0
                ? `<div style="font-size:12px; color:#64748b; margin-top:4px;">Base: ${formatCurrency(
                    baseAmt
                )} + Late fee: ${formatCurrency(lateFeeAmt)}</div>`
                : ""
            }`;
    }
    document.getElementById("viewChargeDueDate").textContent = formatDate(
        charge.dueDate
    );
    document.getElementById("viewChargeCreatedDate").textContent = formatDate(
        charge.createdDate
    );
    document.getElementById("viewChargeStatus").innerHTML =
        getStatusDisplay(charge);

    const relatedPayments =
        lease.paymentHistory?.filter((p) => p.chargeId === charge.id) || [];
    const paymentHistoryDiv = document.getElementById("viewChargePaymentHistory");

    if (relatedPayments.length > 0) {
        paymentHistoryDiv.innerHTML = relatedPayments
            .map(
                (payment) => `
            <div class="payment-history-item">
                <div class="payment-info">
                    <strong>${formatCurrency(payment.amount)}</strong>
                    <span class="payment-method">${capitalizeFirst(
                    payment.paymentMethod
                )}</span>
                </div>
                <div class="payment-details">
                    <div>Date: ${formatDate(payment.paymentDate)}</div>
                    <div>Reference: ${payment.reference}</div>
                </div>
            </div>
        `
            )
            .join("");
    } else {
        paymentHistoryDiv.innerHTML =
            '<p class="no-payments">No payments recorded for this charge</p>';
    }

    createModalsAndDialogs();
    openModal("viewChargeModal");
}

function filterCharges() {
    fetchCharges();
}

function filterPayments() {
    fetchAllPayments(1, paymentsLimit);
}

function resetChargesFilters() {
    const searchEl = document.getElementById("charges-search");
    const typeEl = document.getElementById("charges-type");
    const statusEl = document.getElementById("charges-status");
    const dateEl = document.getElementById("charges-date");
    const groupEl = document.getElementById("charges-group-by");

    if (searchEl) searchEl.value = "";
    if (typeEl) typeEl.value = "";
    if (statusEl) statusEl.value = "";
    if (dateEl) dateEl.value = "";
    if (groupEl) {
        groupEl.value = "status";
        chargesGrouping = "status";
    }

    window.chargesPage = 1;
    fetchCharges();
}

function resetPaymentsFilters() {
    const searchEl = document.getElementById("payments-search");
    const methodEl = document.getElementById("payments-method");
    const typeEl = document.getElementById("payments-type");
    const dateEl = document.getElementById("payments-date");

    if (searchEl) searchEl.value = "";
    if (methodEl) methodEl.value = "";
    if (typeEl) typeEl.value = "";
    if (dateEl) dateEl.value = "";

    fetchAllPayments(1, paymentsLimit);
}

function filterByType(type) {
    const typeEl = document.getElementById("charges-type");
    if (typeEl) {
        typeEl.value = type === "charges" ? "" : type;
        filterCharges();
    }
}

function filterByStatus(status) {
    const statusEl = document.getElementById("charges-status");
    if (statusEl) {
        statusEl.value = status;
        filterCharges();
    }
}

function setupChargesGroupingControl() {
    try {
        return;
    } catch (e) {
        console.warn("setupChargesGroupingControl error", e);
    }
}

function renderChargesTable() {
    const tbody = document.getElementById("charges-tbody");
    const mobileCards = document.getElementById("charges-mobile");
    if (!tbody) return;

    if (filteredCharges.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No charges found</h3>
                        <p>Try adjusting your filters or add a new charge</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const renderRow = (charge, index) => {
        const paidAmount =
            typeof charge.total_paid !== "undefined" && charge.total_paid !== null
                ? Number(charge.total_paid) || 0
                : getPaidAmountForCharge(charge.id);

        const totalAmount = Number(charge.amount) || 0;
        const baseAmount =
            typeof charge.original_amount === "number" &&
                charge.original_amount !== null
                ? Number(charge.original_amount) || 0
                : totalAmount;
        const lateFeeAmount =
            typeof charge.late_fee_amount === "number"
                ? Number(charge.late_fee_amount) || 0
                : 0;
        const remainingAmount = Math.max(
            totalAmount - (Number(paidAmount) || 0),
            0
        );
        const paymentProgress =
            totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
        const isPartiallyPaid = paidAmount > 0 && paidAmount < totalAmount;
        const isFullyPaid = paidAmount >= totalAmount;

        const isRecurring =
            !!charge.isRecurring ||
            (typeof charge.description === "string" &&
                charge.description.toLowerCase().includes("monthly"));

        let chargeStatus = getChargeStatus(charge);
        if (isFullyPaid) chargeStatus = "paid";
        else if (isPartiallyPaid) chargeStatus = "partial";

        const typeClass = (charge.type || "")
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-");
        const typeLabel = capitalizeFirst(charge.type || "");

        return `
            <tr class="charge-row ${chargeStatus}" style="position: relative;">
                <td class="td-number">${String(index + 1).padStart(2, "0")}</td>
                <td class="td-tenant">
                    <div class="tenant-info">
                        <strong>${charge.tenant}</strong>
                    </div>
                </td>
                <td class="td-unit">
                    <div class="unit-info">
                        <strong>${charge.unit}</strong>
                    </div>
                </td>
                <td class="td-type">
                    <span class="badge ${typeClass}" aria-label="${typeLabel}">${typeLabel}</span>
                </td>
                <td class="charge-description">
                    ${charge.description}
                    ${isRecurring
                ? '<span class="recurring-pill"><i class="fas fa-rotate"></i> Recurring</span>'
                : ""
            }
                </td>
                <td class="td-total" title="${formatCurrency(baseAmount)}${lateFeeAmount > 0
                ? ` + ${formatCurrency(lateFeeAmount)} late fee = ${formatCurrency(
                    totalAmount
                )}`
                : ""
            }">
                    ${formatCurrency(remainingAmount)}
                    ${lateFeeAmount > 0
                ? `<div class="late-fee-hint" style="font-size:0.7rem; color:#ef4444; margin-top:2px; text-align:right;">
                        <i class="fas fa-info-circle" aria-hidden="true"></i> Late fee applied
                    </div>`
                : ""
            }
                </td>
                <td class="td-paid">
                    <div style="display: flex; flex-direction: column; align-items: flex-end;">
                        <span style="font-weight: 700;">${formatCurrency(
                paidAmount
            )}</span>
                        ${paidAmount > 0
                ? `
                            <div class="payment-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${paymentProgress}%"></div>
                                </div>
                                <span class="progress-text">${Math.round(
                    paymentProgress
                )}%</span>
                            </div>
                        `
                : ""
            }
                    </div>
                </td>
                <td class="td-status">
                    ${getStatusDisplay(charge)}
                </td>
                <td class="due-date">${formatDate(charge.dueDate)}</td>
                <td class="td-actions">
                    <div style="position:relative; display:inline-block;">
                        <button class="kebab-btn btn btn-sm" onclick="toggleChargeKebab(event, ${charge.id
            })" title="Actions">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div id="kebab-menu-${charge.id
            }" class="kebab-dropdown" style="display:none; position:absolute; right:0; top:36px; min-width:160px; background:#fff; border:1px solid #e5e7eb; border-radius:6px; box-shadow:0 6px 18px rgba(2,6,23,0.08); z-index:9999; overflow:hidden;">
                            <button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px;" onclick="(function(e){e.stopPropagation(); viewChargeDetails(${charge.id
            }); toggleChargeKebab(e, ${charge.id
            });})(event)">View Details</button>
                            <button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px;" onclick="(function(e){e.stopPropagation(); editCharge(${charge.id
            }); toggleChargeKebab(e, ${charge.id
            });})(event)">Edit</button>
                            ${!isFullyPaid
                ? `
                                <button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px;" onclick="(function(e){e.stopPropagation(); recordPayment(${charge.id}); toggleChargeKebab(e, ${charge.id});})(event)">Record Payment</button>
                            `
                : ""
            }
                            <button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px; color:#ef4444;" onclick="(function(e){e.stopPropagation(); removeCharge(${charge.id
            }); toggleChargeKebab(e, ${charge.id
            });})(event)">Delete</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    };

    if (chargesGrouping === "none") {
        tbody.innerHTML = filteredCharges.map((c, i) => renderRow(c, i)).join("");
    } else {
        const groups = new Map();

        const statusGroupKey = (c) => {
            const mapped = (c.canonical_status || "").toString().toUpperCase();
            if (mapped === "PAID") return "Paid";
            if (mapped === "PARTIALLY-PAID" || mapped === "PARTIALLY_PAID")
                return "Partially Paid";
            if (mapped === "WAIVED") return "Waived";

            const st = getChargeStatus(c);
            if (st === "overdue") return "Overdue";
            if (st === "due-soon") return "Due Soon";
            if (st === "paid") return "Paid";
            return "Unpaid";
        };

        for (const c of filteredCharges) {
            const key =
                chargesGrouping === "tenant"
                    ? c.tenant || "Unknown"
                    : statusGroupKey(c);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(c);
        }

        const order = {
            Overdue: 1,
            Unpaid: 2,
            "Due Soon": 3,
            "Partially Paid": 4,
            Paid: 5,
            Waived: 6,
        };
        const sortedGroupKeys = Array.from(groups.keys()).sort(
            (a, b) => (order[a] || 999) - (order[b] || 999) || a.localeCompare(b)
        );

        const baseIndex =
            (Number(window.chargesPage || 1) - 1) * Number(window.chargesLimit || 10);
        let index = 0;
        let html = "";
        sortedGroupKeys.forEach((key) => {
            const items = groups.get(key) || [];
            const collapsed = !!chargesGroupCollapsed[key];
            const count = items.length;
            const chev = collapsed ? "fa-chevron-right" : "fa-chevron-down";

            const groupTotals = items.reduce(
                (acc, c) => {
                    const totalAmount = Number(c.amount) || 0;
                    const paidAmount =
                        typeof c.total_paid !== "undefined" && c.total_paid !== null
                            ? Number(c.total_paid) || 0
                            : getPaidAmountForCharge(c.id);
                    const remaining = Math.max(totalAmount - paidAmount, 0);
                    acc.total += totalAmount;
                    acc.paid += paidAmount;
                    acc.remaining += remaining;
                    return acc;
                },
                { total: 0, paid: 0, remaining: 0 }
            );
            const subtotalHtml = `
                <div class="group-subtotals">
                    <span><strong>Total:</strong> ${formatCurrency(
                groupTotals.total
            )}</span>
                    <span><strong>Paid:</strong> ${formatCurrency(
                groupTotals.paid
            )}</span>
                    <span><strong>Remaining:</strong> ${formatCurrency(
                groupTotals.remaining
            )}</span>
                </div>`;

            html += `
                <tr class="group-row ${collapsed ? "collapsed" : ""}">
                    <td colspan="10">
                        <button class="group-toggle" data-group="${escapeHtml(
                key
            )}" aria-expanded="${!collapsed}">
                            <i class="fas ${chev}"></i>
                            <span class="group-title">${escapeHtml(key)}</span>
                            <span class="group-meta">${count} charge${count > 1 ? "s" : ""
                }</span>
                        </button>
                        ${subtotalHtml}
                    </td>
                </tr>
            `;
            if (!collapsed) {
                items.forEach((c) => {
                    html += renderRow(c, baseIndex + index);
                    index++;
                });
            }
        });
        tbody.innerHTML = html;

        tbody.querySelectorAll(".group-toggle").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const g = btn.getAttribute("data-group");
                chargesGroupCollapsed[g] = !chargesGroupCollapsed[g];
                renderChargesTable();
            });
        });
    }

    if (mobileCards) {
        if (filteredCharges.length === 0) {
            mobileCards.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-inbox" style="font-size: 2rem; color: #94a3b8; margin-bottom: 12px;"></i>
                    <h3 style="color: #64748b; margin-bottom: 8px;">No charges found</h3>
                    <p style="color: #94a3b8;">Try adjusting your filters or add a new charge</p>
                </div>
            `;
            return;
        }

        const renderMobileCard = (charge, displayIndex) => {
            const paidAmount =
                typeof charge.total_paid !== "undefined" && charge.total_paid !== null
                    ? Number(charge.total_paid) || 0
                    : getPaidAmountForCharge(charge.id);
            const totalAmount = Number(charge.amount) || 0;
            const baseAmount =
                typeof charge.original_amount === "number" &&
                    charge.original_amount !== null
                    ? Number(charge.original_amount) || 0
                    : totalAmount;
            const lateFeeAmount =
                typeof charge.late_fee_amount === "number"
                    ? Number(charge.late_fee_amount) || 0
                    : 0;
            const remainingAmount = Math.max(
                totalAmount - (Number(paidAmount) || 0),
                0
            );
            const paymentProgress =
                totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
            const isPartiallyPaid = paidAmount > 0 && paidAmount < totalAmount;
            const isFullyPaid = paidAmount >= totalAmount;
            const isRecurring =
                !!charge.isRecurring ||
                (typeof charge.description === "string" &&
                    charge.description.toLowerCase().includes("monthly"));
            let chargeStatus = getChargeStatus(charge);
            if (isFullyPaid) chargeStatus = "paid";
            else if (isPartiallyPaid) chargeStatus = "partial";
            return `
                <div class="mobile-card charges">
                    ${isRecurring
                    ? '<div class="recurring-indicator"><div class="recurring-tooltip">Recurring Payment</div></div>'
                    : ""
                }
                    <div class="card-header">
                        <div class="card-title">${charge.tenant} - ${charge.unit
                }
                            ${isRecurring
                    ? '<span class="recurring-pill"><i class="fas fa-rotate"></i> Recurring</span>'
                    : ""
                }
                        </div>
                        <div class="card-number">${String(
                    displayIndex + 1
                ).padStart(2, "0")}</div>
                    </div>
                    <div class="card-amount charge" title="${formatCurrency(
                    baseAmount
                )}${lateFeeAmount > 0
                    ? ` + ${formatCurrency(lateFeeAmount)} late fee = ${formatCurrency(
                        totalAmount
                    )}`
                    : ""
                }">
                        ${formatCurrency(remainingAmount)}
                        ${lateFeeAmount > 0
                    ? `<div class="late-fee-hint" style="font-size:11px; color:#ef4444; margin-top:4px;"><i class=\"fas fa-info-circle\"></i> Late fee applied</div>`
                    : ""
                }
                    </div>
                    <div class="card-details">
                        <div class="card-detail-row"><span class="card-detail-label">Type</span>
                            <span class="card-detail-value"><span class="type-text ${(
                    charge.type || ""
                )
                    .toString()
                    .toLowerCase()
                    .replace(/\s+/g, "-")}">${capitalizeFirst(
                        charge.type || ""
                    )}</span></span>
                        </div>
                        <div class="card-detail-row"><span class="card-detail-label">Description</span><span class="card-detail-value">${charge.description
                }</span></div>
                        <div class="card-detail-row"><span class="card-detail-label">Paid Amount</span>
                            <span class="card-detail-value">${formatCurrency(
                    paidAmount
                )}
                                ${paidAmount > 0
                    ? `<div class=\"payment-progress\"><div class=\"progress-bar\"><div class=\"progress-fill\" style=\"width: ${paymentProgress}%\"></div></div><span class=\"progress-text\">${Math.round(
                        paymentProgress
                    )}%</span></div>`
                    : ""
                }
                            </span>
                        </div>
                        <div class="card-detail-row"><span class="card-detail-label">Status</span><span class="card-detail-value">${getStatusDisplay(
                    charge
                )}</span></div>
                        <div class="card-detail-row"><span class="card-detail-label">Due Date</span><span class="card-detail-value">${formatDate(
                    charge.dueDate
                )}</span></div>
                    </div>
                    <div class="card-actions" style="position:relative;">
                        <button class="kebab-btn btn btn-sm" onclick="toggleChargeKebab(event, 'mobile-${charge.id
                }')" title="Actions"><i class="fas fa-ellipsis-v"></i></button>
                        <div id="kebab-menu-mobile-${charge.id
                }" class="kebab-dropdown" style="display:none; position:absolute; right:0; top:36px; min-width:160px; background:#fff; border:1px solid #e5e7eb; border-radius:6px; box-shadow:0 6px 18px rgba(2,6,23,0.08); z-index:9999; overflow:hidden;">
                            <button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px;" onclick="(function(e){e.stopPropagation(); viewChargeDetails(${charge.id
                }); toggleChargeKebab(e, 'mobile-${charge.id
                }');})(event)"><i class="fas fa-eye"></i> View Details</button>
                            <button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px;" onclick="(function(e){e.stopPropagation(); editCharge(${charge.id
                }); toggleChargeKebab(e, 'mobile-${charge.id
                }');})(event)"><i class="fas fa-edit"></i> Edit</button>
                            ${!isFullyPaid
                    ? `<button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px;" onclick="(function(e){e.stopPropagation(); recordPayment(${charge.id}); toggleChargeKebab(e, 'mobile-${charge.id}');})(event)"><i class=\"fas fa-credit-card\"></i> Record Payment</button>`
                    : ""
                }
                            <button class="kebab-item btn btn-block" style="width:100%; text-align:left; border:none; background:transparent; padding:10px 12px; color:#ef4444;" onclick="(function(e){e.stopPropagation(); removeCharge(${charge.id
                }); toggleChargeKebab(e, 'mobile-${charge.id
                }');})(event)"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                </div>`;
        };

        const baseIndex =
            (Number(window.chargesPage || 1) - 1) * Number(window.chargesLimit || 10);

        if (chargesGrouping === "none") {
            mobileCards.innerHTML = filteredCharges
                .map((c, i) => renderMobileCard(c, baseIndex + i))
                .join("");
        } else {
            const groups = new Map();
            const statusGroupKey = (c) => {
                const mapped = (c.canonical_status || "").toString().toUpperCase();
                if (mapped === "PAID") return "Paid";
                if (mapped === "PARTIALLY-PAID" || mapped === "PARTIALLY_PAID")
                    return "Partially Paid";
                if (mapped === "WAIVED") return "Waived";
                const st = getChargeStatus(c);
                if (st === "overdue") return "Overdue";
                if (st === "due-soon") return "Due Soon";
                if (st === "paid") return "Paid";
                return "Unpaid";
            };
            for (const c of filteredCharges) {
                const key =
                    chargesGrouping === "tenant"
                        ? c.tenant || "Unknown"
                        : statusGroupKey(c);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(c);
            }
            const order = {
                Overdue: 1,
                Unpaid: 2,
                "Due Soon": 3,
                "Partially Paid": 4,
                Paid: 5,
                Waived: 6,
            };
            const sortedGroupKeys = Array.from(groups.keys()).sort(
                (a, b) => (order[a] || 999) - (order[b] || 999) || a.localeCompare(b)
            );

            let idx = 0;
            let html = "";
            sortedGroupKeys.forEach((key) => {
                const items = groups.get(key) || [];
                const collapsed = !!chargesGroupCollapsed[key];
                const count = items.length;
                const chev = collapsed ? "fa-chevron-right" : "fa-chevron-down";
                const totals = items.reduce(
                    (acc, c) => {
                        const totalAmount = Number(c.amount) || 0;
                        const paidAmount =
                            typeof c.total_paid !== "undefined" && c.total_paid !== null
                                ? Number(c.total_paid) || 0
                                : getPaidAmountForCharge(c.id);
                        acc.total += totalAmount;
                        acc.paid += paidAmount;
                        acc.remaining += Math.max(totalAmount - paidAmount, 0);
                        return acc;
                    },
                    { total: 0, paid: 0, remaining: 0 }
                );
                html += `
                    <div class="mobile-group">
                        <button class="mobile-group-toggle" data-group="${escapeHtml(
                    key
                )}" aria-expanded="${!collapsed}">
                            <i class="fas ${chev}"></i>
                            <span class="group-title">${escapeHtml(key)}</span>
                            <span class="group-meta">${count} charge${count > 1 ? "s" : ""
                    }</span>
                            <span class="group-subtotals"><strong>Total:</strong> ${formatCurrency(
                        totals.total
                    )} · <strong>Paid:</strong> ${formatCurrency(
                        totals.paid
                    )} · <strong>Remaining:</strong> ${formatCurrency(
                        totals.remaining
                    )}</span>
                        </button>
                        ${collapsed
                        ? ""
                        : `<div class="mobile-group-body">${items
                            .map((c) =>
                                renderMobileCard(c, baseIndex + idx++)
                            )
                            .join("")}</div>`
                    }
                    </div>
                `;
                if (collapsed) {
                    idx += items.length;
                }
            });
            mobileCards.innerHTML = html;

            mobileCards.querySelectorAll(".mobile-group-toggle").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const g = btn.getAttribute("data-group");
                    chargesGroupCollapsed[g] = !chargesGroupCollapsed[g];
                    renderChargesTable();
                });
            });
        }
    }
}

function renderChargesPagination() {
    const container = document.getElementById("charges-pagination");
    if (!container) return;
    const total = Number(window.chargesTotal || 0);
    const limit = Number(window.chargesLimit || 10);
    const page = Number(window.chargesPage || 1);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const makeBtn = (label, disabled, onClick, isActive = false) => {
        const btn = document.createElement("button");
        btn.className = "page-btn" + (isActive ? " active" : "");
        btn.textContent = label;
        btn.disabled = !!disabled;
        if (onClick) btn.addEventListener("click", onClick);
        return btn;
    };

    container.innerHTML = "";
    container.classList.add("pagination-bar");

    container.appendChild(
        makeBtn("Prev", page <= 1, () => {
            window.chargesPage = page - 1;
            fetchCharges();
        })
    );

    const numbersWrap = document.createElement("div");
    numbersWrap.className = "page-numbers";

    const pushNumber = (p) =>
        numbersWrap.appendChild(
            makeBtn(
                String(p),
                false,
                () => {
                    window.chargesPage = p;
                    fetchCharges();
                },
                p === page
            )
        );

    if (totalPages <= 7) {
        for (let p = 1; p <= totalPages; p++) pushNumber(p);
    } else {
        pushNumber(1);
        if (page > 3)
            numbersWrap.appendChild(
                Object.assign(document.createElement("span"), {
                    className: "ellipsis",
                    textContent: "…",
                })
            );
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);
        for (let p = start; p <= end; p++) pushNumber(p);
        if (page < totalPages - 2)
            numbersWrap.appendChild(
                Object.assign(document.createElement("span"), {
                    className: "ellipsis",
                    textContent: "…",
                })
            );
        pushNumber(totalPages);
    }
    container.appendChild(numbersWrap);

    container.appendChild(
        makeBtn("Next", page >= totalPages, () => {
            window.chargesPage = page + 1;
            fetchCharges();
        })
    );
}

function generateReceipt(paymentId) {
    const payment = findPaymentById(paymentId);
    const lease = findLeaseByPaymentId(paymentId);

    if (!payment || !lease) {
        showAlert("Payment not found", "error");
        return;
    }

    const receiptWindow = window.open("", "_blank", "width=800,height=600");
    const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Receipt - ${payment.reference}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    background: #f8f9fa;
                }
                .receipt {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .receipt-header {
                    text-align: center;
                    border-bottom: 2px solid #3b82f6;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .receipt-title {
                    color: #3b82f6;
                    font-size: 28px;
                    font-weight: bold;
                    margin: 0;
                }
                .receipt-subtitle {
                    color: #6b7280;
                    font-size: 14px;
                    margin: 5px 0 0 0;
                }
                .receipt-details {
                    display: grid;
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 0;
                    border-bottom: 1px solid #e5e7eb;
                }
                .detail-label {
                    font-weight: 600;
                    color: #374151;
                }
                .detail-value {
                    color: #1f2937;
                }
                .amount-highlight {
                    font-size: 24px;
                    font-weight: bold;
                    color: #10b981;
                }
                .receipt-footer {
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 12px;
                }
                .print-button {
                    background: #3b82f6;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 20px;
                }
                @media print {
                    body { background: white; padding: 0; }
                    .receipt { box-shadow: none; }
                    .print-button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="receipt-header">
                    <h1 class="receipt-title">PAYMENT RECEIPT</h1>
                    <p class="receipt-subtitle">Official Receipt for Payment</p>
                </div>
                
                <div class="receipt-details">
                    <div class="detail-row">
                        <span class="detail-label">Receipt #:</span>
                        <span class="detail-value">${payment.reference}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Payment Date:</span>
                        <span class="detail-value">${formatDate(
        payment.paymentDate
    )}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Tenant:</span>
                        <span class="detail-value">${lease.tenant}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Unit:</span>
                        <span class="detail-value">${lease.unit}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Description:</span>
                        <span class="detail-value">${payment.description}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Payment Method:</span>
                        <span class="detail-value">${capitalizeFirst(
        payment.paymentMethod
    )}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Amount:</span>
                        <span class="detail-value amount-highlight">${formatCurrency(
        payment.amount
    )}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Processed By:</span>
                        <span class="detail-value">${payment.processedBy || "System"
        }</span>
                    </div>
                </div>
                
                <div class="receipt-footer">
                    <p>This is an official receipt generated on ${new Date().toLocaleDateString()}</p>
                    <button class="print-button" onclick="window.print()">Print Receipt</button>
                </div>
            </div>
        </body>
        </html>
    `;

    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
}

window.toggleChargeKebab = function (evt, id) {
    try {
        if (evt && evt.stopPropagation) evt.stopPropagation();

        const idStr = String(id);
        const portalId = `kebab-portal-${idStr.replace(/\s+/g, "-")}`;

        const existingPortal = document.getElementById(portalId);
        if (existingPortal) {
            existingPortal.remove();
            return;
        }

        window.closeOpenKebabMenus();

        const candidateIds = [
            `kebab-menu-${idStr}`,
            `kebab-menu-mobile-${idStr}`,
            `kebab-menu-${idStr.replace(/^mobile-/, "")}`,
        ];
        let templateEl = null;
        for (const tid of candidateIds) {
            const t = document.getElementById(tid);
            if (t) {
                templateEl = t;
                break;
            }
        }

        const menuHtml = templateEl
            ? templateEl.innerHTML
            : "<div style='padding:8px 12px;color:#374151;'>No actions</div>";

        const portal = document.createElement("div");
        portal.id = portalId;
        portal.className = "kebab-dropdown kebab-portal";

        Object.assign(portal.style, {
            position: "fixed",
            zIndex: "2147483647",
            minWidth: "160px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            boxShadow: "0 6px 18px rgba(2,6,23,0.08)",
            overflow: "hidden",
            padding: "4px 0",
        });
        portal.innerHTML = menuHtml;

        portal.addEventListener("click", (e) => e.stopPropagation());

        document.body.appendChild(portal);

        let btnRect = null;
        try {
            const btn =
                evt && evt.target && evt.target.closest
                    ? evt.target.closest(".kebab-btn")
                    : null;
            if (btn && typeof btn.getBoundingClientRect === "function")
                btnRect = btn.getBoundingClientRect();
        } catch (_) { }

        requestAnimationFrame(() => {
            const measured = portal.getBoundingClientRect();
            let top = window.innerHeight / 2 - measured.height / 2;
            let left = Math.max(8, (window.innerWidth - measured.width) / 2);

            if (btnRect) {
                top = btnRect.bottom + 6;
                left = Math.min(
                    Math.max(btnRect.right - measured.width, 8),
                    window.innerWidth - measured.width - 8
                );

                if (top + measured.height > window.innerHeight - 8) {
                    top = Math.max(btnRect.top - measured.height - 6, 8);
                }
            }

            portal.style.left = `${Math.round(left)}px`;
            portal.style.top = `${Math.round(top)}px`;
        });
    } catch (err) {
        console.error("toggleChargeKebab error", err);
    }
};

window.closeOpenKebabMenus = function () {
    document.querySelectorAll(".kebab-portal").forEach((d) => d.remove());

    document.querySelectorAll(".kebab-dropdown").forEach((d) => {
        if (!d.classList.contains("kebab-portal")) d.style.display = "none";
    });
};

document.addEventListener("click", function (e) {
    if (
        e.target.closest &&
        (e.target.closest(".kebab-portal") || e.target.closest(".kebab-btn"))
    )
        return;
    window.closeOpenKebabMenus();
});

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";

        const firstInput = modal.querySelector("input, textarea, select");
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }

    if (modalId === "paymentModal") {
        currentPaymentCharge = null;
    }
    if (modalId === "viewChargeModal") {
        currentViewingCharge = null;
    }
    if (modalId === "editChargeModal") {
        currentEditingCharge = null;
    }
    if (modalId === "deleteChargeModal") {
        chargeToDelete = null;
    }
}

function showSection(sectionName) {
    updateStatistics();
    if (sectionName === "charges") {
        fetchCharges();
    } else if (sectionName === "payments") {
        if ((window.currentPaymentView || "pending") === "all") {
            fetchAllPayments(1, paymentsLimit);
        } else {
            loadPendingPayments(window.currentPendingStatus || "Pending");
        }
    }
}

function createModalsAndDialogs() {
    if (document.getElementById("paymentModal")) return;

    injectEnhancedButtonStyles();

    const modalsHTML = `
        <!-- Payment Modal -->
        <div id="paymentModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Record Payment</h3>
                    <span class="close" onclick="closeModal('paymentModal')">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="paymentForm" onsubmit="handlePaymentSubmission(event)">
                        <input type="hidden" id="paymentChargeId" name="chargeId">
                        
                        <div class="form-group">
                            <label for="paymentAmount">Amount</label>
                            <input type="number" id="paymentAmount" name="amount" step="0.01" min="0" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="paymentMethod">Payment Method</label>
                            <select id="paymentMethod" name="method" required>
                                <option value="">Select method...</option>
                                <option value="cash">Cash</option>
                                <option value="gcash">GCash</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="paymentReference">Reference Number</label>
                            <input type="text" id="paymentReference" name="reference" placeholder="Leave blank for auto-generation">
                        </div>
                        
                        <div class="form-group">
                            <label for="paymentDate">Payment Date</label>
                            <input type="date" id="paymentDate" name="date" required>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeModal('paymentModal')">Cancel</button>
                            <button type="submit" class="btn-primary">Record Payment</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Add Charge Modal -->
        <div id="addChargeModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add New Charge</h3>
                    <span class="close" onclick="closeModal('addChargeModal')">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="addChargeForm" onsubmit="handleAddChargeSubmission(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="addChargeTenant">Tenant Name</label>
                                <input type="text" id="addChargeTenant" name="tenant" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="addChargeUnit">Unit</label>
                                <input type="text" id="addChargeUnit" name="unit" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="addChargeType">Type</label>
                                <select id="addChargeType" name="type" required>
                                    <option value="">Select type...</option>
                                    <option value="rent">Rent</option>
                                    <option value="utility">Utility</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="penalty">Penalty</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="addChargeAmount">Amount</label>
                                <input type="number" id="addChargeAmount" name="amount" step="0.01" min="0" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="addChargeDescription">Description</label>
                            <input type="text" id="addChargeDescription" name="description" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="addChargeDueDate">Due Date</label>
                            <input type="date" id="addChargeDueDate" name="dueDate" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="addChargeNotes">Notes</label>
                            <textarea id="addChargeNotes" name="notes" rows="3" placeholder="Optional notes..."></textarea>
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeModal('addChargeModal')">Cancel</button>
                            <button type="submit" class="btn-primary">Add Charge</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Edit Charge Modal -->
        <div id="editChargeModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Charge</h3>
                    <span class="close" onclick="closeModal('editChargeModal')">&times;</span>
                </div>
                <div class="modal-body">
                                    <div class="tenant-context" style="display:flex; gap:8px; align-items:center; position:relative;">
                                        <strong id="editChargeTenantInfo"></strong>
                                        <button type="button" id="editViewLeaseBtn" class="view-lease-btn" onclick="toggleModalLeaseTooltip('editLeaseTooltip')" title="View Lease Details" style="margin-left:8px;">
                                            <i class="fas fa-info-circle"></i>
                                        </button>
                                        <div class="lease-tooltip" id="editLeaseTooltip" style="display:none; position: absolute; z-index: 9999; margin-top: 36px;">
                                            <!-- Lease preview for edit modal -->
                                        </div>
                                    </div>
                    <form id="editChargeForm" onsubmit="handleEditChargeSubmission(event)">
                        <input type="hidden" id="editChargeId" name="chargeId">
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editChargeType">Type</label>
                                <select id="editChargeType" name="type" required>
                                    ${(CHARGE_TYPES_LIST || [])
            .map(
                (t) =>
                    `<option value="${t.value}">${t.label}</option>`
            )
            .join("")}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="editChargeAmount">Amount</label>
                                <input type="number" id="editChargeAmount" name="amount" step="0.01" min="0" required>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="editChargeDescription">Description</label>
                            <input type="text" id="editChargeDescription" name="description" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="editChargeDueDate">Due Date</label>
                            <input type="date" id="editChargeDueDate" name="dueDate" required>
                        </div>
                        
                        
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeModal('editChargeModal')">Cancel</button>
                            <button type="submit" class="btn-primary">Update Charge</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- View Charge Modal -->
        <div id="viewChargeModal" class="modal">
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>Charge Details</h3>
                    <span class="close" onclick="closeModal('viewChargeModal')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="charge-details-grid">
                        <div class="detail-item">
                            <label>Tenant:</label>
                            <span id="viewChargeTenant"></span>
                        </div>
                        <div class="detail-item">
                            <label>Unit:</label>
                            <span id="viewChargeUnit"></span>
                        </div>
                        <div class="detail-item">
                            <label>Type:</label>
                            <span id="viewChargeType"></span>
                        </div>
                        <div class="detail-item">
                            <label>Amount:</label>
                            <span id="viewChargeAmount"></span>
                        </div>
                        <div class="detail-item">
                            <label>Due Date:</label>
                            <span id="viewChargeDueDate"></span>
                        </div>
                        <div class="detail-item">
                            <label>Created:</label>
                            <span id="viewChargeCreatedDate"></span>
                        </div>
                        <div class="detail-item">
                            <label>Status:</label>
                            <span id="viewChargeStatus"></span>
                        </div>
                        <div class="detail-item full-width">
                            <label>Description:</label>
                            <span id="viewChargeDescription"></span>
                        </div>
                        <!-- notes removed from view modal -->
                    </div>
                    
                    <div class="payment-history-section">
                        <h4>Payment History</h4>
                        <div id="viewChargePaymentHistory"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Delete Charge Modal -->
        <div id="deleteChargeModal" class="modal">
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h3>Delete Charge</h3>
                    <span class="close" onclick="closeModal('deleteChargeModal')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="warning-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Are you sure you want to delete this charge? This action cannot be undone.</p>
                    </div>
                    
                    <div class="charge-summary">
                        <div class="summary-item">
                            <label>Tenant:</label>
                            <span id="deleteChargeTenant"></span>
                        </div>
                        <div class="summary-item">
                            <label>Unit:</label>
                            <span id="deleteChargeUnit"></span>
                        </div>
                        <div class="summary-item">
                            <label>Description:</label>
                            <span id="deleteChargeDescription"></span>
                        </div>
                        <div class="summary-item">
                            <label>Amount:</label>
                            <span id="deleteChargeAmount"></span>
                        </div>
                        <div class="summary-item">
                            <label>Due Date:</label>
                            <span id="deleteChargeDueDate"></span>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeModal('deleteChargeModal')">Cancel</button>
                        <button type="button" class="btn-danger" onclick="confirmDeleteCharge()">Delete Charge</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalsHTML);
}

function createAdvancedAddChargesModal(tenantsParam) {
    const existingModal = document.getElementById("advancedAddChargeModal");
    if (existingModal) {
        existingModal.remove();
    }

    let chargeCounter = 0;
    let currentMode = "single";

    const tenants =
        Array.isArray(tenantsParam) && tenantsParam.length ? tenantsParam : [];

    const modalHTML = `
        <div id="advancedAddChargeModal" class="modal" style="display: flex;">
            <div class="modal-content modal-xl">
                <div class="modal-header modal-header-blue">
                    <h3><i class="fas fa-plus-circle"></i> Add Charges</h3>
                    <p class="modal-subtitle">Create single or multiple charges efficiently</p>
                    <span class="close" onclick="closeModal('advancedAddChargeModal')">&times;</span>
                </div>
                <div class="modal-body modal-body-charges">
                    <form id="advancedChargesForm">
                        <!-- Mode Toggle -->
                        <div class="advanced-mode-toggle">
                            <button type="button" class="advanced-mode-btn active" onclick="toggleAdvancedMode('single')">
                                <i class="fas fa-file"></i> Single Charge
                            </button>
                            <button type="button" class="advanced-mode-btn" onclick="toggleAdvancedMode('multiple')">
                                <i class="fas fa-files"></i> Multiple Charges
                            </button>
                        </div>

                        <!-- Bulk Actions (Hidden by default) -->
                        <div class="advanced-bulk-actions" id="advancedBulkActions" style="display: none;">
                            <div class="advanced-bulk-title">
                                <i class="fas fa-magic"></i> Apply to All Charges
                            </div>
                            <div class="advanced-bulk-fields">
                                <div class="advanced-field-group">
                                    <label class="advanced-field-label">Bulk Due Date</label>
                                    <input type="date" class="advanced-field-input" id="advancedBulkDueDate">
                                </div>
                                <div class="advanced-field-group">
                                    <label class="advanced-field-label">Bulk Charge Date</label>
                                    <input type="date" class="advanced-field-input" id="advancedBulkChargeDate">
                                </div>
                                <div class="advanced-field-group">
                                    <label class="advanced-field-label">Bulk Charge Type</label>
                                    <select class="advanced-field-select" id="advancedBulkChargeType">
                                        <option value="">Select charge type...</option>
                                        ${CHARGE_TYPES_LIST.map(
        (t) =>
            `<option value="${t.value}">${t.label}</option>`
    ).join("")}
                                    </select>
                                </div>
                                <div class="advanced-field-group">
                                    <label class="advanced-field-label">Bulk Amount</label>
                                    <input type="number" class="advanced-field-input" id="advancedBulkAmount" step="0.01" min="0" placeholder="0.00">
                                </div>
                            </div>
                            <button type="button" class="advanced-apply-bulk-btn" onclick="applyAdvancedBulkSettings()">
                                <i class="fas fa-check"></i> Apply to All
                            </button>
                        </div>

                        <!-- Charges List -->
                        <div class="advanced-charges-list" id="advancedChargesList">
                            <!-- Charges will be added here dynamically -->
                        </div>

                        <!-- Add Charge Button (Hidden in single mode) -->
                        <div class="advanced-add-charge-container" id="advancedAddChargeContainer" style="display: none;">
                            <button type="button" class="advanced-add-charge-btn" onclick="addAdvancedNewCharge()">
                                <i class="fas fa-plus"></i> Add Another Charge
                            </button>
                        </div>

                        <!-- Charges Summary -->
                        <div class="advanced-charges-summary" id="advancedChargesSummary" style="display: none;">
                            <div class="advanced-summary-title">
                                <i class="fas fa-chart-bar"></i> Summary
                            </div>
                            <div class="advanced-summary-stats">
                                <div class="advanced-stat-item">
                                    <span class="advanced-stat-value" id="advancedTotalCharges">0</span>
                                    <span class="advanced-stat-label">Total Charges</span>
                                </div>
                                <div class="advanced-stat-item">
                                    <span class="advanced-stat-value" id="advancedTotalAmount">₱0.00</span>
                                    <span class="advanced-stat-label">Total Amount</span>
                                </div>
                                <div class="advanced-stat-item">
                                    <span class="advanced-stat-value" id="advancedUniqueTenants">0</span>
                                    <span class="advanced-stat-label">Unique Tenants</span>
                                </div>
                                <div class="advanced-stat-item">
                                    <span class="advanced-stat-value" id="advancedRecurringCharges">0</span>
                                    <span class="advanced-stat-label">Recurring Charges</span>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-actions modal-actions-blue">
                    <button type="button" class="btn-secondary" onclick="resetAdvancedAllCharges()">
                        <i class="fas fa-undo"></i> Reset All
                    </button>
                    <button type="button" class="btn-info" onclick="previewAdvancedAllCharges()">
                        <i class="fas fa-eye"></i> Preview All
                    </button>
                    <button type="button" class="btn-primary" onclick="submitAdvancedCharges()">
                        <i class="fas fa-plus"></i> <span id="advancedSubmitText">Add Charge</span>
                    </button>
                    <button type="button" class="btn-secondary" onclick="closeModal('advancedAddChargeModal')">Cancel</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    injectAdvancedChargesModalStyles();

    setupAdvancedChargesModalFunctions(tenants, chargeCounter, currentMode);

    setAdvancedDefaultDates();
    addAdvancedNewCharge();
}

function injectAdvancedChargesModalStyles() {
    if (document.getElementById("advanced-charges-modal-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "advanced-charges-modal-styles";
    styleSheet.textContent = `
        /* Modal Enhancements */
        .modal-xl {
            max-width: 95vw;
            width: 1200px;
            max-height: 90vh;
            overflow-y: auto;
        }

        .modal-header-blue {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 24px 32px;
            position: relative;
        }

        .modal-subtitle {
            font-size: 14px;
            margin: 4px 0 0 0;
            opacity: 0.9;
            font-weight: 400;
        }

        .modal-body-charges {
            padding: 32px;
            max-height: 70vh;
            overflow-y: auto;
        }

        .modal-actions-blue {
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
        }

        /* Mode Toggle */
        .advanced-mode-toggle {
            display: flex;
            background: #f1f5f9;
            border-radius: 12px;
            padding: 4px;
            margin-bottom: 24px;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06);
        }

        .advanced-mode-btn {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            background: transparent;
            color: #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 14px;
        }

        .advanced-mode-btn.active {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        /* Bulk Actions */
        .advanced-bulk-actions {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
            border: 1px solid #e2e8f0;
        }

        .advanced-bulk-title {
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .advanced-bulk-fields {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 16px;
        }

        .advanced-apply-bulk-btn {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .advanced-apply-bulk-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        /* Field Styling */
        .advanced-field-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .advanced-field-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .advanced-field-label.required::after {
            content: '*';
            color: #ef4444;
            margin-left: 4px;
        }

        .advanced-field-input,
        .advanced-field-select,
        .advanced-field-textarea {
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s ease;
            background: white;
        }

        .advanced-field-input:focus,
        .advanced-field-select:focus,
        .advanced-field-textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .advanced-field-textarea {
            min-height: 80px;
            resize: vertical;
            font-family: inherit;
        }
        /* Lease tooltip styles */
        .view-lease-btn {
            background: transparent;
            border: 1px solid #e5e7eb;
            width: 36px;
            height: 36px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #374151;
        }
        .view-lease-btn:hover { background: #f8fafc; }

        .lease-tooltip {
            position: absolute;
            top: 44px;
            right: 0;
            min-width: 220px;
            max-width: 380px;
            background: #ffffff;
            border: 1px solid rgba(226,232,240,0.9);
            border-radius: 10px;
            box-shadow: 0 12px 30px rgba(2,6,23,0.12);
            padding: 10px 12px;
            z-index: 999999;
            font-size: 13px;
            color: #0f172a;
            white-space: normal;
            word-wrap: break-word;
            overflow: auto;
            max-height: 260px;
        }
        /* small caret/arrow */
        .lease-tooltip::before {
            content: "";
            position: absolute;
            top: -8px;
            right: 14px;
            width: 12px;
            height: 12px;
            background: #ffffff;
            transform: rotate(45deg);
            border-left: 1px solid rgba(226,232,240,0.9);
            border-top: 1px solid rgba(226,232,240,0.9);
            box-shadow: -2px -2px 6px rgba(2,6,23,0.04);
        }
        .lease-tooltip .lt-row { display:flex; justify-content:space-between; gap:8px; padding:6px 0; }
        .lease-tooltip .lt-label { color:#64748b; font-weight:600; }
        .lease-tooltip .lt-value { color:#0f172a; font-weight:700; }

    .advanced-field-group > div { display:flex; align-items:center; }
    .advanced-field-group select.advanced-field-select { min-width: 0; max-width: 100%; }
    .advanced-field-group select.advanced-field-select option { white-space: nowrap; }
    .advanced-charge-fields .advanced-field-group { min-width: 120px; }
    .advanced-field-group .view-lease-btn { flex: 0 0 36px; }

    .advanced-charge-fields { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }

    .lease-field-group { grid-column: span 2; min-width: 320px; }

    .charge-type-field { min-width: 140px; }
    .amount-field { min-width: 120px; }

        /* Charges List */
        .advanced-charges-list {
            margin-bottom: 24px;
        }

        .advanced-charge-item {
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            margin-bottom: 16px;
            overflow: hidden;
            transition: all 0.3s ease;
        }

        .advanced-charge-item:hover {
            border-color: #3b82f6;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }

        .advanced-charge-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-bottom: 1px solid #e2e8f0;
        }

        .advanced-charge-number {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
        }

        .advanced-charge-actions {
            display: flex;
            gap: 8px;
        }

        .advanced-remove-charge-btn,
        .advanced-duplicate-charge-btn {
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .advanced-remove-charge-btn {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
        }

        .advanced-duplicate-charge-btn {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
        }

        .advanced-remove-charge-btn:hover,
        .advanced-duplicate-charge-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .advanced-charge-fields {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            padding: 20px;
        }

        /* Add Charge Button */
        .advanced-add-charge-container {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
        }

        .advanced-add-charge-btn {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .advanced-add-charge-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        /* Summary */
        .advanced-charges-summary {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
            border: 1px solid #e2e8f0;
        }

        .advanced-summary-title {
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .advanced-summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
        }

        .advanced-stat-item {
            text-align: center;
            padding: 12px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }

        .advanced-stat-value {
            display: block;
            font-size: 20px;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 4px;
        }

        .advanced-stat-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 500;
        }

        /* Recurring Options */
        .advanced-recurring-options {
            display: none;
            grid-column: 1 / -1;
        }

        .advanced-recurring-options.show {
            display: block;
            animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .modal-xl {
                max-width: 95vw;
                width: 95vw;
                margin: 20px;
            }

            .modal-body-charges {
                padding: 16px;
            }

            .advanced-charge-fields {
                grid-template-columns: 1fr;
                gap: 12px;
            }

            .advanced-bulk-fields {
                grid-template-columns: 1fr;
            }

            .advanced-summary-stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    `;

    document.head.appendChild(styleSheet);
}

function setupAdvancedChargesModalFunctions(
    tenants,
    chargeCounter,
    currentMode
) {
    window.setAdvancedDefaultDates = function () {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 5);

        const bulkChargeDate = document.getElementById("advancedBulkChargeDate");
        const bulkDueDate = document.getElementById("advancedBulkDueDate");

        if (bulkChargeDate)
            bulkChargeDate.value = today.toISOString().split("T")[0];
        if (bulkDueDate) bulkDueDate.value = nextMonth.toISOString().split("T")[0];
    };

    window.toggleAdvancedMode = function (mode) {
        currentMode = mode;
        const modeButtons = document.querySelectorAll(".advanced-mode-btn");
        const bulkActions = document.getElementById("advancedBulkActions");
        const addChargeContainer = document.getElementById(
            "advancedAddChargeContainer"
        );
        const chargesSummary = document.getElementById("advancedChargesSummary");
        const submitText = document.getElementById("advancedSubmitText");

        modeButtons.forEach((btn) => {
            btn.classList.remove("active");
        });
        event.target.classList.add("active");

        if (mode === "multiple") {
            bulkActions.style.display = "block";
            addChargeContainer.style.display = "flex";
            chargesSummary.style.display = "block";
            submitText.textContent = "Add All Charges";
        } else {
            bulkActions.style.display = "none";
            addChargeContainer.style.display = "none";
            chargesSummary.style.display = "none";
            submitText.textContent = "Add Charge";
        }

        updateAdvancedSummary();
    };

    window.addAdvancedNewCharge = function () {
        chargeCounter++;
        const chargesList = document.getElementById("advancedChargesList");

        const chargeItem = document.createElement("div");
        chargeItem.className = "advanced-charge-item";
        chargeItem.id = `advancedCharge-${chargeCounter}`;

        chargeItem.innerHTML = `
            <div class="advanced-charge-item-header">
                <span class="advanced-charge-number">Charge #${chargeCounter}</span>
                <div class="advanced-charge-actions">
                    <button type="button" class="advanced-duplicate-charge-btn" onclick="duplicateAdvancedCharge(${chargeCounter})">
                        <i class="fas fa-copy"></i> Duplicate
                    </button>
                    <button type="button" class="advanced-remove-charge-btn" onclick="removeAdvancedCharge(${chargeCounter})">
                        <i class="fas fa-times"></i> Remove
                    </button>
                </div>
            </div>
            
            <div class="advanced-charge-fields">
                <div class="advanced-field-group">
                    <label class="advanced-field-label required">Tenant</label>
                    <select class="advanced-field-select" name="advancedTenant_${chargeCounter}" required onchange="populateLeaseOptionsForCharge(${chargeCounter}); updateAdvancedSummary()">
                        <option value="">Choose a tenant...</option>
                        ${tenants
                .map(
                    (tenant) => `
                            <option value="${tenant.user_id || tenant.id || ""
                        }" data-unit="${tenant.unit || ""}" data-email="${tenant.email || ""
                        }" data-phone="${tenant.phone || ""}">
                                ${[
                            tenant.first_name || tenant.name || "",
                            tenant.last_name || "",
                            tenant.suffix || "",
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .trim()}
                            </option>
                        `
                )
                .join("")}
                    </select>
                </div>

                <div class="advanced-field-group lease-field-group">
                    <label class="advanced-field-label required">Lease</label>
                    <div style="display:flex; gap:8px; align-items:center; position:relative;">
                        <select class="advanced-field-select" id="advancedLease_${chargeCounter}" name="advancedLease_${chargeCounter}" required style="flex:1;">
                            <option value="">Select lease...</option>
                        </select>
                        <button type="button" id="viewLeaseBtn_${chargeCounter}" class="view-lease-btn" onclick="toggleLeaseTooltip(${chargeCounter})" title="View Lease Details">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <div class="lease-tooltip" id="leaseTooltip_${chargeCounter}" style="display:none;">
                            <!-- Lease preview inserted here -->
                        </div>
                    </div>
                </div>
                
                <div class="advanced-field-group charge-type-field">
                    <label class="advanced-field-label required">Charge Type</label>
                    <select class="advanced-field-select" name="advancedChargeType_${chargeCounter}" required onchange="updateAdvancedSummary()">
                        <option value="">Select charge type...</option>
                        ${CHARGE_TYPES_LIST.map(
                    (t) =>
                        `<option value="${t.value}">${t.label}</option>`
                ).join("")}
                    </select>
                </div>
                
                <div class="advanced-field-group amount-field">
                    <label class="advanced-field-label required">Amount</label>
                    <input type="number" class="advanced-field-input" name="advancedAmount_${chargeCounter}" step="0.01" min="0" 
                           placeholder="0.00" required oninput="updateAdvancedSummary()">
                </div>
                
                <div class="advanced-field-group">
                    <label class="advanced-field-label required">Due Date</label>
                    <input type="date" class="advanced-field-input" name="advancedDueDate_${chargeCounter}" required>
                </div>
                
                <div class="advanced-field-group">
                    <label class="advanced-field-label required">Charge Date</label>
                    <input type="date" class="advanced-field-input" name="advancedChargeDate_${chargeCounter}" required>
                </div>
                
                <div class="advanced-field-group" style="grid-column: 1 / -1;">
                    <label class="advanced-field-label">Description</label>
                    <textarea class="advanced-field-textarea" name="advancedDescription_${chargeCounter}" 
                              placeholder="Enter charge description (optional)..."></textarea>
                </div>
                
                <div class="advanced-field-group">
                    <label class="advanced-field-label">
                        <input type="checkbox" name="advancedIsRecurring_${chargeCounter}" onchange="toggleAdvancedRecurringOptions(${chargeCounter}); updateAdvancedSummary();" style="margin-right: 8px;">
                        Recurring Charge
                    </label>
                </div>
                
                <div class="advanced-field-group advanced-recurring-options" id="advancedRecurring-${chargeCounter}">
                    <label class="advanced-field-label">Frequency</label>
                    <select class="advanced-field-select" name="advancedRecurringFrequency_${chargeCounter}">
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semi-annually">Semi-Annually</option>
                        <option value="annually">Annually</option>
                    </select>
                </div>
                
                <div class="advanced-field-group advanced-recurring-options" id="advancedAutoGenUntil-${chargeCounter}">
                    <label class="advanced-field-label">Auto-Generate Until</label>
                    <input type="date" class="advanced-field-input" name="advancedAutoGenUntil_${chargeCounter}" placeholder="Optional">
                </div>
            </div>
        `;

        chargesList.appendChild(chargeItem);

        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 5);

        chargeItem.querySelector(
            `input[name="advancedChargeDate_${chargeCounter}"]`
        ).value = today.toISOString().split("T")[0];
        chargeItem.querySelector(
            `input[name="advancedDueDate_${chargeCounter}"]`
        ).value = nextMonth.toISOString().split("T")[0];

        updateAdvancedSummary();

        const tenantSelect = chargeItem.querySelector(
            `select[name="advancedTenant_${chargeCounter}"]`
        );
        if (tenantSelect && tenantSelect.value) {
            populateLeaseOptionsForCharge(chargeCounter);
        }

        chargeItem.style.opacity = "0";
        chargeItem.style.transform = "translateY(20px)";
        setTimeout(() => {
            chargeItem.style.transition = "all 0.3s ease";
            chargeItem.style.opacity = "1";
            chargeItem.style.transform = "translateY(0)";
        }, 10);
    };

    window.removeAdvancedCharge = function (id) {
        if (chargeCounter <= 1) {
            showAlert("At least one charge is required.", "error");
            return;
        }

        showConfirm("Are you sure you want to remove this charge?", "Remove charge").then((ok) => {
            if (!ok) return;
            const chargeItem = document.getElementById(`advancedCharge-${id}`);
            if (chargeItem) {
                chargeItem.style.transition = "all 0.3s ease";
                chargeItem.style.opacity = "0";
                chargeItem.style.transform = "translateY(-20px)";
                setTimeout(() => {
                    chargeItem.remove();
                    renumberAdvancedCharges();
                    updateAdvancedSummary();
                }, 300);
            }
        });
    };

    window.duplicateAdvancedCharge = function (id) {
        const sourceCharge = document.getElementById(`advancedCharge-${id}`);
        if (!sourceCharge) return;

        const sourceData = {};
        const sourceFields = sourceCharge.querySelectorAll(
            "input, select, textarea"
        );
        sourceFields.forEach((field) => {
            if (field.type === "checkbox") {
                sourceData[field.name] = field.checked;
            } else {
                sourceData[field.name] = field.value;
            }
        });

        addAdvancedNewCharge();

        const newCharge = document.getElementById(
            `advancedCharge-${chargeCounter}`
        );
        const newFields = newCharge.querySelectorAll("input, select, textarea");

        newFields.forEach((field) => {
            const baseName = field.name.replace(`_${chargeCounter}`, "");
            const sourceFieldName = Object.keys(sourceData).find(
                (name) => name.includes(baseName) && name !== field.name
            );

            if (sourceFieldName && sourceData[sourceFieldName] !== undefined) {
                if (field.type === "checkbox") {
                    field.checked = sourceData[sourceFieldName];
                } else {
                    field.value = sourceData[sourceFieldName];
                }
            }
        });

        try {
            const srcLeaseFieldName = Object.keys(sourceData).find((n) =>
                n.includes("Lease")
            );
            const srcLeaseValue = srcLeaseFieldName
                ? sourceData[srcLeaseFieldName]
                : null;
            if (srcLeaseValue) {
                const tenantField = newCharge.querySelector('select[name*="Tenant"]');
                if (tenantField && tenantField.value) {
                    populateLeaseOptionsForCharge(chargeCounter, srcLeaseValue);
                }
            }
        } catch (e) {
            console.warn("Could not preserve lease selection on duplicate", e);
        }

        updateAdvancedSummary();
        showAlert("Charge duplicated successfully!", "success");
    };

    function renumberAdvancedCharges() {
        const chargeItems = document.querySelectorAll(".advanced-charge-item");
        chargeItems.forEach((item, index) => {
            const chargeNumber = item.querySelector(".advanced-charge-number");
            if (chargeNumber) {
                chargeNumber.textContent = `Charge #${index + 1}`;
            }
        });
        chargeCounter = chargeItems.length;
    }

    if (!window.__leaseTooltipListenerAttached) {
        document.addEventListener("click", function (e) {
            const btn = e.target.closest && e.target.closest(".view-lease-btn");
            if (!btn) return;

            let tooltipId = null;
            const parent = btn.closest(".tenant-context");
            if (parent) {
                const tt = parent.querySelector(".lease-tooltip");
                if (tt && tt.id) tooltipId = tt.id;
            }

            if (!tooltipId) {
                if (btn.id === "editViewLeaseBtn") tooltipId = "editLeaseTooltip";
                else if (btn.id === "recurringViewLeaseBtn")
                    tooltipId = "recurringLeaseTooltip";
            }
            if (tooltipId) {
                try {
                    toggleModalLeaseTooltip(tooltipId);
                } catch (err) {
                    console.error("tooltip trigger failed", err);
                }
            }
        });
        window.__leaseTooltipListenerAttached = true;
    }

    window.toggleAdvancedRecurringOptions = function (id) {
        const checkbox = document.querySelector(
            `input[name="advancedIsRecurring_${id}"]`
        );
        const recurringOptions = document.getElementById(`advancedRecurring-${id}`);
        const autoGenUntilOptions = document.getElementById(
            `advancedAutoGenUntil-${id}`
        );

        if (checkbox && recurringOptions) {
            if (checkbox.checked) {
                recurringOptions.classList.add("show");
                if (autoGenUntilOptions) autoGenUntilOptions.classList.add("show");
            } else {
                recurringOptions.classList.remove("show");
                if (autoGenUntilOptions) autoGenUntilOptions.classList.remove("show");
            }
        }
    };

    window.applyAdvancedBulkSettings = function () {
        const bulkDueDate = document.getElementById("advancedBulkDueDate").value;
        const bulkChargeDate = document.getElementById(
            "advancedBulkChargeDate"
        ).value;
        const bulkChargeType = document.getElementById(
            "advancedBulkChargeType"
        ).value;
        const bulkAmount = document.getElementById("advancedBulkAmount").value;

        let appliedCount = 0;

        document.querySelectorAll(".advanced-charge-item").forEach((item) => {
            if (bulkDueDate) {
                const dueDateField = item.querySelector('input[name*="DueDate"]');
                if (dueDateField) {
                    dueDateField.value = bulkDueDate;
                    appliedCount++;
                }
            }

            if (bulkChargeDate) {
                const chargeDateField = item.querySelector('input[name*="ChargeDate"]');
                if (chargeDateField) {
                    chargeDateField.value = bulkChargeDate;
                    appliedCount++;
                }
            }

            if (bulkChargeType) {
                const chargeTypeField = item.querySelector(
                    'select[name*="ChargeType"]'
                );
                if (chargeTypeField) {
                    chargeTypeField.value = bulkChargeType;
                    appliedCount++;
                }
            }

            if (bulkAmount) {
                const amountField = item.querySelector('input[name*="Amount"]');
                if (amountField) {
                    amountField.value = bulkAmount;
                    appliedCount++;
                }
            }
        });

        updateAdvancedSummary();
        showAlert(
            `Bulk settings applied to ${Math.ceil(appliedCount / 4)} charges!`,
            "success"
        );
    };

    window.updateAdvancedSummary = function () {
        const chargeItems = document.querySelectorAll(".advanced-charge-item");
        let totalAmount = 0;
        let uniqueTenants = new Set();
        let recurringCount = 0;

        chargeItems.forEach((item) => {
            const amountField = item.querySelector('input[name*="Amount"]');
            const tenantField = item.querySelector('select[name*="Tenant"]');
            const recurringField = item.querySelector('input[name*="IsRecurring"]');

            if (amountField && amountField.value) {
                totalAmount += parseFloat(amountField.value) || 0;
            }

            if (tenantField && tenantField.value) {
                uniqueTenants.add(tenantField.value);
            }

            if (recurringField && recurringField.checked) {
                recurringCount++;
            }
        });

        document.getElementById("advancedTotalCharges").textContent =
            chargeItems.length;
        document.getElementById(
            "advancedTotalAmount"
        ).textContent = `₱${totalAmount.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
        })}`;
        document.getElementById("advancedUniqueTenants").textContent =
            uniqueTenants.size;
        document.getElementById("advancedRecurringCharges").textContent =
            recurringCount;
    };

    window.resetAdvancedAllCharges = function () {
        showConfirm(
            "Are you sure you want to reset all charges? This will remove all entered data.",
            "Reset all charges"
        ).then((ok) => {
            if (!ok) return;
            const chargesList = document.getElementById("advancedChargesList");
            chargesList.innerHTML = "";
            chargeCounter = 0;
            addAdvancedNewCharge();
            updateAdvancedSummary();
            showAlert("All charges have been reset.", "success");
        });
    };

    window.previewAdvancedAllCharges = function () {
        const chargeItems = document.querySelectorAll(".advanced-charge-item");
        let isValid = true;
        let previewData = [];

        chargeItems.forEach((item, index) => {
            const tenantField = item.querySelector('select[name*="Tenant"]');
            const typeField = item.querySelector('select[name*="ChargeType"]');
            const amountField = item.querySelector('input[name*="Amount"]');
            const dueDateField = item.querySelector('input[name*="DueDate"]');

            if (
                !tenantField.value ||
                !typeField.value ||
                !amountField.value ||
                !dueDateField.value
            ) {
                isValid = false;
                item.style.border = "2px solid #ef4444";
                setTimeout(() => {
                    item.style.border = "2px solid #e5e7eb";
                }, 3000);
            } else {
                const tenantName = tenantField.options[tenantField.selectedIndex].text;
                previewData.push({
                    tenant: tenantName,
                    type: typeField.value,
                    amount: parseFloat(amountField.value),
                    dueDate: dueDateField.value,
                });
            }
        });

        if (!isValid) {
            showAlert("Please fill in all required fields for all charges.", "error");
            return;
        }

        let previewText = "Charges Preview:\\n\\n";
        previewData.forEach((charge, index) => {
            previewText += `${index + 1}. ${charge.tenant} - ${charge.type
                }: ₱${charge.amount.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                })} (Due: ${charge.dueDate})\\n`;
        });

        alert(previewText);
    };

    window.submitAdvancedCharges = async function () {
        const chargeItems = document.querySelectorAll(".advanced-charge-item");
        let isValid = true;
        let chargeData = [];

        chargeItems.forEach((item, index) => {
            const parts = (item.id || "").split("-");
            const rowNum = parts.length > 1 ? parts[1] : String(index + 1);
            const tenantField = item.querySelector(
                `select[name="advancedTenant_${rowNum}"]`
            );
            const leaseField =
                document.getElementById(`advancedLease_${rowNum}`) ||
                item.querySelector(`select[name="advancedLease_${rowNum}"]`);
            const typeField = item.querySelector(
                `select[name="advancedChargeType_${rowNum}"]`
            );
            const amountField = item.querySelector(
                `input[name="advancedAmount_${rowNum}"]`
            );
            const dueDateField = item.querySelector(
                `input[name="advancedDueDate_${rowNum}"]`
            );
            const chargeDateField = item.querySelector(
                `input[name="advancedChargeDate_${rowNum}"]`
            );
            const descriptionField = item.querySelector(
                `textarea[name="advancedDescription_${rowNum}"]`
            );
            const recurringField = item.querySelector(
                `input[name="advancedIsRecurring_${rowNum}"]`
            );
            const frequencyField = item.querySelector(
                `select[name="advancedRecurringFrequency_${rowNum}"]`
            );
            const autoUntilField = item.querySelector(
                `input[name="advancedAutoGenUntil_${rowNum}"]`
            );

            if (
                !tenantField.value ||
                !leaseField.value ||
                !typeField.value ||
                !amountField.value ||
                !dueDateField.value ||
                !chargeDateField.value
            ) {
                isValid = false;
                item.style.border = "2px solid #ef4444";
                setTimeout(() => {
                    item.style.border = "2px solid #e5e7eb";
                }, 3000);
            } else {
                const tenant =
                    tenants.find(
                        (t) => String(t.user_id || t.id) === String(tenantField.value)
                    ) || null;
                const leaseId = leaseField ? leaseField.value : null;

                chargeData.push({
                    tenant_id: tenant ? tenant.user_id || tenant.id : null,
                    tenant: tenant
                        ? [
                            tenant.first_name || tenant.name || "",
                            tenant.last_name || "",
                            tenant.suffix || "",
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .trim()
                        : "",
                    unit: tenant ? tenant.unit : "",
                    lease_id: leaseId || null,
                    type: typeField.value,
                    description:
                        descriptionField.value ||
                        `${typeField.options[typeField.selectedIndex].text} charge`,
                    amount: parseFloat(amountField.value),
                    dueDate: dueDateField.value,
                    chargeDate: chargeDateField.value,
                    isRecurring: recurringField.checked,
                    frequency: recurringField.checked ? frequencyField.value : null,
                    autoGenerateUntil: recurringField.checked
                        ? autoUntilField && autoUntilField.value
                            ? autoUntilField.value
                            : null
                        : null,
                    status: "pending",
                });
            }
        });

        if (!isValid) {
            showAlert("Please fill in all required fields for all charges.", "error");
            return;
        }

        const modalEl = document.getElementById("advancedAddChargeModal");
        const submitBtn = document.querySelector(
            "#advancedAddChargeModal .modal-actions-blue .btn-primary"
        );
        const submitText = document.getElementById("advancedSubmitText");
        const originalBtnText = submitText ? submitText.textContent : "";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add("loading");
        }
        if (submitText) {
            submitText.innerHTML = '<span class="btn-spinner"></span> Submitting...';
        }

        const disabledEls = [];
        if (modalEl) {
            const controls = modalEl.querySelectorAll(
                "input, select, textarea, button"
            );
            controls.forEach((ctrl) => {
                if (!ctrl.disabled) {
                    disabledEls.push(ctrl);
                    ctrl.disabled = true;
                }
            });

            const cancelBtn = modalEl.querySelector(
                ".modal-actions-blue .btn-secondary:last-of-type"
            );
            if (cancelBtn) cancelBtn.disabled = false;
        }

        const normalizeChargeType = (t) => {
            if (!t) return "Others";
            const v = String(t).toLowerCase();
            if (v === "rent") return "Rent";
            if (v === "utility") return "Utility";
            if (v === "maintenance") return "Maintenance";
            if (
                v === "late fee" ||
                v === "late_fee" ||
                v === "latefee" ||
                v === "penalty"
            )
                return "Late Fee";
            if (v === "others" || v === "other") return "Others";

            return t
                .split(" ")
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
                .join(" ");
        };

        try {
            const token = getJwtToken();
            const results = [];

            for (const chargeInfo of chargeData) {
                const payload = {
                    lease_id: chargeInfo.lease_id,
                    charge_type: normalizeChargeType(chargeInfo.type),
                    description: chargeInfo.description,
                    amount: chargeInfo.amount,
                    charge_date: chargeInfo.chargeDate,
                    due_date: chargeInfo.dueDate,
                    is_recurring: chargeInfo.isRecurring ? 1 : 0,
                    status: "Unpaid",
                };
                if (chargeInfo.isRecurring) {
                    if (chargeInfo.frequency) payload.frequency = chargeInfo.frequency;
                    if (chargeInfo.autoGenerateUntil)
                        payload.auto_generate_until = chargeInfo.autoGenerateUntil;
                }

                const res = await fetch(`${API_BASE_URL}/charges/create-charge`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const errText = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to create charge (HTTP ${res.status}) ${errText}`
                    );
                }
                const json = await res.json();
                results.push(json);
            }

            closeModal("advancedAddChargeModal");
            invalidateChargesCache();
            invalidateStatsCache();
            await fetchCharges({ force: true });

            const totalAdded = chargeData.length;
            const totalAmount = chargeData.reduce(
                (sum, c) => sum + (c.amount || 0),
                0
            );
            const message =
                totalAdded === 1
                    ? `Charge of ${formatCurrency(totalAmount)} added successfully!`
                    : `${totalAdded} charges totaling ${formatCurrency(
                        totalAmount
                    )} added successfully!`;
            showAlert(message, "success");
        } catch (e) {
            console.error("Error submitting charges:", e);
            showAlert(e.message || "Failed to submit charges", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove("loading");
            }
            if (submitText) submitText.textContent = originalBtnText || "Add Charge";

            disabledEls.forEach((ctrl) => {
                try {
                    ctrl.disabled = false;
                } catch (_) { }
            });
        }
    };
}

function initializeEventListeners() {
    window.onclick = function (event) {
        if (event.target.classList.contains("modal")) {
            event.target.style.display = "none";
            document.body.style.overflow = "auto";
        }
    };

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            const openModals = document.querySelectorAll('.modal[style*="flex"]');
            openModals.forEach((modal) => {
                modal.style.display = "none";
            });
            document.body.style.overflow = "auto";
        }
    });

    document.addEventListener("change", function (event) {
        if (event.target.id === "paymentMethod") {
            const referenceField = document.getElementById("paymentReference");
            if (referenceField && !referenceField.value) {
                referenceField.placeholder = `Auto-generate ${event.target.value.toUpperCase()} reference`;
            }
        }
    });
}

function viewPaymentDetails(paymentId) {
    const payment = findPaymentById(paymentId);
    const lease = findLeaseByPaymentId(paymentId);

    if (!payment || !lease) {
        showAlert("Payment not found", "error");
        return;
    }

    const relatedCharge = findChargeById(payment.chargeId);

    const modalHTML = `
        <div id="viewPaymentModal" class="modal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Payment Details</h3>
                    <span class="close" onclick="closeModal('viewPaymentModal')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="payment-details-grid">
                        <div class="detail-item">
                            <label>Payment ID:</label>
                            <span>${payment.id}</span>
                        </div>
                        <div class="detail-item">
                            <label>Tenant:</label>
                            <span>${lease.tenant}</span>
                        </div>
                        <div class="detail-item">
                            <label>Unit:</label>
                            <span>${lease.unit}</span>
                        </div>
                        <div class="detail-item">
                            <label>Type:</label>
                            <span>${capitalizeFirst(payment.type)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Amount:</label>
                            <span class="amount-highlight">${formatCurrency(
        payment.amount
    )}</span>
                        </div>
                        <div class="detail-item">
                            <label>Payment Date:</label>
                            <span>${formatDate(payment.paymentDate)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Method:</label>
                            <span>${capitalizeFirst(
        payment.paymentMethod
    )}</span>
                        </div>
                        <div class="detail-item">
                            <label>Reference:</label>
                            <span>${payment.reference}</span>
                        </div>
                        <div class="detail-item">
                            <label>Processed By:</label>
                            <span>${payment.processedBy || "System"}</span>
                        </div>
                        <div class="detail-item full-width">
                            <label>Description:</label>
                            <span>${payment.description}</span>
                        </div>
                        <div class="detail-item full-width">
                            <label>Notes:</label>
                            <span>${payment.notes || "No additional notes"
        }</span>
                        </div>
                    </div>
                    
                    ${relatedCharge
            ? `
                        <div class="charge-info-section">
                            <h4>Related Charge Information</h4>
                            <div class="charge-info-item">
                                <label>Original Due Date:</label>
                                <span>${formatDate(
                relatedCharge.dueDate
            )}</span>
                            </div>
                            <div class="charge-info-item">
                                <label>Charge Status:</label>
                                <span>Paid</span>
                            </div>
                        </div>
                    `
            : ""
        }
                    
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" onclick="closeModal('viewPaymentModal')">Close</button>
                        <button type="button" class="btn-success" onclick="generateReceipt('${payment.id
        }')">
                            <i class="fas fa-receipt"></i> View Receipt
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById("viewPaymentModal");
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

function injectPaymentModalStyles() {
    if (document.getElementById("payment-modal-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "payment-modal-styles";
    styleSheet.textContent = `
        .modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            justify-content: center;
            align-items: center;
        }

        .modal-content {
            background: white;
            padding: 32px;
            border-radius: 16px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #f1f5f9;
        }

        .modal-title {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
        }

        .close {
            color: #6b7280;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
        }

        .close:hover {
            color: #374151;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #374151;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group textarea {
            resize: vertical;
            min-height: 100px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .form-row .form-group {
            margin-bottom: 16px;
        }

        @media (max-width: 768px) {
            .form-row {
                grid-template-columns: 1fr;
                gap: 0;
            }
        }

        .detail-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .detail-item.full-width {
            grid-column: 1 / -1;
        }

        .detail-item label {
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .detail-item span {
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            padding: 8px 12px;
            background: #f9fafb;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }

        .tenant-context {
            background: #f3f4f6;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-weight: 600;
            color: #374151;
        }

        .charge-details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
        }

        @media (max-width: 768px) {
            .charge-details-grid {
                grid-template-columns: 1fr;
            }
        }

        .payment-history-section {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }

        .payment-history-section h4 {
            margin: 0 0 15px 0;
            color: #374151;
            font-size: 16px;
        }

        .payment-history-item {
            background: #f9fafb;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 8px;
            border-left: 3px solid #10b981;
        }

        .payment-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .payment-details {
            font-size: 12px;
            color: #6b7280;
            display: flex;
            gap: 15px;
        }

        .no-payments {
            color: #6b7280;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }

        .warning-message {
            background: #fef3c7;
            border: 1px solid #fbbf24;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }

        .warning-message i {
            color: #f59e0b;
            margin-top: 2px;
        }

        .warning-message p {
            margin: 0;
            color: #92400e;
        }

        .charge-summary {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }

        .summary-item:last-child {
            border-bottom: none;
        }

        .summary-item label {
            font-weight: 600;
            color: #374151;
        }

        /* Alert notifications */
        .alert-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            animation: slideInRight 0.3s ease;
            max-width: calc(100vw - 40px);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(100px); }
            to { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideOutRight {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(100px); }
        }

        /* Type badges with distinct colors */
        .badge { 
            display: inline-block; 
            padding: 4px 10px; 
            border-radius: 9999px; 
            font-size: 12px; 
            font-weight: 700; 
        }
        .badge.rent { background: #dbeafe; color: #1e40af; }
        .badge.utility { background: #fef3c7; color: #92400e; }
        .badge.maintenance { background: #dcfce7; color: #065f46; }
        .badge.penalty, .badge[aria-label~="Late"] { background: #fee2e2; color: #991b1b; }
        .badge.others { background: #e5e7eb; color: #374151; }

        /* Recurring pill */
        .recurring-pill { 
            display: inline-flex; 
            align-items: center; 
            gap: 6px; 
            padding: 2px 8px; 
            border-radius: 9999px; 
            background: #fffbeb; 
            color: #92400e; 
            font-size: 11px; 
            font-weight: 700;
            margin-left: 8px;
            vertical-align: middle;
        }
        .recurring-pill i { font-size: 10px; }

        /* Choice Modal Styles */
        .modal-choice {
            max-width: 700px;
        }

        .choice-description {
            text-align: center;
            color: #64748b;
            font-size: 15px;
            margin-bottom: 32px;
            font-weight: 500;
        }

        .choice-cards {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .choice-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 2px solid #e2e8f0;
            border-radius: 16px;
            padding: 32px 24px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            text-align: center;
        }

        .choice-card:hover {
            transform: translateY(-4px);
            border-color: #3b82f6;
            box-shadow: 0 12px 32px rgba(59, 130, 246, 0.15);
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }

        .choice-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 20px;
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: #3b82f6;
            transition: all 0.3s ease;
        }

        .choice-icon.recurring {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            color: #f59e0b;
        }

        .choice-card:hover .choice-icon {
            transform: scale(1.1) rotate(5deg);
        }

        .choice-card h4 {
            font-size: 18px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 12px;
        }

        .choice-card p {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
            margin: 0;
        }

        /* Recurring Edit Modal Styles */
        .required-indicator {
            color: #ef4444;
            font-weight: 700;
        }

        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            padding: 16px;
            background: #f8fafc;
            border-radius: 8px;
            border: 2px solid #e2e8f0;
            transition: all 0.3s ease;
        }

        .checkbox-label:hover {
            background: #eff6ff;
            border-color: #3b82f6;
        }

        .checkbox-label input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
            accent-color: #3b82f6;
        }

        .checkbox-label span {
            font-weight: 600;
            color: #1e293b;
            font-size: 15px;
        }

        .help-text {
            margin-top: 8px;
            font-size: 13px;
            color: #64748b;
            font-style: italic;
            padding-left: 16px;
        }

        @media (max-width: 768px) {
            .choice-cards {
                grid-template-columns: 1fr;
            }
        }
    `;

    document.head.appendChild(styleSheet);
}

function injectPaymentButtonStyles() {
    if (document.getElementById("payment-button-styles")) return;
    const s = document.createElement("style");
    s.id = "payment-button-styles";
    s.textContent = `
        .btn-narrow {
            padding: 6px 8px !important;
            min-width: 34px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .pending-payments-table .btn-narrow { margin-right: 6px; }
        .reference-cell { max-width: 220px; }
    .reference-cell code.reference-code { display:inline-block; max-width: 180px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; vertical-align:middle; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .reference-code.masked { letter-spacing: 1px; color: #64748b; }
        .col-toggle { font-size: 12px; }
    `;
    document.head.appendChild(s);
}

function switchTab(tabName) {
    const tabButtons = document.querySelectorAll(".tab-button");
    tabButtons.forEach((button) => {
        button.classList.remove("active");
    });

    const tabContents = document.querySelectorAll(".tab-content");
    tabContents.forEach((content) => {
        content.classList.remove("active");
    });

    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add("active");
    }

    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeContent) {
        activeContent.classList.add("active");
    }

    localStorage.setItem("activePaymentTab", tabName);

    if (tabName === "payments") {
        const btns = document.querySelectorAll(".view-toggle-btn");
        btns.forEach((b) =>
            b.classList.toggle(
                "active",
                b.dataset.view === (currentPaymentView || "pending")
            )
        );
        const allView = document.getElementById("all-payments-view");
        const pendingView = document.getElementById("pending-payments-view");
        if (allView && pendingView) {
            if (currentPaymentView === "all") {
                allView.classList.add("active");
                pendingView.classList.remove("active");
            } else {
                allView.classList.remove("active");
                pendingView.classList.add("active");
            }
        }

        const pendingTabs = document.querySelectorAll(".pending-tab-btn");
        pendingTabs.forEach((tab) =>
            tab.classList.toggle(
                "active",
                tab.dataset.status === (currentPendingStatus || "Pending")
            )
        );

        loadPendingPayments(currentPendingStatus || "Pending");
        updatePendingStatusCounts();
        if (currentPaymentView === "all") {
            fetchAllPayments(paymentsPage, paymentsLimit);
        }
    } else if (tabName === "charges") {
        fetchCharges();
    }
}

function initializeActiveTab() {
    const savedTab = localStorage.getItem("activePaymentTab") || "charges";
    switchTab(savedTab);
}

let currentPaymentView = "pending";
let currentPendingStatus = "Pending";
let pendingPayments = [];
let filteredPendingPayments = [];

function renderPaymentStatusBadge(status) {
    const s = String(status || "")
        .trim()
        .toLowerCase();
    let cls = "pending";
    let label = status || "";
    if (s === "confirmed" || s === "approved") {
        cls = "approved";
        label = "Confirmed";
    } else if (s === "rejected") {
        cls = "rejected";
        label = "Rejected";
    } else {
        cls = "pending";
        label = "Pending";
    }
    return `<span class="status-badge ${cls}">${escapeHtml(label)}</span>`;
}

async function fetchPaymentsByStatus(status = "Pending") {
    try {
        const token = localStorage.getItem("token") || "";
        const qs = new URLSearchParams({ status: String(status) });
        const response = await fetch(`${API_BASE_URL}/payments?${qs.toString()}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
            console.warn(`Failed to fetch payments for status: ${status}`);
            return [];
        }

        const data = await response.json();
        return (data && data.payments) || [];
    } catch (error) {
        console.error("Error fetching payments by status:", error);
        return [];
    }
}

function switchPaymentView(view) {
    currentPaymentView = view;
    try {
        localStorage.setItem("paymentsView", view);
    } catch { }

    const buttons = document.querySelectorAll(".view-toggle-btn");
    buttons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === view);
    });

    const allView = document.getElementById("all-payments-view");
    const pendingView = document.getElementById("pending-payments-view");

    if (view === "all") {
        allView.classList.add("active");
        pendingView.classList.remove("active");
        fetchAllPayments(1, paymentsLimit);
    } else {
        allView.classList.remove("active");
        pendingView.classList.add("active");
        loadPendingPayments(currentPendingStatus);
    }
}

async function loadPendingPayments(status = "Pending") {
    currentPendingStatus = status;
    pendingPayments = await fetchPaymentsByStatus(status);
    filteredPendingPayments = [...pendingPayments];
    filterPendingPayments();
    updatePendingStatusCounts();
}

function filterPendingByStatus(status) {
    currentPendingStatus = status;

    const tabs = document.querySelectorAll(".pending-tab-btn");
    tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.status === status);
    });

    loadPendingPayments(status);
}

function filterPendingPayments() {
    const searchTerm = (
        document.getElementById("pending-search")?.value || ""
    ).toLowerCase();
    const dateFilter = document.getElementById("pending-date")?.value || "";

    filteredPendingPayments = pendingPayments.filter((p) => {
        const matchesStatus =
            String(p.status || "")
                .trim()
                .toLowerCase() ===
            String(currentPendingStatus || "")
                .trim()
                .toLowerCase();
        const matchesSearch =
            !searchTerm ||
            (p.tenant_name && p.tenant_name.toLowerCase().includes(searchTerm)) ||
            (p.payment_id && String(p.payment_id).toLowerCase().includes(searchTerm));

        let matchesDate = true;
        if (dateFilter && p.created_at) {
            const paymentMonth = new Date(p.created_at).toISOString().slice(0, 7);
            matchesDate = paymentMonth === dateFilter;
        }

        return matchesStatus && matchesSearch && matchesDate;
    });

    renderPendingPaymentsTable();
}

function resetPendingFilters() {
    document.getElementById("pending-search").value = "";
    document.getElementById("pending-date").value = "";
    filteredPendingPayments = [...pendingPayments];
    filterPendingPayments();
}

async function updatePendingStatusCounts() {
    try {
        const [pend, conf, rej] = await Promise.all([
            fetchPaymentsByStatus("Pending"),
            fetchPaymentsByStatus("Confirmed"),
            fetchPaymentsByStatus("Rejected"),
        ]);

        const pendingCount = pend.length;
        const approvedCount = conf.length;
        const rejectedCount = rej.length;

        const pendingBadge = document.getElementById("pending-count-badge");
        const approvedBadge = document.getElementById("approved-count-badge");
        const rejectedBadge = document.getElementById("rejected-count-badge");

        if (pendingBadge) pendingBadge.textContent = pendingCount;
        if (approvedBadge) approvedBadge.textContent = approvedCount;
        if (rejectedBadge) rejectedBadge.textContent = rejectedCount;
    } catch (e) {
        console.warn("Failed to update status counts", e);
    }
}

function renderPendingPaymentsTable() {
    const tbody = document.getElementById("pending-payments-tbody");
    const mobileContainer = document.getElementById("pending-payments-mobile");

    if (!tbody) return;

    if (filteredPendingPayments.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="14">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No ${currentPendingStatus.toLowerCase()} payments found</p>
                    </div>
                </td>
            </tr>
        `;
        if (mobileContainer) mobileContainer.innerHTML = "";
        return;
    }

    tbody.innerHTML = filteredPendingPayments
        .map((payment, index) => {
            const amount = payment.amount_paid || payment.amount || 0;
            const method = payment.payment_method || "N/A";
            const submitted = payment.created_at
                ? formatDate(payment.created_at)
                : "N/A";
            const tenant = payment.tenant_name || "Unknown";
            const chargeDesc =
                payment.charge_description || `Charge #${payment.charge_id || "N/A"}`;
            const chargeType =
                payment.charge_type ||
                payment.chargeType ||
                (payment.charge ? payment.charge.type : "") ||
                "";
            const dueDate =
                payment.due_date ||
                payment.dueDate ||
                (payment.charge ? payment.charge.dueDate : "") ||
                "";
            const proofCount = Array.isArray(payment.proofs)
                ? payment.proofs.length
                : 0;
            const status = payment.status || "Pending";
            const processedBy =
                payment.processed_by_name || payment.processed_by || "-";
            const processedAt = payment.processed_at
                ? formatDate(payment.processed_at)
                : "-";
            const fullId = String(payment.payment_id || "");
            const shortId = fullId ? `${fullId.substring(0, 8)}...` : "-";
            const proofLinks = (Array.isArray(payment.proofs) ? payment.proofs : [])
                .map((p, i) => {
                    const url = typeof p === "string" ? p : p.proof_url || "";
                    if (!url) return "";
                    return `<a href="${escapeHtml(
                        url
                    )}" target="_blank" rel="noopener">Proof ${i + 1}</a>`;
                })
                .filter(Boolean)
                .join(" | ");
            const proofsCell =
                proofCount > 0
                    ? proofLinks
                    : '<span class="proof-count">0 files</span>';

            return `
            <tr>
                <td class="td-number">${index + 1}</td>
                <td>
                    <code class="copyable" title="Click to copy" onclick="window.copyPaymentId('${escapeHtml(
                fullId
            )}')">${escapeHtml(shortId)}</code>
                    <button class="btn btn-link" title="Show full ID" onclick="window.showFullPaymentId('${escapeHtml(
                fullId
            )}')"><i class="fas fa-eye"></i></button>
                </td>
                <td class="td-tenant">${escapeHtml(tenant)}</td>
                <td>${escapeHtml(chargeDesc)}</td>
                <td>${escapeHtml(chargeType)}</td>
                <td>${dueDate ? formatDate(dueDate) : "-"}</td>
                <td class="td-total"><strong>${formatCurrency(
                amount
            )}</strong></td>
                <td>${escapeHtml(method)}</td>
                <td>${submitted}</td>
                <td>${proofsCell}</td>
                <td class="td-tenant col-processed-by">${escapeHtml(
                processedBy
            )}</td>
                <td class="col-processed-at">${processedAt}</td>
                <td>
                    ${status === "Pending"
                    ? `
                    <div class="action-buttons">
                        <button class="btn btn-success btn-narrow" onclick="window.approvePayment('${escapeHtml(
                        fullId
                    )}')"><i class="fas fa-check"></i></button>
                        <button class="btn btn-danger btn-narrow" onclick="window.rejectPayment('${escapeHtml(
                        fullId
                    )}')"><i class="fas fa-times"></i></button>
                    </div>
                    `
                    : "-"
                }
                </td>
            </tr>
        `;
        })
        .join("");

    const processedByCols = document.querySelectorAll(".col-processed-by");
    const processedAtCols = document.querySelectorAll(".col-processed-at");
    const isPendingView =
        (currentPendingStatus || "Pending") === "Pending" &&
        document
            .getElementById("pending-payments-view")
            ?.classList.contains("active");
    processedByCols.forEach(
        (el) => (el.style.display = isPendingView ? "none" : "table-cell")
    );
    processedAtCols.forEach(
        (el) => (el.style.display = isPendingView ? "none" : "table-cell")
    );
}

window.copyPaymentId = function (id) {
    try {
        if (!id) return;
        navigator.clipboard
            .writeText(id)
            .then(() => {
                showAlert("Payment ID copied to clipboard", "info");
            })
            .catch(() => {
                const ta = document.createElement("textarea");
                ta.value = id;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                showAlert("Payment ID copied to clipboard", "info");
            });
    } catch (e) { }
};

window.showFullPaymentId = function (id) {
    if (!id) return;
    try {
        if (typeof Modal !== "undefined" && Modal && typeof Modal.open === "function") {
            Modal.open({
                title: "Payment ID",
                body: `<pre style="white-space:pre-wrap;">${escapeHtml(id)}</pre>`,
                showFooter: true,
                showCancel: false,
                confirmText: "OK",
            });
            return;
        }
    } catch (e) {
        console.warn("Modal not available for showFullPaymentId", e);
    }
    alert(`Payment ID:\n${id}`);
};

async function approvePayment(paymentId) {
    const okApprove = await showConfirm("Confirm this payment?", "Confirm payment");
    if (!okApprove) return;

    try {
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${API_BASE_URL}/payments/${paymentId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                status: "Confirmed",
            }),
        });

        if (!response.ok) {
            let text = "";
            try {
                text = await response.text();
            } catch (e) {
                text = response.statusText || String(response.status);
            }
            throw new Error("Failed to confirm payment: " + text);
        }

        showAlert("Payment confirmed successfully", "success");

        invalidatePaymentsCache();
        invalidateChargesCache();
        invalidateStatsCache();
        await loadPendingPayments(currentPendingStatus);
        await fetchCharges({ force: true });
        await fetchAllPayments(1, paymentsLimit, { force: true });
        await updateStatistics({ force: true });
    } catch (error) {
        console.error("Error confirming payment:", error);
        showAlert("Failed to confirm payment", "error");
    }
}

async function rejectPayment(paymentId) {
    const reason = await showPrompt("Please provide a reason for rejection (optional):", "Optional reason", "Reject payment");
    if (reason === null) return;

    try {
        const token = localStorage.getItem("token") || "";
        const response = await fetch(`${API_BASE_URL}/payments/${paymentId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                status: "Rejected",
                notes: reason ? `Rejected: ${reason}` : "Rejected by admin",
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to reject payment");
        }

        showAlert("Payment rejected", "success");
        invalidatePaymentsCache();
        invalidateStatsCache();
        await loadPendingPayments(currentPendingStatus);
        await fetchAllPayments(1, paymentsLimit, { force: true });
    } catch (error) {
        console.error("Error rejecting payment:", error);
        showAlert("Failed to reject payment", "error");
    }
}

async function viewPendingPaymentDetails(paymentId) {
    viewPaymentDetails(paymentId);
}

document.addEventListener("DOMContentLoaded", function () {
    injectEnhancedButtonStyles();
    injectPaymentModalStyles();
    injectPaymentButtonStyles();
    createModalsAndDialogs();

    syncDataArrays();

    filteredCharges = [...charges];
    filteredPayments = [...payments];

    updateStatistics({ force: true });

    renderChargesTable();
    renderPaymentsTable();

    initializeEventListeners();

    initializeActiveTab();

    const savedView = localStorage.getItem("paymentsView") || "pending";
    if (savedView === "all") {
        switchPaymentView("all");
    } else {
        switchPaymentView("pending");
    }

    const activeTab = localStorage.getItem("activePaymentTab") || "charges";
    if (activeTab === "payments") {
        loadPendingPayments("Pending");
        updatePendingStatusCounts();
    }

    try {
        const pendingCard = document.querySelector(".stat-card.pending");
        if (pendingCard) {
            pendingCard.addEventListener("click", () => {
                switchTab("payments");

                switchPaymentView("pending");

                filterPendingByStatus("Pending");

                document
                    .getElementById("pending-payments-view")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    } catch { }

    
    try {
        const raw = localStorage.getItem("paymentAdminDeepLink");
        if (raw) {
            localStorage.removeItem("paymentAdminDeepLink");
            let dl = null;
            try { dl = JSON.parse(raw); } catch (_) { dl = null; }
            if (dl && typeof dl === "object") {
                if (dl.tab === "payments" || dl.tab === "charges") {
                    switchTab(dl.tab);
                }
                if (dl.view === "all" || dl.view === "pending") {
                    switchPaymentView(dl.view);
                }
                if (dl.pendingStatus) {
                    filterPendingByStatus(String(dl.pendingStatus));
                }
                if (dl.chargesStatus) {
                    const sel = document.getElementById("charges-status");
                    if (sel) {
                        sel.value = String(dl.chargesStatus);
                        window.chargesPage = 1;
                        fetchCharges({ force: true });
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Failed to apply deep link for paymentAdmin", e);
    }
});

window.showSection = showSection;
window.switchTab = switchTab;
window.switchPaymentView = switchPaymentView;
window.filterPendingByStatus = filterPendingByStatus;
window.filterPendingPayments = filterPendingPayments;
window.resetPendingFilters = resetPendingFilters;
window.approvePayment = approvePayment;
window.rejectPayment = rejectPayment;
window.viewPendingPaymentDetails = viewPendingPaymentDetails;
window.addNewCharge = addNewCharge;
window.editCharge = editCharge;
window.removeCharge = removeCharge;
window.recordPayment = recordPayment;
window.viewChargeDetails = viewChargeDetails;
window.filterCharges = filterCharges;
window.filterPayments = filterPayments;
window.resetChargesFilters = resetChargesFilters;
window.resetPaymentsFilters = resetPaymentsFilters;
window.filterByType = filterByType;
window.filterByStatus = filterByStatus;
window.closeModal = closeModal;
window.openModal = openModal;
window.handlePaymentSubmission = handlePaymentSubmission;
window.handleAddChargeSubmission = handleAddChargeSubmission;
window.handleEditChargeSubmission = handleEditChargeSubmission;
window.confirmDeleteCharge = confirmDeleteCharge;
window.viewPaymentDetails = viewPaymentDetails;
window.generateReceipt = generateReceipt;
window.sortTable = sortTable;
window.toggleReferenceVisibility = window.toggleReferenceVisibility;
