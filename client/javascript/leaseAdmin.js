import formatDate from "../utils/formatDate.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

const API_BASE_URL = "/api/v1/leases";

window.currentEditingLeaseId = null;
let deleteLeaseId = null;

function loadModalHelpersIfNeeded() {
  return new Promise((resolve) => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.showAlert === "function"
      ) {
        return resolve(true);
      }

      var existing = document.querySelector("script[data-modalhelpers]");
      if (existing) {
        existing.addEventListener("load", function () {
          return resolve(true);
        });
        existing.addEventListener("error", function () {
          defineFallback();
          return resolve(false);
        });
        return;
      }

      var scriptSrc = "/javascript/utils/modalHelpers.js";
      var s = document.createElement("script");
      s.src = scriptSrc;
      s.async = true;
      s.setAttribute("data-modalhelpers", "1");
      s.onload = function () {
        return resolve(true);
      };
      s.onerror = function () {
        defineFallback();
        return resolve(false);
      };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      defineFallback();
      return resolve(false);
    }

    function defineFallback() {
      try {
        if (typeof window.showAlert !== "function")
          window.showAlert = function (msg, type) {
            console.warn("showAlert fallback:", type, msg);
            alert(String(msg));
          };
        if (typeof window.showConfirm !== "function")
          window.showConfirm = function (msg) {
            return Promise.resolve(confirm(String(msg)));
          };
        if (typeof window.showPrompt !== "function")
          window.showPrompt = function (msg, placeholder) {
            return Promise.resolve(
              prompt(String(msg), String(placeholder || ""))
            );
          };
      } catch (e) {
        /* noop */
      }
    }
  });
}

loadModalHelpersIfNeeded().then(function (ok) {
  if (ok) console.debug("ModalHelpers available");
  else console.debug("ModalHelpers fallback in use");
});

async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `Manage Leases - ${company.company_name}`
    : "Manage Leases";
}

document.addEventListener("DOMContentLoaded", () => {
  setDynamicInfo();
});

function setStatsBar({ total, active, pending, terminated }) {
  const set = (stat, val) => {
    const el = document.querySelector('.stat-value[data-stat="' + stat + '"]');
    if (el) el.textContent = val;
  };
  set("total", total);
  set("active", active);
  set("pending", pending);
  set("terminated", terminated);
  if (arguments[0].expiring !== undefined)
    set("expiring", arguments[0].expiring);
  if (arguments[0].vacant !== undefined) set("vacant", arguments[0].vacant);
  if (arguments[0].avgduration !== undefined)
    set("avgduration", arguments[0].avgduration);
}

async function updateStatsBar() {
  try {
    let leases = getSessionCache("leases");
    if (!leases) {
      const leaseRes = await fetch("/api/v1/leases");
      if (!leaseRes.ok) throw new Error("Failed to fetch leases");
      const leaseData = await leaseRes.json();
      leases = leaseData.leases || [];
      setSessionCache("leases", leases);
    }

    let properties = getSessionCache("properties");
    if (!properties) {
      const propRes = await fetch("/api/v1/properties?status=Available&limit=1000");
      if (propRes.ok) {
        const propData = await propRes.json();
        properties = propData.properties || [];
        setSessionCache("properties", properties);
      } else {
        properties = [];
      }
    }

    let vacant = "-";
    try {
      const leasedPropertyIds = leases
        .filter((lease) => ["ACTIVE", "PENDING"].includes((lease.lease_status || "").toUpperCase()))
        .map((lease) => lease.property_id);
      const trulyVacant = properties.filter((prop) => !leasedPropertyIds.includes(prop.property_id));
      vacant = trulyVacant.length;
    } catch { }

    let total = leases.length;
    let active = 0, pending = 0, terminated = 0;
    let expiring = 0;
    let totalDuration = 0;
    const now = new Date();
    leases.forEach((lease) => {
      const status = (lease.lease_status || "").toLowerCase();
      if (status === "active") active++;
      else if (status === "pending") pending++;
      else if (status === "terminated") terminated++;

      if (lease.lease_end_date) {
        const endDate = new Date(lease.lease_end_date);
        const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 30) expiring++;
        if (lease.lease_start_date) {
          const startDate = new Date(lease.lease_start_date);
            const durationMonths = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30));
          totalDuration += durationMonths;
        }
      }
    });
    const avgduration = total > 0 ? Math.round(totalDuration / total) : "-";

    setStatsBar({ total, active, pending, terminated, expiring, vacant, avgduration });
  } catch (err) {
    setStatsBar({ total: "-", active: "-", pending: "-", terminated: "-", expiring: "-", vacant: "-", avgduration: "-" });
    console.error("Stats bar error:", err);
  }
}

document.addEventListener("DOMContentLoaded", updateStatsBar);

//#region Populate Fields

async function populateTenantDropdown() {
  const tenantSelect = document.getElementById("tenantId");
  tenantSelect.innerHTML = '<option value="">Select a tenant</option>';

  try {
    let tenants = getSessionCache("tenants");
    if (!tenants) {
      const res = await fetch("/api/v1/users?role=TENANT");
      const data = await res.json();
      tenants = data.users || [];
      setSessionCache("tenants", tenants);
    }
    tenants.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.user_id;
      option.textContent = `${user.first_name} ${user.last_name} (${user.email})`;
      tenantSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Failed to load tenants:", error);
  }
}

async function populatePropertyDropdown() {
  const propertySelect = document.getElementById("propertyId");
  propertySelect.innerHTML = '<option value="">Select a property</option>';

  try {
    let properties = getSessionCache("properties");
    if (!properties) {
      const res = await fetch("/api/v1/properties?status=Available&limit=1000");
      const data = await res.json();
      properties = data.properties || [];
      setSessionCache("properties", properties);
    }

    let leases = getSessionCache("leases");
    if (!leases) {
      const leaseRes = await fetch("/api/v1/leases");
      const leaseData = await leaseRes.json();
      leases = leaseData.leases || [];
      setSessionCache("leases", leases);
    }

    const leasedPropertyIds = leases
      .filter((lease) =>
        ["ACTIVE", "PENDING"].includes((lease.lease_status || "").toUpperCase())
      )
      .map((lease) => lease.property_id);

    properties = properties.filter(
      (prop) => !leasedPropertyIds.includes(prop.property_id)
    );

    properties.forEach((prop) => {
      const option = document.createElement("option");
      option.value = prop.property_id;
      option.textContent = `${prop.property_name} - ${prop.city || prop.building_name || ""
        }`;
      propertySelect.appendChild(option);
    });
  } catch (error) {
    console.error("Failed to load properties:", error);
  }
}

async function populateFinancialDefaults() {
  try {
    const res = await fetch("/api/v1/lease-defaults");
    const data = await res.json();
    const defaults = data.defaults || {};

    const getVal = (key, fallback = "") => {
      return defaults[key] && defaults[key].value !== undefined
        ? defaults[key].value
        : fallback;
    };

    const setDefault = (id, value) => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = value;
    };

    setDefault("paymentFrequency", getVal("payment_frequency", "Monthly"));
    setDefault("quarterlyTax", getVal("quarterly_tax_percentage", ""));
    setDefault("securityDeposit", getVal("security_deposit_months", ""));
    setDefault("advancePayment", getVal("advance_payment_months", ""));
    setDefault("lateFee", getVal("late_fee_percentage", ""));
    setDefault("gracePeriod", getVal("grace_period_days", ""));

    setDefault(
      "autoTerminationMonths",
      getVal("auto_termination_after_months", "")
    );
    setDefault(
      "terminationTriggerDays",
      getVal("termination_trigger_days", "")
    );
    setDefault("noticeCancelDays", getVal("notice_before_cancel_days", ""));
    setDefault("noticeRenewalDays", getVal("notice_before_renewal_days", ""));
    setDefault(
      "rentIncreaseRenewal",
      getVal("rent_increase_on_renewal_percentage", "")
    );
    document.getElementById("isSecurityRefundable").checked =
      getVal("is_security_deposit_refundable", "0") === "1";
    document.getElementById("advanceForfeited").checked =
      getVal("advance_payment_forfeited_on_cancel", "0") === "1";
  } catch (error) {
    console.error("Failed to load lease defaults:", error);
  }
}

