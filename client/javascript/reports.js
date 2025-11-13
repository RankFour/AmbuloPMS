import { getProperties, getTenants } from "../api/adminApi.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

async function fetchJson(url) {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status}: ${url}`);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
        try {
            return await res.json();
        } catch {
            return null;
        }
    }
    return await res.json();
}

function qs(params = {}) {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
    });
    return u.toString();
}

const API = {
    financial: async (p) => fetchJson(`/api/v1/reports/financial?${qs(p)}`),
    tenants: async (p) => fetchJson(`/api/v1/reports/tenants?${qs(p)}`),
    properties: async (p) => fetchJson(`/api/v1/reports/properties?${qs(p)}`),
    maintenance: async (p) => fetchJson(`/api/v1/reports/maintenance?${qs(p)}`),
};

const ChargesAPI = { list: async (p) => fetchJson(`/api/v1/charges?${qs(p)}`) };

function fmtCurrency(n) {
    try {
        const v = Number(n) || 0;
        return `₱${v.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    } catch {
        return `₱${Number(n) || 0}`;
    }
}
function fmtInt(n) {
    return (Number(n) || 0).toLocaleString("en-US");
}

function set(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}
function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
}

function parseISODate(d) {
    if (!d) return null;
    const t = Date.parse(d);
    return isNaN(t) ? null : new Date(t);
}
function daysDiffUTC(a, b) {
    if (!a || !b) return 0;
    const d1 = new Date(Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()));
    const d2 = new Date(Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()));
    return Math.floor((d2 - d1) / (24 * 60 * 60 * 1000));
}

async function fetchLatePaymentsData({ from, to, propertyId } = {}) {
    const limit = 100;
    let page = 1;
    let done = false;
    const all = [];
    while (!done && page <= 20) {
        const res = await ChargesAPI.list({
            due_date_from: from || undefined,
            due_date_to: to || undefined,
            property_id: propertyId || undefined,
            page,
            limit,
        }).catch(() => null);
        const rows = (res && (res.data || res)) || [];
        all.push(...rows);
        const total = Number(res && res.total);
        if (!rows.length || (total && all.length >= total) || rows.length < limit)
            done = true;
        page++;
    }

    const today = new Date();
    const out = [];
    for (const c of all) {
        const due = parseISODate(c.due_date);
        if (!due) continue;
        const grace = Number(c.grace_period_days || 0);
        const daysPastDue = daysDiffUTC(due, today);
        const daysLate = Math.max(0, daysPastDue - grace);
        if (daysLate <= 0) continue;

        const totalPaid = Number(c.total_paid || 0);
        const effectiveAmount =
            c.amount != null ? Number(c.amount) : Number(c.original_amount || 0);
        const outstanding = Math.max(0, effectiveAmount - totalPaid);
        if (outstanding <= 0) continue;
        const canonical = String(c.canonical_status || "").toUpperCase();
        if (canonical === "WAIVED" || canonical === "PAID") continue;

        out.push({
            tenant: c.tenant_name || `Tenant ${c.lease_id || ""}`.trim(),
            daysLate,
            amount: outstanding,
            due_date: c.due_date,
            property_name: c.property_name || "",
            charge_id: c.charge_id,
        });
    }

    if (propertyId)
        return out.filter(
            (r) => !("property_id" in r) || r.property_id === propertyId
        );
    return out;
}

function niceHeaderLabel(key) {
    if (!key) return "";
    if (key === "property_id") return "Property ID";
    if (key === "property_name") return "Property";
    if (key === "avgRent" || key === "avg_rent") return "Average Rent";
    if (key === "one_time") return "One-time";
    if (key === "activeLeases" || key === "active_leases") return "Active Leases";
    if (key === "totalLeases" || key === "total_leases") return "Total Leases";
    if (key === "due_date") return "Due Date";
    if (key === "daysLate" || key === "days_late") return "Days Late";
    const label = String(key)
        .replace(/_/g, " ")
        .split(" ")
        .map((w) =>
            w.length <= 2 && /^(id|of|vs|by)$/.test(w.toLowerCase())
                ? w.toUpperCase()
                : w.charAt(0).toUpperCase() + w.slice(1)
        )
        .join(" ");
    return label;
}

function tableFrom(keyValues, headers) {
    if (!Array.isArray(keyValues) || keyValues.length === 0) {
        return `<div style="color:#64748b;">No data</div>`;
    }
    let cols =
        Array.isArray(headers) && headers.length
            ? headers.slice()
            : Array.from(new Set(keyValues.flatMap((r) => Object.keys(r || {}))));

    let mergeProperty = false;
    if (cols.includes("property_id") && cols.includes("property_name")) {
        mergeProperty = true;
        const newCols = [];
        for (const c of cols) {
            if (c === "property_name") continue;
            if (c === "property_id") {
                newCols.push("property");
                continue;
            }
            newCols.push(c);
        }
        cols = newCols;
    }

    const thead = `<thead><tr>${cols
        .map(
            (c) =>
                `<th style="padding:8px 10px; font-size:12px; color:#64748b; text-transform:none; text-align:left; border-bottom:1px solid #e5e7eb;">${c === "property" ? "Property" : niceHeaderLabel(c)
                }</th>`
        )
        .join("")}</tr></thead>`;

    const rows = keyValues
        .map(
            (r) =>
                `<tr>${cols
                    .map((c) => {
                        const val = r[c];
                        const currencyKeys =
                            /amount|price|rent|paid|outstanding|balance|fee|total_amount|total_paid/i;
                        const intKeys =
                            /count|total$|^total$|avg|number|tenants|renewals|terminations|active|inactive|hours|hrs/i;
                        let txt = val ?? "";
                        if (typeof val === "number") {
                            if (currencyKeys.test(c)) txt = fmtCurrency(val);
                            else if (intKeys.test(c)) txt = fmtInt(val);
                            else txt = String(val);
                        }
                        if (mergeProperty && c === "property") {
                            const id = r["property_id"] ?? "";
                            const name = r["property_name"] ?? "";
                            const display = `<div style="display:flex; flex-direction:column;"><span style="font-weight:700;">${id}</span><span style="font-size:12px; color:#64748b;">${name}</span></div>`;
                            return `<td style="padding:8px 10px; border-bottom:1px solid #f1f5f9;">${display}</td>`;
                        }
                        return `<td style="padding:8px 10px; border-bottom:1px solid #f1f5f9;">${txt}</td>`;
                    })
                    .join("")}</tr>`
        )
        .join("");

    return `<table style="width:100%; border-collapse:collapse;">${thead}<tbody>${rows}</tbody></table>`;
}

function getActiveTab() {
    const btn = document.querySelector(".reports-tabs .tab-btn.active");
    return btn ? btn.getAttribute("data-tab") : "financial";
}
function getFilters() {
    const from = document.getElementById("fromDate")?.value || "";
    const to = document.getElementById("toDate")?.value || "";
    const propertyId = document.getElementById("propertySelect")?.value || "";
    const tenantId = document.getElementById("tenantSelect")?.value || "";
    const groupBy = document.getElementById("groupBy")?.value || "month";
    return { from, to, propertyId, tenantId, groupBy };
}

async function loadPropertiesTenants() {
    try {
        const [props, tenants] = await Promise.all([
            getProperties(1000, ""),
            getTenants(1000, ""),
        ]);
        const propSel = document.getElementById("propertySelect");
        const tenSel = document.getElementById("tenantSelect");
        if (propSel) {
            const cur = propSel.value;
            propSel.innerHTML =
                `<option value="">All</option>` +
                (props.list || [])
                    .map(
                        (p) =>
                            `<option value="${p.property_id}">${p.property_name || `Property ${p.property_id}`
                            }</option>`
                    )
                    .join("");
            if (cur) propSel.value = cur;
        }
        if (tenSel) {
            const cur = tenSel.value;
            tenSel.innerHTML =
                `<option value="">All</option>` +
                (tenants.list || [])
                    .map(
                        (t) =>
                            `<option value="${t.user_id}">${(t.first_name || "") + " " + (t.last_name || "")
                            }</option>`
                    )
                    .join("");
            if (cur) tenSel.value = cur;
        }
    } catch (e) {
        console.warn("Failed to load properties/tenants", e);
    }
}