document
  .getElementById("keepDefaultsFinancial")
  .addEventListener("change", function () {
    const disabled = this.checked;
    const fields = [
      "paymentFrequency",
      "quarterlyTax",
      "securityDeposit",
      "advancePayment",
      "lateFee",
      "gracePeriod",
    ];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = disabled;
        if (disabled) {
          el.classList.add("field-disabled");
        } else {
          el.classList.remove("field-disabled");
        }
      }
    });
  });

function setFinancialFieldsDisabled() {
  const disabled = document.getElementById("keepDefaultsFinancial").checked;
  [
    "paymentFrequency",
    "quarterlyTax",
    "securityDeposit",
    "advancePayment",
    "lateFee",
    "gracePeriod",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = disabled;
      if (disabled) {
        el.classList.add("field-disabled");
      } else {
        el.classList.remove("field-disabled");
      }
    }
  });
}

document
  .getElementById("keepDefaultsRules")
  .addEventListener("change", function () {
    const disabled = this.checked;
    const fields = [
      "isSecurityRefundable",
      "advanceForfeited",
      "autoTerminationMonths",
      "terminationTriggerDays",
      "noticeCancelDays",
      "noticeRenewalDays",
      "rentIncreaseRenewal",
    ];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = disabled;
        if (disabled) {
          el.classList.add("field-disabled");
        } else {
          el.classList.remove("field-disabled");
        }
      }
    });
  });

function setRulesFieldsDisabled() {
  const disabled = document.getElementById("keepDefaultsRules").checked;
  [
    "isSecurityRefundable",
    "advanceForfeited",
    "autoTerminationMonths",
    "terminationTriggerDays",
    "noticeCancelDays",
    "noticeRenewalDays",
    "rentIncreaseRenewal",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = disabled;
      if (disabled) {
        el.classList.add("field-disabled");
      } else {
        el.classList.remove("field-disabled");
      }
    }
  });
}
document.addEventListener("DOMContentLoaded", setRulesFieldsDisabled);
document.addEventListener("DOMContentLoaded", setFinancialFieldsDisabled);

//#endregion

function showListView() {
  document.getElementById("listView").classList.remove("hidden");
  document.getElementById("formView").classList.add("hidden");
  document.getElementById("detailView").classList.add("hidden");

  window.currentEditingLeaseId = null;
  loadLeaseTable();
}

function showCreateView() {
  document.getElementById("listView").classList.add("hidden");
  document.getElementById("formView").classList.remove("hidden");
  document.getElementById("detailView").classList.add("hidden");

  window.currentEditingLeaseId = null;
  clearForm();
  clearErrors();
  populateTenantDropdown();
  populatePropertyDropdown();
  populateFinancialDefaults();
  try {
    updateInitialChargesNotice && updateInitialChargesNotice();
    attachInitialChargesNoticeListeners &&
      attachInitialChargesNoticeListeners();
  } catch (e) {
    /* noop */
  }

  const titleEl = document.getElementById("formTitle");
  if (titleEl) titleEl.textContent = "Create Lease";
}

function showAccordionSection(sectionId) {
  document
    .querySelectorAll("#leaseFormAccordion .accordion-collapse")
    .forEach((el) => {
      el.classList.remove("show");
    });

  const section = document.getElementById(sectionId);
  if (section) section.classList.add("show");
}

document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("fileInput")
    .addEventListener("change", handleFileSelection);
  showListView();
});