async function loadFinancial() {
    try {
        const { from, to, propertyId, tenantId, groupBy } = getFilters();
        const data = await API.financial({
            from,
            to,
            propertyId,
            tenantId,
            groupBy,
        });
        set(
            "financialCollected",
            tableFrom(data.totalCollectedByPeriod || [], ["period", "total"])
        );
        setText("financialOutstanding", fmtCurrency(data.outstandingBalances || 0));

        try {
            const depEl = document.getElementById("financialDeposits");
            if (depEl) {
                const container =
                    depEl.closest(".card") ||
                    depEl.closest(".report-section") ||
                    depEl.parentElement;
                if (container) container.style.display = "none";
                else depEl.style.display = "none";
                depEl.innerHTML = "";
            }
        } catch { }
        set(
            "financialRevPerProperty",
            tableFrom(data.revenuePerProperty || [], [
                "property_id",
                "property_name",
                "total",
            ])
        );
        const r = data.recurringVsOneTime || { recurring: 0, oneTime: 0 };
        set(
            "financialRecurring",
            tableFrom(
                [{ recurring: r.recurring, one_time: r.oneTime }],
                ["recurring", "one_time"]
            )
        );
    } catch (e) {
        try {
            window.showAlert &&
                window.showAlert(
                    `Failed to load Financial report: ${e.message || e}`,
                    "error"
                );
        } catch { }
    }
}

async function loadTenants() {
    try {
        const { from, to, propertyId } = getFilters();
        const data = await API.tenants({ from, to, propertyId });
        const ai = data.activeVsInactive || { active: 0, inactive: 0 };
        set(
            "tenantActiveInactive",
            tableFrom(
                [{ active: ai.active, inactive: ai.inactive }],
                ["active", "inactive"]
            )
        );
        setText("tenantOverdue", fmtInt(data.tenantsWithOverdue || 0));
        setText("tenantAvgTenure", fmtInt(data.averageTenureMonths || 0));
        setText("tenantUpcomingExp", fmtInt(data.upcomingLeaseExpirations || 0));
        const late = await fetchLatePaymentsData({ from, to, propertyId });
        set(
            "tenantLatePayments",
            tableFrom(late, ["tenant", "daysLate", "amount"])
        );
    } catch (e) {
        try {
            window.showAlert &&
                window.showAlert(
                    `Failed to load Tenant report: ${e.message || e}`,
                    "error"
                );
        } catch { }
    }
}

async function loadProperties() {
    try {
        const { from, to } = getFilters();
        const data = await API.properties({ from, to });
        set(
            "propOccupancy",
            tableFrom(data.occupancyPerProperty || [], [
                "property_id",
                "property_name",
                "activeLeases",
                "totalLeases",
            ])
        );
        set(
            "propAvgRent",
            tableFrom(data.averageRentPerProperty || [], [
                "property_id",
                "property_name",
                "avgRent",
            ])
        );
        const rt = data.renewalsVsTerminations || { renewals: 0, terminations: 0 };
        set(
            "propRenewTerm",
            tableFrom(
                [{ renewals: rt.renewals, terminations: rt.terminations }],
                ["renewals", "terminations"]
            )
        );
        setText("propActiveLeases", fmtInt(data.totalActiveLeases || 0));
        setText("propUpcomingVac", fmtInt(data.upcomingVacancies || 0));
    } catch (e) {
        try {
            window.showAlert &&
                window.showAlert(
                    `Failed to load Property & Lease report: ${e.message || e}`,
                    "error"
                );
        } catch { }
    }
}

async function loadMaintenance() {
    try {
        const { from, to, propertyId } = getFilters();
        const data = await API.maintenance({ from, to, propertyId });
        set(
            "maintByMonth",
            tableFrom(data.ticketsByMonth || [], ["period", "total"])
        );
        set(
            "maintByStatus",
            tableFrom(data.ticketsByStatus || [], ["status", "total"])
        );
        setText(
            "maintAvgRes",
            fmtInt(Math.round(Number(data.averageResolutionHours || 0)))
        );
        set("maintCommon", tableFrom(data.commonIssues || [], ["type", "total"]));
        const r = data.ratings || { count: 0, average: 0 };
        set(
            "maintRatings",
            tableFrom([{ count: r.count, average: r.average }], ["count", "average"])
        );
    } catch (e) {
        try {
            window.showAlert &&
                window.showAlert(
                    `Failed to load Maintenance report: ${e.message || e}`,
                    "error"
                );
        } catch { }
    }
}

function showTab(tab) {
    document
        .querySelectorAll(".reports-tabs .tab-btn")
        .forEach((b) =>
            b.classList.toggle("active", b.getAttribute("data-tab") === tab)
        );
    document
        .querySelectorAll(".tab-content")
        .forEach((c) => (c.style.display = "none"));
    document.getElementById(`tab-${tab}`).style.display = "block";
    document.getElementById("tenantFilterGroup").style.display =
        tab === "financial" ? "" : "none";
    document.getElementById("groupByGroup").style.display =
        tab === "financial" ? "" : "none";
}

async function applyFilters() {
    const tab = getActiveTab();
    try {
        if (tab === "financial") return await loadFinancial();
        if (tab === "tenants") return await loadTenants();
        if (tab === "properties") return await loadProperties();
        if (tab === "maintenance") return await loadMaintenance();
    } catch (e) {
        try {
            window.showAlert &&
                window.showAlert(
                    `Failed to load ${tab} report: ${e.message || e}`,
                    "error"
                );
        } catch { }
    }
}

function exportCsvAll() {
    return exportCsv({});
}

function bindEvents() {
    document.querySelectorAll(".reports-tabs .tab-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            showTab(btn.getAttribute("data-tab"));
            await applyFilters();
        });
    });
    document
        .getElementById("applyFiltersBtn")
        ?.addEventListener("click", applyFilters);
    document
        .getElementById("exportCsvBtn")
        ?.addEventListener("click", openExportDialog);
}

function initDefaultDates() {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    const f = document.getElementById("fromDate");
    const t = document.getElementById("toDate");
    if (f)
        f.value = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(
            2,
            "0"
        )}-${String(from.getDate()).padStart(2, "0")}`;
    if (t)
        t.value = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(
            2,
            "0"
        )}-${String(to.getDate()).padStart(2, "0")}`;
}

async function boot() {
    initDefaultDates();
    bindEvents();
    await loadPropertiesTenants();
    showTab("financial");
    try {
        await applyFilters();
    } catch (e) {
        try {
            window.showAlert &&
                window.showAlert(`Failed to load reports: ${e.message || e}`, "error");
        } catch { }
    }
}

if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
else boot();