function parseYMD(ymd) {
  if (!ymd || typeof ymd !== "string" || !/\d{4}-\d{2}-\d{2}/.test(ymd))
    return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function addMonthsClamped(date, months) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const firstOfTarget = new Date(y, m + months, 1);
  const lastDay = new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth() + 1,
    0
  ).getDate();
  return new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth(),
    Math.min(d, lastDay)
  );
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthsBetween(start, end) {
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function ensureEndDateHintElement() {
  const endDateEl = document.getElementById("endDate");
  if (!endDateEl || !endDateEl.parentNode) return null;
  let hint = document.getElementById("endDateHint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "endDateHint";
    hint.style.fontSize = "12px";
    hint.style.color = "#6b7280";
    hint.style.marginTop = "6px";
    endDateEl.insertAdjacentElement("afterend", hint);
  }
  return hint;
}

function updateEndDateHint() {
  try {
    const startEl = document.getElementById("startDate");
    const endEl = document.getElementById("endDate");
    if (!startEl || !endEl) return;
    const hint = ensureEndDateHintElement();
    if (!hint) return;

    const s = parseYMD(startEl.value);
    const e = parseYMD(endEl.value);
    if (!s || !e) {
      hint.textContent = "";
      return;
    }
    if (e <= s) {
      hint.textContent = "End date must be after start date";
      return;
    }
    const months = monthsBetween(s, e);
    if (months <= 0) {
      hint.textContent = "Less than 1 month";
    } else if (months === 1) {
      hint.textContent = "1 month from start date";
    } else {
      hint.textContent = `${months} months from start date`;
    }
  } catch (e) {
    /* noop */
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");

  if (startDateEl) {
    try {
      startDateEl.removeAttribute("min");
    } catch (e) {
      /* noop */
    }
  }

  if (startDateEl && endDateEl) {
    startDateEl.addEventListener("change", function () {
      const start = parseYMD(startDateEl.value);
      if (!start) return;
      const end = addMonthsClamped(start, 24);
      endDateEl.value = formatYMD(end);
      updateEndDateHint();
    });

    endDateEl.addEventListener("change", function () {
      updateEndDateHint();
    });

    updateEndDateHint();
  }
});

function validateForm() {
  let isValid = true;
  clearErrors();

  const requiredFields = [
    { id: "tenantId", message: "Please select a tenant" },
    { id: "propertyId", message: "Please select a property" },
    { id: "startDate", message: "Please enter a start date" },
    { id: "endDate", message: "Please enter an end date" },
    { id: "monthlyRent", message: "Please enter monthly rent amount" },
  ];

  requiredFields.forEach((field) => {
    const element = document.getElementById(field.id);
    const value = element.value.trim();

    if (!value) {
      showError(field.id, field.message);
      isValid = false;
    }
  });

  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const startDate = new Date(startDateEl.value);
  const endDate = new Date(endDateEl.value);

  if (startDateEl.value && endDateEl.value) {
    if (startDate >= endDate) {
      showError("endDate", "End date must be after start date");
      isValid = false;
    }
  }

  const monthlyRentEl = document.getElementById("monthlyRent");
  const monthlyRent = parseFloat(monthlyRentEl.value);
  if (monthlyRentEl.value) {
    if (isNaN(monthlyRent) || monthlyRent <= 0) {
      showError("monthlyRent", "Monthly rent must be a positive number");
      isValid = false;
    }
  }

  const numericFields = [
    {
      id: "quarterlyTax",
      min: 0,
      max: 100,
      message: "Quarterly tax must be between 0 and 100%",
    },
    {
      id: "securityDeposit",
      min: 0,
      max: 36,
      message: "Security deposit must be 0 or more months",
    },
    {
      id: "advancePayment",
      min: 0,
      max: 36,
      message: "Advance payment must be 0 or more months",
    },
    {
      id: "lateFee",
      min: 0,
      max: 100,
      message: "Late fee must be between 0 and 100%",
    },
    {
      id: "gracePeriod",
      min: 0,
      max: 60,
      message: "Grace period must be 0 or more days",
    },
    {
      id: "autoTerminationMonths",
      min: 0,
      max: 36,
      message: "Auto-termination must be 0 or more months",
    },
    {
      id: "terminationTriggerDays",
      min: 0,
      max: 365,
      message: "Termination trigger must be 0 or more days",
    },
    {
      id: "noticeCancelDays",
      min: 0,
      max: 365,
      message: "Cancel notice must be 0 or more days",
    },
    {
      id: "noticeRenewalDays",
      min: 0,
      max: 365,
      message: "Renewal notice must be 0 or more days",
    },
    {
      id: "rentIncreaseRenewal",
      min: 0,
      max: 100,
      message: "Rent increase must be between 0 and 100%",
    },
  ];

  numericFields.forEach((field) => {
    const el = document.getElementById(field.id);
    if (el && el.value) {
      const val = parseFloat(el.value);
      if (isNaN(val) || val < field.min || val > field.max) {
        showError(field.id, field.message);
        isValid = false;
      }
    }
  });

  return isValid;
}

function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorElement = document.getElementById(fieldId + "-error");

  field.classList.add("error");
  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearErrors() {
  document
    .querySelectorAll(".error-message")
    .forEach((el) => (el.textContent = ""));
  document.querySelectorAll(".form-input, .form-select").forEach((field) => {
    field.classList.remove("error");
  });
}

document.addEventListener("DOMContentLoaded", function () {
  loadLeaseTable();
});

async function fetchLeaseById(leaseId) {
  const res = await fetch(`${API_BASE_URL}/${leaseId}`);
  if (!res.ok) throw new Error("Failed to fetch lease details");
  const data = await res.json();
  return data.lease;
}

async function fetchLeases(filters = {}) {
  const params = [];
  if (filters.status)
    params.push(`status=${encodeURIComponent(filters.status)}`);
  if (filters.search)
    params.push(`search=${encodeURIComponent(filters.search)}`);
  if (filters.date) params.push(`date=${encodeURIComponent(filters.date)}`);
  if (filters.page) params.push(`page=${filters.page}`);
  const url = `${API_BASE_URL}${params.length ? "?" + params.join("&") : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch leases");
  return await res.json();
}

async function loadLeaseTable() {
  const tableBody = document.getElementById("leaseTableBody");
  const emptyState = document.getElementById("emptyState");

  const filters = {
    status: document.getElementById("filterStatus").value || "",
    search: document.getElementById("filterSearch").value || "",
    date: document.getElementById("filterDate").value || "",
    page: 1,
  };

  try {
    const data = await fetchLeases(filters);
    const leases = data.leases || [];

    tableBody.innerHTML = "";

    if (leases.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    leases.forEach((lease, idx) => {
      const row = document.createElement("tr");
      let hasRenewals = false;
      try { hasRenewals = Number(lease.renewal_count) > 0 || (Array.isArray(lease.renewal_history) && lease.renewal_history.length > 0); } catch { }
      let daysToEnd = null; let goodForRenewal = false;
      try {
        if (lease.lease_end_date) {
          const endDateObj = new Date(lease.lease_end_date);
          const today = new Date();
          daysToEnd = Math.ceil((endDateObj - today) / (1000 * 60 * 60 * 24));
          const windowDays = Number(lease.notice_before_renewal_days || 0);
          goodForRenewal = (String(lease.lease_status || '').toUpperCase() === 'ACTIVE') && windowDays > 0 && daysToEnd > 0 && daysToEnd <= windowDays;
        }
      } catch { }
      const indicatorSpans = [];
      if (hasRenewals) indicatorSpans.push(`<span class="lease-indicator renewed" data-tooltip="Renewed ${lease.renewal_count || (Array.isArray(lease.renewal_history)?lease.renewal_history.length:0)} time(s)"></span>`);
      if (goodForRenewal) {
        const windowDays = Number(lease.notice_before_renewal_days || 0);
        indicatorSpans.push(`<span class="lease-indicator renewal-soon" data-tooltip="Eligible for renewal: ${daysToEnd} day(s) left (window ${windowDays}d)"></span>`);
      }
      const inlineIndicators = indicatorSpans.length ? `<span style="display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle;">${indicatorSpans.join('')}</span>` : '';

      row.innerHTML = `
        <td><strong style="color:#1f2937;font-weight:700;">${idx + 1 + (filters.page - 1) * 10}</strong></td>
        <td>
          <div style="font-weight:600;color:#111827;">${lease.tenant_name || ''}</div>
          <div style="font-size:12px;color:#6b7280;">User ID: ${lease.user_id || ''}</div>
        </td>
        <td>
          <div style="font-weight:500;color:#111827;">${lease.property_name || ''}</div>
          <div style="font-size:12px;color:#6b7280;">Property ID: ${lease.property_id || ''}</div>
        </td>
        <td>
          <div style="font-size:13px;font-weight:500;">${formatDate(lease.lease_start_date)}</div>
          <div style="font-size:12px;color:#6b7280;">to ${formatDate(lease.lease_end_date)}</div>
          <div style="font-size:11px;color:#9ca3af;">${getDuration(lease.lease_start_date, lease.lease_end_date)}</div>
        </td>
        <td><span class="status-badge status-${(lease.lease_status || '').toLowerCase()}">${lease.lease_status || ''}</span>${inlineIndicators}</td>
        <td>
          <div style="font-weight:700;color:#059669;font-size:16px;">₱${(lease.monthly_rent || 0).toLocaleString()}</div>
          <div style="font-size:12px;color:#6b7280;">${lease.payment_frequency || ''}</div>
        </td>
        <td><div style="font-weight:500;">${getNextDueDate(lease)}</div></td>
        <td>
          <button class="action-btn action-view" onclick="showDetailView('${lease.lease_id}')" title="View Details"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn action-edit" onclick="showEditView('${lease.lease_id}')" title="Edit Lease"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn action-delete" onclick="showDeleteModal('${lease.lease_id}')" title="Delete Lease"><i class="fa-solid fa-trash"></i></button>
        </td>`;
      tableBody.appendChild(row);
    });
  } catch (error) {
    showToast("Failed to load leases", "error");
    tableBody.innerHTML = "";
    emptyState.classList.remove("hidden");
  }
}

function applyFilters() {
  loadLeaseTable();
}

function clearFilters() {
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterSearch").value = "";
  document.getElementById("filterDate").value = "";
  loadLeaseTable();
}

function getDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const months = Math.round(diffDays / 30);
  return months > 1 ? `${months} months` : `${diffDays} days`;
}

function getNextDueDate(lease) {
  const [startY, startM, startD] = lease.lease_start_date
    .split("T")[0]
    .split("-");
  const dueDay = Number(startD);

  const today = new Date();
  let dueYear = today.getFullYear();
  let dueMonth = today.getMonth() + 1;

  dueMonth += 1;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }

  let nextDueStr = `${dueYear}-${String(dueMonth).padStart(2, "0")}-${String(
    dueDay
  ).padStart(2, "0")}`;

  const [endY, endM, endD] = lease.lease_end_date.split("T")[0].split("-");
  const nextDueUTC = Date.UTC(dueYear, dueMonth - 1, dueDay);
  const endUTC = Date.UTC(Number(endY), Number(endM) - 1, Number(endD));
  if (nextDueUTC > endUTC) {
    nextDueStr = `${endY}-${endM}-${endD}`;
  }

  return formatDate(nextDueStr);
}

function loadForm(lease) {
  const tenantSelect = document.getElementById("tenantId");
  const propertySelect = document.getElementById("propertyId");

  const safeSet = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value || "";
  };

  try {
    const tenantVal = lease.tenantId || lease.user_id || "";
    if (tenantSelect) {
      if (
        tenantVal &&
        !tenantSelect.querySelector(`option[value="${tenantVal}"]`)
      ) {
        const opt = document.createElement("option");
        opt.value = tenantVal;
        opt.textContent =
          lease.tenantName || lease.tenant_name || `Tenant ${tenantVal}`;

        tenantSelect.appendChild(opt);
      }
      tenantSelect.value = tenantVal || "";
    }
  } catch (e) {
    console.warn("Failed to set tenant select value", e);
  }

  try {
    const propertyVal = lease.propertyId || lease.property_id || "";
    if (propertySelect) {
      if (
        propertyVal &&
        !propertySelect.querySelector(`option[value="${propertyVal}"]`)
      ) {
        const opt = document.createElement("option");
        opt.value = propertyVal;
        opt.textContent =
          lease.propertyName ||
          lease.property_name ||
          `Property ${propertyVal}`;
        propertySelect.appendChild(opt);
      }
      propertySelect.value = propertyVal || "";
    }
  } catch (e) {
    console.warn("Failed to set property select value", e);
  }

  safeSet("startDate", lease.startDate || "");
  safeSet("endDate", lease.endDate || "");
  safeSet("status", lease.status || "PENDING");
  safeSet("monthlyRent", lease.monthlyRent || "");
  safeSet("paymentFrequency", lease.paymentFrequency || "Monthly");
  safeSet("quarterlyTax", lease.quarterlyTax || "");
  safeSet("securityDeposit", lease.securityDeposit || "");
  safeSet("advancePayment", lease.advancePayment || "");
  safeSet("lateFee", lease.lateFee || "");
  safeSet("gracePeriod", lease.gracePeriod || "");

  const isSecurityRefundableEl = document.getElementById(
    "isSecurityRefundable"
  );
  if (isSecurityRefundableEl)
    isSecurityRefundableEl.checked = lease.isSecurityRefundable !== false;

  const advanceForfeitedEl = document.getElementById("advanceForfeited");
  if (advanceForfeitedEl)
    advanceForfeitedEl.checked = lease.advanceForfeited === true;

  safeSet("autoTerminationMonths", lease.autoTerminationMonths || "");
  safeSet("terminationTriggerDays", lease.terminationTriggerDays || 61);
  safeSet("noticeCancelDays", lease.noticeCancelDays || "");
  safeSet("noticeRenewalDays", lease.noticeRenewalDays || "");
  safeSet("rentIncreaseRenewal", lease.rentIncreaseRenewal || "");
  safeSet("notes", lease.notes || "");

  try {
    updateEndDateHint();
  } catch (e) {
    /* noop */
  }
}

function clearForm() {
  document.getElementById("tenantId").value = "";
  document.getElementById("propertyId").value = "";
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  document.getElementById("status").value = "PENDING";
  document.getElementById("monthlyRent").value = "";

  document.getElementById("quarterlyTax").value = "";
  document.getElementById("securityDeposit").value = "";
  document.getElementById("advancePayment").value = "";
  document.getElementById("lateFee").value = "";
  document.getElementById("gracePeriod").value = "";
  document.getElementById("isSecurityRefundable").checked = true;
  document.getElementById("advanceForfeited").checked = false;
  document.getElementById("autoTerminationMonths").value = "";
  document.getElementById("terminationTriggerDays").value = "61";
  document.getElementById("noticeCancelDays").value = "";
  document.getElementById("noticeRenewalDays").value = "";
  document.getElementById("rentIncreaseRenewal").value = "";
  document.getElementById("notes").value = "";
  updateUploadedFilesList();
  try {
    updateInitialChargesNotice && updateInitialChargesNotice();
  } catch (e) {
    /* noop */
  }
}

async function saveLease() {
  console.debug("saveLease called", {
    currentEditingLeaseId: window.currentEditingLeaseId,
  });

  if (window.currentEditingLeaseId) {
    try {
      const verified = await verifyAdminPassword();
      if (!verified) {
        showToast("Password verification failed", "error");
        return;
      }
    } catch (e) {
      console.error("Admin verification error:", e);
      showToast("Password verification failed", "error");
      return;
    }
  }

  let isValid = false;
  try {
    isValid = validateForm();
  } catch (err) {
    console.error("validateForm threw an error:", err);
    showToast("Form validation failed. See console for details.", "error");
    return;
  }

  if (!isValid) {
    showToast("Please correct the errors in the form", "error");
    return;
  }

  if (!window.currentEditingLeaseId) {
    try {
      const adv = Number(
        (document.getElementById("advancePayment") || {}).value || 0
      );
      const sec = Number(
        (document.getElementById("securityDeposit") || {}).value || 0
      );
      const startDate =
        (document.getElementById("startDate") || {}).value || "";
      if ((adv > 0 || sec > 0) && startDate) {
        const msg = `This lease will automatically create ${adv > 0 ? adv + " advance payment" : ""
          }${adv > 0 && sec > 0 ? " and " : ""}${sec > 0 ? sec + " security deposit" : ""
          } charge(s) (type "Other") due on ${startDate}. Continue?`;
        const confirmFn =
          typeof window.showConfirm === "function"
            ? window.showConfirm
            : (m) => Promise.resolve(confirm(String(m)));
        const proceed = await confirmFn(msg, "Initial Charges");
        if (!proceed) {
          return;
        }
      }
    } catch (e) {
      /* noop */
    }
  }

  const saveBtn = document.getElementById("saveBtn");
  const saveText = document.getElementById("saveText");

  if (saveBtn) saveBtn.disabled = true;
  if (saveText) saveText.textContent = "Saving...";

  try {
    const formData = new FormData();
    formData.append("user_id", document.getElementById("tenantId").value);
    formData.append("property_id", document.getElementById("propertyId").value);
    formData.append(
      "lease_start_date",
      document.getElementById("startDate").value
    );
    formData.append("lease_end_date", document.getElementById("endDate").value);
    formData.append("lease_status", document.getElementById("status").value);
    formData.append(
      "monthly_rent",
      document.getElementById("monthlyRent").value
    );
    {
      const pfEl = document.getElementById("paymentFrequency");
      const paymentFrequency = pfEl && pfEl.value ? pfEl.value : "Monthly";
      formData.append("payment_frequency", paymentFrequency);
    }
    formData.append(
      "quarterly_tax_percentage",
      document.getElementById("quarterlyTax").value
    );
    formData.append(
      "security_deposit_months",
      document.getElementById("securityDeposit").value
    );
    formData.append(
      "advance_payment_months",
      document.getElementById("advancePayment").value
    );
    formData.append(
      "late_fee_percentage",
      document.getElementById("lateFee").value
    );
    formData.append(
      "grace_period_days",
      document.getElementById("gracePeriod").value
    );
    formData.append(
      "is_security_deposit_refundable",
      document.getElementById("isSecurityRefundable").checked ? "1" : "0"
    );
    formData.append(
      "advance_payment_forfeited_on_cancel",
      document.getElementById("advanceForfeited").checked ? "1" : "0"
    );
    formData.append(
      "auto_termination_after_months",
      document.getElementById("autoTerminationMonths").value
    );
    formData.append(
      "termination_trigger_days",
      document.getElementById("terminationTriggerDays").value
    );
    formData.append(
      "notice_before_cancel_days",
      document.getElementById("noticeCancelDays").value
    );
    formData.append(
      "notice_before_renewal_days",
      document.getElementById("noticeRenewalDays").value
    );
    formData.append(
      "rent_increase_on_renewal",
      document.getElementById("rentIncreaseRenewal").value
    );
    formData.append("notes", document.getElementById("notes").value);

    if (uploadedFiles.length > 0) {
      formData.append("contract", uploadedFiles[0]);
    }

    if (window.currentEditingLeaseId) {
      const url = `${API_BASE_URL}/${window.currentEditingLeaseId}`;
      console.debug("Saving (PATCH)", url);
      const response = await fetch(url, { method: "PATCH", body: formData });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("PATCH failed", response.status, text);
        let errorMessage = "Failed to update lease";
        try {
          const errorData = JSON.parse(text || "{}");
          errorMessage = errorData.message || errorMessage;
        } catch (e) { }
        throw new Error(errorMessage);
      }

      showToast("Lease updated successfully!");
      window.currentEditingLeaseId = null;
      resetFormState();
      showListView();
    } else {
      const url = `${API_BASE_URL}/create-lease`;
      console.debug("Saving (POST)", url);
      const response = await fetch(url, { method: "POST", body: formData });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("POST failed", response.status, text);
        let errorMessage = "Failed to save lease";
        try {
          const errorData = JSON.parse(text || "{}");
          errorMessage = errorData.message || errorMessage;
        } catch (e) { }
        throw new Error(errorMessage);
      }

      showToast("Lease created successfully!");
      resetFormState();
      showListView();
    }
  } catch (error) {
    showToast("Error saving lease. Please try again.", "error");
    console.error("Save error:", error);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (saveText) saveText.textContent = "Save Lease";
  }
}

function cancelForm() {
  const hasUnsavedChanges = checkForUnsavedChanges();

  if (!hasUnsavedChanges) {
    resetFormState();
    showListView();
    return;
  }

  const message = "You have unsaved changes. Do you want to discard them?";

  try {
    if (
      typeof Modal !== "undefined" &&
      Modal &&
      typeof Modal.open === "function"
    ) {
      Modal.open({
        title: "Discard changes",
        body: `<div style="white-space:pre-wrap;">${message}</div>`,
        showFooter: true,
        showCancel: true,
        confirmText: "Discard",
        cancelText: "Continue Editing",
        onConfirm: function () {
          resetFormState();
          showListView();
          showToast("Changes discarded successfully");
        },
        onCancel: function () { },
      });
      return;
    }
  } catch (e) {
    console.warn("Modal.open not available or failed:", e);
  }

  const confirmFn =
    typeof window !== "undefined" && typeof window.showConfirm === "function"
      ? (msg, title) => window.showConfirm(msg, title)
      : (msg) => Promise.resolve(confirm(String(msg)));

  confirmFn(message, "Discard changes").then((ok) => {
    if (ok) {
      resetFormState();
      showListView();
      showToast("Changes discarded successfully");
    }
  });
}

function showCancelModal() {
  cancelForm();
}

function hideCancelModal() {
  try {
    if (
      typeof Modal !== "undefined" &&
      Modal &&
      typeof Modal.close === "function"
    ) {
      Modal.close();
      return;
    }
  } catch (e) {
    /* noop */
  }
}

function confirmCancel() {
  resetFormState();
  showListView();
  showToast("Changes discarded successfully");
}

function checkForUnsavedChanges() {
  const formFields = [
    "tenantId",
    "propertyId",
    "startDate",
    "endDate",
    "status",
    "monthlyRent",
    "paymentFrequency",
    "quarterlyTax",
    "securityDeposit",
    "advancePayment",
    "lateFee",
    "gracePeriod",
    "autoTerminationMonths",
    "terminationTriggerDays",
    "noticeCancelDays",
    "noticeRenewalDays",
    "rentIncreaseRenewal",
    "notes",
  ];

  return (
    formFields.some((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field.type === "checkbox") {
        return field.checked !== field.defaultChecked;
      }
      return field.value !== field.defaultValue;
    }) ||
    (Array.isArray(uploadedFiles) && uploadedFiles.length > 0)
  );
}

function resetFormState() {
  clearForm();
  clearErrors();

  window.currentEditingLeaseId = null;
}

async function showEditView(leaseId) {
  try {
    const lease = await fetchLeaseById(leaseId);
    if (!lease) {
      showToast("Lease not found", "error");
      return;
    }

    window.currentEditingLeaseId = leaseId;

    const listViewEl = document.getElementById("listView");
    const formViewEl = document.getElementById("formView");
    const detailViewEl = document.getElementById("detailView");
    const formTitleEl = document.getElementById("formTitle");
    if (listViewEl) listViewEl.classList.add("hidden");
    if (formViewEl) formViewEl.classList.remove("hidden");
    if (detailViewEl) detailViewEl.classList.add("hidden");
    if (formTitleEl) formTitleEl.textContent = "Edit Lease";

    clearErrors();

    try {
      await populateTenantDropdown();
      await populatePropertyDropdown();
      await populateFinancialDefaults();
    } catch (e) {
      console.warn(
        "Failed to pre-populate dropdowns/defaults for edit view",
        e
      );
    }

    loadForm(mapLeaseToFormFields(lease));

    try {
      const startInput = document.getElementById("startDate");
      const endInput = document.getElementById("endDate");
      if (startInput) startInput.removeAttribute("min");
      if (endInput) endInput.removeAttribute("min");
    } catch (e) {
      /* noop */
    }
  } catch (err) {
    console.error("showEditView error:", err);
    showToast("Failed to load lease for editing", "error");
  }
}

function mapLeaseToFormFields(lease) {
  const out = {
    tenantId: lease.user_id || lease.tenantId || "",
    propertyId: lease.property_id || lease.propertyId || "",
    startDate:
      lease.lease_start_date && lease.lease_start_date.split
        ? lease.lease_start_date.split("T")[0]
        : "",
    endDate:
      lease.lease_end_date && lease.lease_end_date.split
        ? lease.lease_end_date.split("T")[0]
        : "",
    status: lease.lease_status || lease.status || "PENDING",
    monthlyRent: lease.monthly_rent || lease.monthlyRent || "",
    paymentFrequency:
      lease.payment_frequency || lease.paymentFrequency || "Monthly",
    quarterlyTax: lease.quarterly_tax_percentage || lease.quarterlyTax || "",
    securityDeposit:
      lease.security_deposit_months || lease.securityDeposit || "",
    advancePayment: lease.advance_payment_months || lease.advancePayment || "",
    lateFee: lease.late_fee_percentage || lease.lateFee || "",
    gracePeriod: lease.grace_period_days || lease.gracePeriod || "",
    isSecurityRefundable:
      lease.is_security_deposit_refundable !== undefined
        ? lease.is_security_deposit_refundable
        : true,
    advanceForfeited: lease.advance_payment_forfeited_on_cancel === true,
    autoTerminationMonths:
      lease.auto_termination_after_months || lease.autoTerminationMonths || "",
    terminationTriggerDays:
      lease.termination_trigger_days || lease.terminationTriggerDays || 61,
    noticeCancelDays:
      lease.notice_before_cancel_days || lease.noticeCancelDays || "",
    noticeRenewalDays:
      lease.notice_before_renewal_days || lease.noticeRenewalDays || "",
    rentIncreaseRenewal:
      lease.rent_increase_on_renewal || lease.rentIncreaseRenewal || "",

    tenantName: lease.tenant_name || lease.tenantName || "",
    propertyName: lease.property_name || lease.propertyName || "",
    notes: lease.notes || "",
  };
  return out;
}

function loadDetailView(lease) {
  try {
    document.getElementById(
      "detailTitle"
    ).textContent = `Lease ${lease.lease_id}`;
    document.getElementById(
      "detailSubtitle"
    ).textContent = `${lease.tenant_name} • ${lease.property_name}`;

    document.getElementById("basicInfo").innerHTML = `
    <div class="info-item">
      <div class="info-label">Lease ID</div>
      <div class="info-value">${lease.lease_id}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Status</div>
      <div class="info-value">
        <span class="status-badge status-${lease.lease_status.toLowerCase()}">${lease.lease_status
      }</span>
      </div>
    </div>
    <div class="info-item">
      <div class="info-label">Tenant</div>
      <div class="info-value">${lease.tenant_name}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Property</div>
      <div class="info-value">${lease.property_name}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Start Date</div>
      <div class="info-value">${formatDate(lease.lease_start_date)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">End Date</div>
      <div class="info-value">${formatDate(lease.lease_end_date)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Duration</div>
      <div class="info-value">${getDuration(
        lease.lease_start_date,
        lease.lease_end_date
      )}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Renewal Count</div>
      <div class="info-value">${lease.renewal_count || 0}</div>
    </div>
  `;

    document.getElementById("financialInfo").innerHTML = `
    <div class="info-item">
      <div class="info-label">Monthly Rent</div>
      <div class="info-value" style="font-size: 20px; font-weight: 700; color: #059669;">
        ₱${Number(lease.monthly_rent).toLocaleString()}
      </div>
    </div>
    <div class="info-item">
      <div class="info-label">Payment Frequency</div>
      <div class="info-value">${lease.payment_frequency}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Quarterly Tax</div>
      <div class="info-value">${lease.quarterly_tax_percentage}%</div>
    </div>
    <div class="info-item">
      <div class="info-label">Security Deposit</div>
      <div class="info-value">${lease.security_deposit_months} month(s)</div>
    </div>
    <div class="info-item">
      <div class="info-label">Advance Payment</div>
      <div class="info-value">${lease.advance_payment_months} month(s)</div>
    </div>
    <div class="info-item">
      <div class="info-label">Late Fee</div>
      <div class="info-value">${lease.late_fee_percentage}%</div>
    </div>
    <div class="info-item">
      <div class="info-label">Grace Period</div>
      <div class="info-value">${lease.grace_period_days} days</div>
    </div>
  `;

    document.getElementById("rulesInfo").innerHTML = `
    <div class="info-item">
      <div class="info-label">Security Deposit: Refundable?</div>
      <div class="info-value">${lease.is_security_deposit_refundable ? "Yes" : "No"
      }</div>
    </div>
    <div class="info-item">
      <div class="info-label">Advance Forfeited on Cancel</div>
      <div class="info-value">${lease.advance_payment_forfeited_on_cancel ? "Yes" : "No"
      }</div>
    </div>
    <div class="info-item">
      <div class="info-label">Auto-Termination</div>
      <div class="info-value">${lease.auto_termination_after_months
      } month(s)</div>
    </div>
    <div class="info-item">
      <div class="info-label">Nonpayment before Termination (days)</div>
      <div class="info-value">${lease.termination_trigger_days} days</div>
    </div>
    <div class="info-item">
      <div class="info-label">Termination Notice</div>
      <div class="info-value">${lease.notice_before_cancel_days} days</div>
    </div>
    <div class="info-item">
      <div class="info-label">Renewal Notice</div>
      <div class="info-value">${lease.notice_before_renewal_days} days</div>
    </div>
    <div class="info-item">
      <div class="info-label">Rent Increase on Renewal</div>
      <div class="info-value">${lease.rent_increase_on_renewal}%</div>
    </div>
  `;

    document.getElementById("nextDueDate").textContent = getNextDueDate(
      lease
    ).replace(/<[^>]*>/g, "");
    document.getElementById("amountDue").textContent = `₱${Number(
      lease.monthly_rent
    ).toLocaleString()}`;

    const notesCard = document.getElementById("notesCard");
    const leaseNotes = document.getElementById("leaseNotes");

    if (lease.notes && lease.notes.trim()) {
      leaseNotes.textContent = lease.notes;
      notesCard.style.display = "block";
    } else {
      notesCard.style.display = "none";
    }

    const terminationCard = document.getElementById("terminationCard");
    const terminationInfo = document.getElementById("terminationInfo");
    try {
      if (
        String(lease.lease_status || "").toUpperCase() === "TERMINATED" &&
        lease.termination
      ) {
        const t = lease.termination;
        terminationInfo.innerHTML = `
          <div class="info-item">
            <div class="info-label">Termination Date</div>
            <div class="info-value">${t.termination_date ? formatDate(t.termination_date) : "-"
          }</div>
          </div>
          <div class="info-item">
            <div class="info-label">Reason</div>
            <div class="info-value">${t.termination_reason || "-"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Advance Payment Status</div>
            <div class="info-value">${t.advance_payment_status || "-"}</div>
          </div>
            <div class="info-item">
            <div class="info-label">Security Deposit Status</div>
            <div class="info-value">${t.security_deposit_status || "-"}</div>
          </div>
          ${t.notes
            ? `<div class="info-item"><div class="info-label">Notes</div><div class="info-value" style="white-space:pre-wrap;">${t.notes}</div></div>`
            : ""
          }
        `;
        terminationCard.style.display = "block";
      } else {
        terminationCard.style.display = "none";
      }
    } catch (e) {
      terminationCard && (terminationCard.style.display = "none");
    }

    try {
      const historyCard = document.getElementById("renewalHistoryCard");
      const timelineEl = document.getElementById("renewalTimeline");
      const latestSummaryEl = document.getElementById("latestRenewalSummary");
      if (historyCard && timelineEl) {
        const history = Array.isArray(lease.renewal_history)
          ? lease.renewal_history
          : [];
        if (history.length) {
          historyCard.style.display = "block";

          if (latestSummaryEl) {
            const latest = history[0];
            try {
              const prevEnd = latest.previous_end_date
                ? formatDate(latest.previous_end_date)
                : "-";
              const newEnd = latest.new_end_date
                ? formatDate(latest.new_end_date)
                : "-";
              const prevRent = Number(latest.previous_rent || 0);
              const newRent = Number(latest.new_rent || 0);
              const inc = Number(latest.rent_increase_pct || 0);
              const incLabel =
                inc === 0
                  ? "No change"
                  : inc > 0
                    ? "+" + inc.toFixed(2) + "%"
                    : inc.toFixed(2) + "%";
              latestSummaryEl.innerHTML = `
                <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;">
                  <div style="flex:1;min-width:180px;">
                    <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Latest Renewal</div>
                    <div style="margin-top:6px;font-size:14px;color:#1f2937;font-weight:600;">${latest.created_at ? formatDate(latest.created_at) : ""
                }</div>
                  </div>
                  <div style="flex:1;min-width:200px;">
                    <div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;">End Date</div>
                    <div style="margin-top:6px;font-size:14px;color:#1f2937;font-weight:600;">${prevEnd} → <span style="color:#2563eb;">${newEnd}</span></div>
                  </div>
                  <div style="flex:1;min-width:210px;">
                    <div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;">Rent</div>
                    <div style="margin-top:6px;font-size:14px;color:#1f2937;font-weight:600;">₱${prevRent.toLocaleString()} → <span style="color:#059669;">₱${newRent.toLocaleString()}</span> <span style="margin-left:4px;font-size:12px;color:${inc > 0 ? "#dc2626" : inc < 0 ? "#059669" : "#6b7280"
                };">(${incLabel})</span></div>
                  </div>
                  ${latest.notes
                  ? `<div style=\"flex:1;min-width:200px;\"><div style=\"font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;\">Notes</div><div style=\"margin-top:6px;font-size:13px;color:#374151;white-space:pre-wrap;\">${latest.notes}</div></div>`
                  : ""
                }
                </div>`;
              latestSummaryEl.style.display = "block";
            } catch (e) {
              latestSummaryEl.style.display = "none";
            }
          }
          timelineEl.innerHTML = history
            .map((r) => {
              const prevEnd = r.previous_end_date
                ? formatDate(r.previous_end_date)
                : "-";
              const newEnd = r.new_end_date ? formatDate(r.new_end_date) : "-";
              const inc = Number(r.rent_increase_pct || 0);
              const incLabel =
                inc === 0
                  ? "No change"
                  : inc > 0
                    ? "+" + inc.toFixed(2) + "%"
                    : inc.toFixed(2) + "%";
              return `
              <div style=\"display:flex;flex-direction:column;gap:4px;padding:10px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;position:relative;\">
                <div style=\"display:flex;justify-content:space-between;align-items:center;\">
                  <div style=\"font-weight:600;color:#1f2937;\">Renewal #${r.renewal_id
                }</div>
                  <div style=\"font-size:11px;color:#6b7280;\">${r.created_at ? formatDate(r.created_at) : ""
                }</div>
                </div>
                <div style=\"font-size:12px;color:#374151;\"><strong>End Date:</strong> ${prevEnd} → <span style=\"color:#2563eb;font-weight:600;\">${newEnd}</span></div>
                <div style=\"font-size:12px;color:#374151;\"><strong>Rent:</strong> ₱${Number(
                  r.previous_rent || 0
                ).toLocaleString()} → <span style=\"color:#059669;font-weight:600;\">₱${Number(
                  r.new_rent || 0
                ).toLocaleString()}</span> <span style=\"margin-left:4px;font-size:11px;color:${inc > 0 ? "#dc2626" : inc < 0 ? "#059669" : "#6b7280"
                };\">(${incLabel})</span></div>
                ${r.notes
                  ? `<div style=\"font-size:12px;color:#4b5563;white-space:pre-wrap;\">${r.notes}</div>`
                  : ""
                }
              </div>`;
            })
            .join("");
        } else {
          historyCard.style.display = "none";
          timelineEl.innerHTML = "";
          if (latestSummaryEl) latestSummaryEl.style.display = "none";
        }
      }
    } catch (e) {
      const historyCard = document.getElementById("renewalHistoryCard");
      if (historyCard) historyCard.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading detail view:", error);
    showToast("Error loading lease details", "error");
  }
}

function editCurrentLease() {
  if (leaseManager.currentLease) {
    showEditView(leaseManager.currentLease.id);
  }
}

function showDeleteModal(leaseId) {
  deleteLeaseId = leaseId;
  document.getElementById("deleteModal").classList.add("show");
}

function hideDeleteModal() {
  deleteLeaseId = null;
  document.getElementById("deleteModal").classList.remove("show");
}

function confirmDelete() {
  if (!deleteLeaseId) {
    hideDeleteModal();
    return;
  }

  (async function () {
    try {
      const ok = await verifyAdminPassword();
      if (!ok) {
        showToast("Password verification failed", "error");
        hideDeleteModal();
        return;
      }

      const res = await fetch(`${API_BASE_URL}/${deleteLeaseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete lease");
      }
      showToast("Lease deleted successfully");
      loadLeaseTable();
    } catch (error) {
      console.error("Delete lease error:", error);
      showToast(error.message || "Error deleting lease", "error");
    } finally {
      hideDeleteModal();
    }
  })();
}