function openExportDialog() {
    try {
        const { from, to } = getFilters();
        const bodyHtml = `
            <div style="display:flex; flex-direction:column; gap:14px;">
              <div>
                <div style="font-weight:700; margin-bottom:6px;">Select categories</div>
                <div style="display:flex; gap:16px; flex-wrap:wrap;">
                  <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="expCatFinancial" checked> Financial</label>
                  <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="expCatTenants" checked> Tenants</label>
                  <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="expCatProperties" checked> Property & Lease</label>
                  <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="expCatMaintenance" checked> Maintenance</label>
                </div>
              </div>
              <div style="display:flex; gap:16px; flex-wrap:wrap;">
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label for="expFrom">From</label>
                  <input type="date" id="expFrom" value="${from}">
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <label for="expTo">To</label>
                  <input type="date" id="expTo" value="${to}">
                </div>
              </div>
              <div>
                <div style="font-weight:700; margin-bottom:6px;">Format</div>
                <div style="display:flex; gap:16px;">
                  <label style="display:flex; align-items:center; gap:6px;"><input type="radio" name="expFormat" value="csv" checked> CSV</label>
                  <label style="display:flex; align-items:center; gap:6px;"><input type="radio" name="expFormat" value="pdf"> PDF</label>
                </div>
              </div>
            </div>
        `;

        if (
            typeof Modal !== "undefined" &&
            Modal &&
            typeof Modal.open === "function"
        ) {
            Modal.open({
                title: "Export Reports",
                body: bodyHtml,
                showFooter: true,
                showCancel: true,
                confirmText: "Export",
                cancelText: "Cancel",
                onConfirm: async function () {
                    const cats = {
                        financial: !!document.getElementById("expCatFinancial")?.checked,
                        tenants: !!document.getElementById("expCatTenants")?.checked,
                        properties: !!document.getElementById("expCatProperties")?.checked,
                        maintenance:
                            !!document.getElementById("expCatMaintenance")?.checked,
                    };
                    const from = document.getElementById("expFrom")?.value || "";
                    const to = document.getElementById("expTo")?.value || "";
                    const fmt =
                        document.querySelector('input[name="expFormat"]:checked')?.value ||
                        "csv";
                    if (
                        !cats.financial &&
                        !cats.tenants &&
                        !cats.properties &&
                        !cats.maintenance
                    ) {
                        try {
                            window.showAlert &&
                                window.showAlert(
                                    "Please select at least one category",
                                    "error"
                                );
                        } catch { }
                        return;
                    }
                    try {
                        if (fmt === "pdf") await exportPdf({ from, to, cats });
                        else await exportCsv({ from, to, cats });
                        Modal.close && Modal.close();
                    } catch (e) {
                        try {
                            window.showAlert &&
                                window.showAlert(`Export failed: ${e.message || e}`, "error");
                        } catch { }
                    }
                },
            });
        } else {
            const fmt = confirm("OK = PDF, Cancel = CSV") ? "pdf" : "csv";
            exportCsv({
                from,
                to,
                cats: {
                    financial: true,
                    tenants: true,
                    properties: true,
                    maintenance: true,
                },
            }).catch(() => { });
        }
    } catch (e) {
        try {
            window.showAlert &&
                window.showAlert("Failed to open export dialog", "error");
        } catch { }
    }
}

async function exportCsv(opts = {}) {
    const baseFilters = getFilters();
    const from = opts.from || baseFilters.from;
    const to = opts.to || baseFilters.to;
    const cats = Object.assign(
        { financial: true, tenants: true, properties: true, maintenance: true },
        opts.cats || {}
    );

    return (async () => {
        const filters = { ...baseFilters, from, to };
        const promises = [];
        if (cats.financial) promises.push(API.financial(filters));
        else promises.push(Promise.resolve(null));
        if (cats.tenants) promises.push(API.tenants(filters));
        else promises.push(Promise.resolve(null));
        if (cats.properties) promises.push(API.properties(filters));
        else promises.push(Promise.resolve(null));
        if (cats.maintenance) promises.push(API.maintenance(filters));
        else promises.push(Promise.resolve(null));
        const [financial, tenants, properties, maintenance] = await Promise.all(
            promises
        );

        const currencyKeys =
            /amount|price|rent|paid|outstanding|balance|fee|total_amount|total_paid|total/i;
        const escapeCell = (v, key) => {
            if (v === null || v === undefined) return "";
            if (typeof v === "object")
                return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
            const num = Number(v);
            if (
                v !== "" &&
                !isNaN(num) &&
                !currencyKeys.test(key) &&
                !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(v))
            )
                return String(num);
            if (currencyKeys.test(key) && !isNaN(num))
                return String(Number(num).toFixed(2));
            return `"${String(v).replace(/"/g, '""')}"`;
        };
        const unionHeaders = (rows) => {
            const seen = new Set();
            const headers = [];
            for (const r of rows) {
                Object.keys(r || {}).forEach((k) => {
                    if (!seen.has(k)) {
                        seen.add(k);
                        headers.push(k);
                    }
                });
            }
            return headers;
        };
        const arrayToCsv = (rows) => {
            if (!Array.isArray(rows) || rows.length === 0) return "";
            const headers = unionHeaders(rows);
            const lines = [];
            lines.push(headers.map((h) => `"${h}"`).join(","));
            for (const r of rows) {
                const line = headers
                    .map((h) => escapeCell(r && h in r ? r[h] : "", h))
                    .join(",");
                lines.push(line);
            }
            return lines.join("\n");
        };
        const objectToKeyValueCsv = (obj) => {
            if (!obj || typeof obj !== "object") return "";
            const lines = [];
            lines.push("Key,Value");
            for (const k of Object.keys(obj)) {
                const v = obj[k];
                lines.push([`"${k}"`, escapeCell(v, k)].join(","));
            }
            return lines.join("\n");
        };

        const parts = [];
        const now = new Date();
        parts.push(`"Report Export","${now.toISOString()}"`);
        parts.push("");
        parts.push('"Filters"');
        parts.push("Key,Value");
        for (const [k, v] of Object.entries({
            from,
            to,
            propertyId: baseFilters.propertyId,
            tenantId: baseFilters.tenantId,
            groupBy: baseFilters.groupBy,
        }))
            parts.push([`"${k}"`, escapeCell(v, k)].join(","));
        parts.push("");

        const pushSection = (title, data) => {
            if (!data) return;
            parts.push("");
            parts.push(`"${title.toUpperCase()}"`);
            parts.push("");
            if (Array.isArray(data)) {
                parts.push(arrayToCsv(data) || "(No data)");
                parts.push("");
                return;
            }
            for (const key of Object.keys(data)) {
                const val = data[key];
                parts.push(`"${key}"`);
                if (Array.isArray(val)) parts.push(arrayToCsv(val) || "(No data)");
                else if (val && typeof val === "object")
                    parts.push(objectToKeyValueCsv(val));
                else parts.push([`"value"`, escapeCell(val, key)].join(","));
                parts.push("");
            }
        };

        if (cats.financial)
            pushSection(
                "Financial",
                financial
                    ? {
                        ...financial,
                        depositsSummary: undefined,
                        securityDeposits: undefined,
                        advanceDeposits: undefined,
                    }
                    : null
            );
        if (cats.tenants) {
            pushSection("Tenants", tenants);
            const late = await fetchLatePaymentsData({
                from,
                to,
                propertyId: baseFilters.propertyId,
            });
            parts.push('"TenantsLatePayments"');
            parts.push(arrayToCsv(late) || "(No data)");
            parts.push("");
        }
        if (cats.properties) pushSection("Properties", properties);
        if (cats.maintenance) pushSection("Maintenance", maintenance);

        const csv = "\uFEFF" + parts.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const fname = `reports_export_${now.getFullYear()}-${String(
            now.getMonth() + 1
        ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.csv`;
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    })();
}