let uploadedFiles = [];

function handleFileUpload() {
  document.getElementById("fileInput").click();
}

function handleFileSelection(event) {
  const files = Array.from(event.target.files);
  if (files.length > 0) {
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      showToast("File size should be less than 10MB", "error");
      event.target.value = "";
      return;
    }
    uploadedFiles = [file];
  } else {
    uploadedFiles = [];
  }

  updateUploadedFilesList();
  event.target.value = "";
}

function updateUploadedFilesList() {
  const container = document.getElementById("uploadedFiles");
  container.innerHTML = "";

  if (!uploadedFiles.length) {
    container.innerHTML =
      '<div style="color:#6b7280;font-size:13px;">No files uploaded.</div>';
    return;
  }

  uploadedFiles.forEach((file, idx) => {
    let preview = "";
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      preview = `<img src="${url}" alt="${file.name}" style="max-width:60px;max-height:60px;border-radius:6px;margin-right:10px;">`;
    } else if (file.type === "application/pdf") {
      preview = `<i class="fa-solid fa-file-pdf" style="font-size:32px;color:#e53e3e;margin-right:10px;"></i>`;
    } else if (
      file.type === "application/msword" ||
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      preview = `<i class="fa-solid fa-file-word" style="font-size:32px;color:#2563eb;margin-right:10px;"></i>`;
    } else {
      preview = `<i class="fa-solid fa-file" style="font-size:32px;color:#6b7280;margin-right:10px;"></i>`;
    }

    container.innerHTML += `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        ${preview}
        <div style="flex:1;">
          <div style="font-weight:500;">${file.name}</div>
          <div style="font-size:12px;color:#6b7280;">${formatFileSize(
      file.size
    )}</div>
        </div>
        <button class="action-btn" style="color:#ef4444;" onclick="removeFile(${idx})" title="Remove">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
  });
}

function removeFile(index) {
  uploadedFiles = [];
  updateUploadedFilesList();
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const title = document.getElementById("toastTitle");
  const messageEl = document.getElementById("toastMessage");
  const icon = document.getElementById("toastIcon");

  if (type === "error") title.textContent = "Error!";
  else if (type === "info") title.textContent = "Notice";
  else title.textContent = "Success!";

  messageEl.textContent = message;

  toast.classList.remove("show", "error", "info", "success");

  if (!toast.classList.contains("toast")) {
    toast.classList.add("toast");
  }
  if (type === "error") toast.classList.add("error");

  if (icon) {
    icon.className = "";
    if (type === "error") icon.classList.add("fa-solid", "fa-circle-xmark");
    else if (type === "info") icon.classList.add("fa-solid", "fa-info-circle");
    else icon.classList.add("fa-solid", "fa-circle-check");
  }

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.classList.remove("error", "info", "success");
    }, 300);
  }, 4000);
}

function sendReminder() {
  showToast("Payment reminder sent successfully!");
}

function showTerminationModal() {
  const modal = document.getElementById("terminationModal");
  if (!modal) return;

  try {
    const d = new Date();
    const iso = d.toISOString().split("T")[0];
    const terminationDateEl = document.getElementById("terminationDate");
    if (terminationDateEl && !terminationDateEl.value)
      terminationDateEl.value = iso;
  } catch { }
  modal.classList.add("show");
}

function hideTerminationModal() {
  const modal = document.getElementById("terminationModal");
  if (modal) modal.classList.remove("show");
}

async function confirmTerminateLease() {
  try {
    const leaseId =
      window.currentDetailLease && window.currentDetailLease.lease_id;
    if (!leaseId) {
      showToast("No lease selected", "error");
      return;
    }
    const termination_date = (document.getElementById("terminationDate") || {})
      .value;
    const termination_reason = (
      document.getElementById("terminationReason") || {}
    ).value;
    const advance_payment_status = (
      document.getElementById("advancePaymentStatus") || {}
    ).value;
    const security_deposit_status = (
      document.getElementById("securityDepositStatus") || {}
    ).value;
    const notes = (document.getElementById("terminationNotes") || {}).value;

    const payload = {
      termination_date,
      termination_reason,
      advance_payment_status,
      security_deposit_status,
      notes,
    };
    const res = await fetch(`${API_BASE_URL}/${leaseId}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Termination failed");
    }
    hideTerminationModal();
    showToast("Lease terminated successfully");

    await showDetailView(leaseId);
    await updateStatsBar();
  } catch (e) {
    console.error("confirmTerminateLease error", e);
    showToast(e.message || "Termination error", "error");
  }
}

function showRenewModal() {
  const modal = document.getElementById("renewModal");
  if (!modal) return;
  try {
    const lease = window.currentDetailLease;
    if (
      lease &&
      String(lease.lease_status || "").toUpperCase() === "TERMINATED"
    ) {
      showToast("Cannot renew a terminated lease", "error");
      return;
    }
    if (lease) {
      const currentEnd =
        lease.lease_end_date && lease.lease_end_date.split
          ? lease.lease_end_date.split("T")[0]
          : "";

      if (currentEnd) {
        const [y, m, d] = currentEnd.split("-").map(Number);
        const newDate = new Date(y, (m || 1) - 1, d || 1);
        newDate.setMonth(newDate.getMonth() + 12);
        const iso = `${newDate.getFullYear()}-${String(
          newDate.getMonth() + 1
        ).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
        const renewEndEl = document.getElementById("renewEndDate");
        if (renewEndEl && !renewEndEl.value) renewEndEl.value = iso;
      }
      const rentEl = document.getElementById("renewMonthlyRent");
      if (rentEl && !rentEl.value) {
        rentEl.placeholder = `Current: ₱${Number(
          lease.monthly_rent || 0
        ).toLocaleString()}`;

        const baseRent = Number(lease.monthly_rent || 0);
        const pctRaw = lease.rent_increase_on_renewal;
        const pct =
          pctRaw !== undefined && pctRaw !== null ? Number(pctRaw) : 0;
        if (!isNaN(baseRent) && baseRent > 0 && !isNaN(pct) && pct > 0) {
          const newRent = Math.round(baseRent * (1 + pct / 100) * 100) / 100;
          rentEl.value = newRent;

          const previewEl = document.getElementById("rentIncreasePreview");
          if (previewEl) {
            const diffPct = ((newRent - baseRent) / baseRent) * 100;
            previewEl.textContent = `Proposed increase: ${diffPct.toFixed(
              2
            )}% (from ₱${baseRent.toLocaleString()} to ₱${newRent.toLocaleString()})`;
          }
        }
      }
    }
  } catch { }
  modal.classList.add("show");
}

function hideRenewModal() {
  const modal = document.getElementById("renewModal");
  if (modal) modal.classList.remove("show");
}

async function confirmRenewLease() {
  const leaseId =
    window.currentDetailLease && window.currentDetailLease.lease_id;
  if (!leaseId) {
    showToast("No lease selected", "error");
    return;
  }
  if (
    window.currentDetailLease &&
    String(window.currentDetailLease.lease_status || "").toUpperCase() ===
    "TERMINATED"
  ) {
    showToast("Renewal not allowed: lease is terminated", "error");
    hideRenewModal();
    return;
  }
  const endEl = document.getElementById("renewEndDate");
  const rentEl = document.getElementById("renewMonthlyRent");
  const notesEl = document.getElementById("renewNotes");
  const new_end_date = endEl && endEl.value ? endEl.value : "";
  const new_monthly_rent_raw = rentEl && rentEl.value ? rentEl.value : null;

  if (!new_end_date) {
    const errDiv = document.getElementById("renewEndDate-error");
    if (errDiv) errDiv.textContent = "New end date is required";
    showToast("Provide a new end date", "error");
    return;
  } else {
    const errDiv = document.getElementById("renewEndDate-error");
    if (errDiv) errDiv.textContent = "";
  }

  const payload = { new_end_date };
  if (new_monthly_rent_raw)
    payload.new_monthly_rent = Number(new_monthly_rent_raw);
  if (notesEl && notesEl.value) payload.notes = notesEl.value;

  try {
    const res = await fetch(`${API_BASE_URL}/${leaseId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Renewal failed");
    }
    hideRenewModal();
    showToast("Lease renewed successfully");
    await showDetailView(leaseId);
    await updateStatsBar();
  } catch (e) {
    console.error("confirmRenewLease error", e);
    showToast(e.message || "Renewal error", "error");
  }
}

document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "renewMonthlyRent") {
    try {
      const lease = window.currentDetailLease;
      if (!lease) return;
      const current = Number(lease.monthly_rent || 0);
      const val = Number(e.target.value || 0);
      const previewEl = document.getElementById("rentIncreasePreview");
      if (!previewEl) return;
      if (!val) {
        previewEl.textContent = "";
        return;
      }
      if (current > 0) {
        const diffPct = ((val - current) / current) * 100;
        previewEl.textContent = `Proposed increase: ${diffPct.toFixed(
          2
        )}% (from ₱${current.toLocaleString()} to ₱${val.toLocaleString()})`;
      } else {
        previewEl.textContent = "";
      }
    } catch { }
  }
});