async function exportPdf(opts = {}) {
    const baseFilters = getFilters();
    const from = opts.from || baseFilters.from;
    const to = opts.to || baseFilters.to;
    const cats = Object.assign(
        { financial: true, tenants: true, properties: true, maintenance: true },
        opts.cats || {}
    );

    const filters = { ...baseFilters, from, to };
    const [company, fin, ten, prop, maint] = await Promise.all([
        fetchCompanyDetails().catch(() => null),
        cats.financial ? API.financial(filters) : Promise.resolve(null),
        cats.tenants ? API.tenants(filters) : Promise.resolve(null),
        cats.properties ? API.properties(filters) : Promise.resolve(null),
        cats.maintenance ? API.maintenance(filters) : Promise.resolve(null),
    ]);

    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || !window.jspdf) throw new Error("PDF library not loaded");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const totalPagesExp = "{total_pages_count_string}";

    const margin = 36;
    const footerMargin = 28;
    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorY = margin;

    function formatFormalDate(dStr) {
        if (!dStr) return "";
        const d = new Date(dStr);
        if (isNaN(+d)) return dStr;
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }
    function formatRange(fromStr, toStr) {
        if (fromStr && toStr)
            return `${formatFormalDate(fromStr)} – ${formatFormalDate(toStr)}`;
        if (toStr && !fromStr) return `As of ${formatFormalDate(toStr)}`;
        if (fromStr && !toStr) return `From ${formatFormalDate(fromStr)}`;
        return "All Dates";
    }
    async function fetchImageAsDataUrl(url) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) return null;
            const blob = await res.blob();
            return await new Promise((resolve) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.readAsDataURL(blob);
            });
        } catch {
            return null;
        }
    }

    const title =
        company && company.company_name
            ? `${company.company_name} — Reports`
            : "Reports";
    let logoUrl =
        (company &&
            (company.logo_url || company.company_logo || company.logoUrl)) ||
        "/assets/logo-property.png";
    let logoDataUrl = null;
    try {
        logoDataUrl = await fetchImageAsDataUrl(logoUrl);
    } catch { }
    const headerTop = cursorY;
    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, "PNG", margin, headerTop - 2, 28, 28);
        } catch { }
    }
    const textX = logoDataUrl ? margin + 36 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, textX, headerTop + 8);
    const exportedStr = `Exported on ${new Date().toLocaleString()}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(exportedStr, pageWidth - margin, headerTop + 8, { align: "right" });
    const rangeStr = `Date Range: ${formatRange(from, to)}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(rangeStr, textX, headerTop + 26);
    cursorY = headerTop + 34;
    doc.setDrawColor(210);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 14;

    function contentBottom() {
        return doc.internal.pageSize.getHeight() - footerMargin;
    }
    function ensureSpace(h = 24) {
        if (cursorY + h > contentBottom()) {
            doc.addPage();
            cursorY = margin;
        }
    }
    function addSectionHeader(text) {
        ensureSpace(30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(text, margin, cursorY);
        cursorY += 8;
        doc.setDrawColor(240);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 8;
    }
    function addCategoryDivider(title) {
        ensureSpace(36);
        if (cursorY > margin + 20) cursorY += 8;
        doc.setDrawColor(180);
        doc.setLineWidth(1);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 14;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(title, margin, cursorY);
        cursorY += 10;
        doc.setDrawColor(235);
        doc.setLineWidth(0.5);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 12;
    }

    function autoTab(title, rows, headers) {
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            addSectionHeader(title);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text("No data", margin, cursorY);
            cursorY += 18;
            return;
        }
        addSectionHeader(title);
        const labels = headers.map((h) => niceHeaderLabel(h));
        const body = rows.map((r) => headers.map((h) => r[h] ?? ""));
        ensureSpace(40);
        doc.autoTable({
            head: [labels],
            body,
            startY: cursorY,
            theme: "striped",
            headStyles: { fillColor: [14, 165, 233], textColor: 255, halign: "left" },
            styles: { fontSize: 9, cellPadding: 6 },
            margin: { left: margin, right: margin, bottom: footerMargin + 6 },
        });
        cursorY = doc.lastAutoTable.finalY + 28;
        if (cursorY > contentBottom() - 72) {
            doc.addPage();
            cursorY = margin;
        }
    }

    function autoKpi(label, value) {
        ensureSpace(26);
        doc.autoTable({
            head: [[label, String(value)]],
            body: [],
            startY: cursorY,
            theme: "plain",
            styles: { fontSize: 11, cellPadding: 6 },
            headStyles: { fillColor: [245, 245, 245], textColor: 20, halign: "left" },
            margin: { left: margin, right: margin, bottom: footerMargin },
        });
        cursorY = doc.lastAutoTable.finalY + 20;
    }

    if (cats.financial && fin) {
        addCategoryDivider("Financial");
        autoTab("Total Collected by Period", fin.totalCollectedByPeriod || [], [
            "period",
            "total",
        ]);
        const totalOutstanding =
            fin.outstandingBalances != null
                ? `PHP ${Number(fin.outstandingBalances || 0).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}`
                : "—";
        autoKpi("Outstanding Tenant Balances", totalOutstanding);
        autoTab("Revenue per Property", fin.revenuePerProperty || [], [
            "property_id",
            "property_name",
            "total",
        ]);
        const rv = fin.recurringVsOneTime || { recurring: 0, oneTime: 0 };
        autoTab(
            "Recurring vs One-time",
            [{ recurring: rv.recurring, one_time: rv.oneTime }],
            ["recurring", "one_time"]
        );
    }

    if (cats.tenants && ten) {
        addCategoryDivider("Tenants");
        const ai = ten.activeVsInactive || { active: 0, inactive: 0 };
        autoTab(
            "Active vs Inactive",
            [{ active: ai.active, inactive: ai.inactive }],
            ["active", "inactive"]
        );
        const late = await fetchLatePaymentsData({
            from,
            to,
            propertyId: baseFilters.propertyId,
        });
        autoTab("Late Payments", late || [], ["tenant", "daysLate", "amount"]);
        addSectionHeader("KPIs");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        const kpi = [
            `Tenants with Overdue: ${Number(
                ten.tenantsWithOverdue || 0
            ).toLocaleString("en-US")}`,
            `Average Tenure (months): ${Number(
                ten.averageTenureMonths || 0
            ).toLocaleString("en-US")}`,
            `Upcoming Lease Expirations: ${Number(
                ten.upcomingLeaseExpirations || 0
            ).toLocaleString("en-US")}`,
        ];
        kpi.forEach((line) => {
            ensureSpace(18);
            doc.text(line, margin, cursorY);
            cursorY += 16;
        });
    }

    if (cats.properties && prop) {
        addCategoryDivider("Properties");
        autoTab("Occupancy per Property", prop.occupancyPerProperty || [], [
            "property_id",
            "property_name",
            "activeLeases",
            "totalLeases",
        ]);
        autoTab("Average Rent per Property", prop.averageRentPerProperty || [], [
            "property_id",
            "property_name",
            "avgRent",
        ]);
        const rt = prop.renewalsVsTerminations || { renewals: 0, terminations: 0 };
        autoTab(
            "Renewals vs Terminations",
            [{ renewals: rt.renewals, terminations: rt.terminations }],
            ["renewals", "terminations"]
        );
        addSectionHeader("KPIs");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        const kp = [
            `Total Active Leases: ${Number(
                prop.totalActiveLeases || 0
            ).toLocaleString("en-US")}`,
            `Upcoming Vacancies: ${Number(prop.upcomingVacancies || 0).toLocaleString(
                "en-US"
            )}`,
        ];
        kp.forEach((line) => {
            ensureSpace(18);
            doc.text(line, margin, cursorY);
            cursorY += 16;
        });
    }

    if (cats.maintenance && maint) {
        addCategoryDivider("Maintenance");
        autoTab("Tickets by Month", maint.ticketsByMonth || [], [
            "period",
            "total",
        ]);
        autoTab("Tickets by Status", maint.ticketsByStatus || [], [
            "status",
            "total",
        ]);
        addSectionHeader("KPIs");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        const mk = [
            `Average Resolution (hrs): ${Math.round(
                Number(maint.averageResolutionHours || 0)
            ).toLocaleString("en-US")}`,
        ];
        mk.forEach((line) => {
            ensureSpace(18);
            doc.text(line, margin, cursorY);
            cursorY += 16;
        });
        autoTab("Common Issues", maint.commonIssues || [], ["type", "total"]);
        const r = maint.ratings || { count: 0, average: 0 };
        autoTab(
            "Ratings",
            [{ count: r.count, average: r.average }],
            ["count", "average"]
        );
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        const str = `Page ${i} of ${pageCount}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(str, w - margin, h - 10, { align: "right" });
    }
    if (typeof doc.putTotalPages === "function") {
        try {
            doc.putTotalPages(totalPagesExp);
        } catch { }
    }
    const fname = `reports_${new Date().getFullYear()}-${String(
        new Date().getMonth() + 1
    ).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}.pdf`;
    doc.save(fname);
}