function viewPaymentHistory() {
  showToast("Payment history feature coming soon!");
}

function viewAllActivity() {
  showToast("Activity log feature coming soon!");
}

function downloadDocument(docType) {
  showToast(`Downloading ${docType}...`);
}

function uploadNewDocument() {
  showToast("Document upload feature coming soon!");
}

window.addEventListener("click", function (event) {
  const deleteModal = document.getElementById("deleteModal");
  const cancelModal = document.getElementById("cancelModal");

  if (event.target === deleteModal) {
    hideDeleteModal();
  }
  if (event.target === cancelModal) {
    hideCancelModal();
  }
});

function getSessionCache(key, maxAgeMs = 300000) {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const { data, ts } = JSON.parse(item);
    if (Date.now() - ts > maxAgeMs) return null;

    return data;
  } catch {
    return null;
  }
}

function setSessionCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { }
}

function createPasswordPromptModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "admin-password-overlay";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.4)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "2200";

    const modal = document.createElement("div");
    modal.className = "admin-password-modal";
    modal.style.background = "#fff";
    modal.style.padding = "20px";
    modal.style.borderRadius = "8px";
    modal.style.width = "380px";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.15)";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    title.textContent = "Confirm password";

    const desc = document.createElement("div");
    desc.style.fontSize = "13px";
    desc.style.color = "#374151";
    desc.style.marginBottom = "12px";
    desc.textContent = "Please enter your password to confirm this action.";

    const input = document.createElement("input");

    input.autocomplete = "new-password";
    input.name = "p_" + Math.random().toString(36).slice(2);
    input.type = "password";
    input.style.width = "100%";
    input.style.padding = "10px 12px";
    input.style.border = "1px solid #d1d5db";
    input.style.borderRadius = "6px";
    input.style.marginBottom = "12px";

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.justifyContent = "flex-end";
    buttonRow.style.gap = "8px";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.padding = "8px 12px";

    const okBtn = document.createElement("button");
    okBtn.className = "btn btn-primary";
    okBtn.textContent = "Confirm";
    okBtn.style.padding = "8px 12px";

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(okBtn);

    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(input);
    modal.appendChild(buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      try {
        document.body.removeChild(overlay);
      } catch (e) { }
    };

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    okBtn.addEventListener("click", () => {
      const val = input.value || "";
      cleanup();
      resolve(val);
    });

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        okBtn.click();
      }
      if (ev.key === "Escape") {
        cancelBtn.click();
      }
    });

    setTimeout(() => input.focus(), 50);
  });
}

async function showDetailView(leaseId) {
  try {
    const lease = await fetchLeaseById(leaseId);
    if (!lease) {
      showToast("Lease not found", "error");
      return;
    }
    window.currentDetailLease = lease;

    document.getElementById("listView").classList.add("hidden");
    document.getElementById("formView").classList.add("hidden");
    document.getElementById("detailView").classList.remove("hidden");
    loadDetailView(lease);
  } catch (error) {
    showToast("Failed to load lease details", "error");
  }
}

async function verifyAdminPassword() {
  try {
    const pwd = await createPasswordPromptModal();
    if (!pwd) return false;

    const res = await fetch("/api/v1/admin/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    if (!res.ok) return false;
    return true;
  } catch (err) {
    console.error("verifyAdminPassword error:", err);
    return false;
  }
}

function updateInitialChargesNotice() {
  const noticeEl = document.getElementById("initialChargesNotice");
  if (!noticeEl) return;
  const advEl = document.getElementById("advancePayment");
  const secEl = document.getElementById("securityDeposit");
  const startEl = document.getElementById("startDate");
  const adv = Number(advEl && advEl.value ? advEl.value : 0);
  const sec = Number(secEl && secEl.value ? secEl.value : 0);
  const startDate = startEl && startEl.value ? startEl.value : null;
  if ((adv > 0 || sec > 0) && startDate) {
    const parts = [];
    if (adv > 0) parts.push(`${adv} advance payment`);
    if (sec > 0) parts.push(`${sec} security deposit`);
    const summary = parts.join(" & ");
    noticeEl.innerHTML = `<strong>Automatic Charges:</strong> ${summary} charge(s) will be created (type \"Other\") with due date = lease start (${startDate}).`;
    noticeEl.style.display = "block";
  } else {
    noticeEl.style.display = "none";
  }
}

function attachInitialChargesNoticeListeners() {
  ["advancePayment", "securityDeposit", "startDate"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updateInitialChargesNotice);
      el.addEventListener("change", updateInitialChargesNotice);
    }
  });
}
document.addEventListener(
  "DOMContentLoaded",
  attachInitialChargesNoticeListeners
);

showListView();

window.showCreateView = showCreateView;
window.saveLease = saveLease;
window.cancelForm = cancelForm;
window.editCurrentLease = editCurrentLease;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.confirmCancel = confirmCancel;
window.hideCancelModal = hideCancelModal;
window.showDeleteModal = showDeleteModal;
window.hideDeleteModal = hideDeleteModal;
window.confirmDelete = confirmDelete;
window.handleFileUpload = handleFileUpload;
window.removeFile = removeFile;
window.sendReminder = sendReminder;
window.showTerminationModal = showTerminationModal;
window.hideTerminationModal = hideTerminationModal;
window.confirmTerminateLease = confirmTerminateLease;
window.showRenewModal = showRenewModal;
window.hideRenewModal = hideRenewModal;
window.confirmRenewLease = confirmRenewLease;
window.viewPaymentHistory = viewPaymentHistory;
window.viewAllActivity = viewAllActivity;
window.downloadDocument = downloadDocument;
window.uploadNewDocument = uploadNewDocument;
window.showEditView = showEditView;
window.showDetailView = showDetailView;
window.showListView = showListView;
window.showAccordionSection = showAccordionSection;
