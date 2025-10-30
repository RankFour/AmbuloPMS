import formatDate from "../utils/formatDate.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

const API_BASE_URL = "/api/v1/leases";

window.currentEditingLeaseId = null;
let deleteLeaseId = null;

function loadModalHelpersIfNeeded() {
  return new Promise((resolve) => {
    try {
      if (typeof window !== "undefined" && typeof window.showAlert === "function") {
        return resolve(true);
      }
 
      var existing = document.querySelector('script[data-modalhelpers]');
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
            // basic fallback
            console.warn("showAlert fallback:", type, msg);
            alert(String(msg));
          };
        if (typeof window.showConfirm !== "function")
          window.showConfirm = function (msg) {
            return Promise.resolve(confirm(String(msg)));
          };
        if (typeof window.showPrompt !== "function")
          window.showPrompt = function (msg, placeholder) {
            return Promise.resolve(prompt(String(msg), String(placeholder || "")));
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
      const propRes = await fetch(
        "/api/v1/properties?status=Available&limit=1000"
      );
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
        .filter((lease) =>
          ["ACTIVE", "PENDING"].includes(
            (lease.lease_status || "").toUpperCase()
          )
        )
        .map((lease) => lease.property_id);
      const trulyVacant = properties.filter(
        (prop) => !leasedPropertyIds.includes(prop.property_id)
      );
      vacant = trulyVacant.length;
    } catch { }

    let total = leases.length;
    let active = 0,
      pending = 0,
      terminated = 0;
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
          const durationMonths = Math.round(
            (endDate - startDate) / (1000 * 60 * 60 * 24 * 30)
          );
          totalDuration += durationMonths;
        }
      }
    });
    let avgduration = total > 0 ? Math.round(totalDuration / total) : "-";

    setStatsBar({
      total,
      active,
      pending,
      terminated,
      expiring,
      vacant,
      avgduration,
    });
  } catch (err) {
    setStatsBar({
      total: "-",
      active: "-",
      pending: "-",
      terminated: "-",
      expiring: "-",
      vacant: "-",
      avgduration: "-",
    });
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
  // Ensure we're not in edit mode when showing list
  window.currentEditingLeaseId = null;
  loadLeaseTable();
}

function showCreateView() {
  document.getElementById("listView").classList.add("hidden");
  document.getElementById("formView").classList.remove("hidden");
  document.getElementById("detailView").classList.add("hidden");
  // Reset edit state to ensure Save performs a create (POST), not a patch
  window.currentEditingLeaseId = null;
  clearForm();
  clearErrors();
  populateTenantDropdown();
  populatePropertyDropdown();
  populateFinancialDefaults();
  // Optional: refresh the form title to reflect create mode
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
    if (startDate < new Date()) {
      showError("startDate", "Start date cannot be in the past");
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

//#region Lease - Home

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
      row.innerHTML = `
          <td>
            <strong style="color: #1f2937; font-weight: 700;">${idx + 1 + (filters.page - 1) * 10
        }</strong>
          </td>
          <td>
            <div style="font-weight: 600; color: #111827;">${lease.tenant_name || ""
        }</div>
            <div style="font-size: 12px; color: #6b7280;">User ID: ${lease.user_id || ""
        }</div>
          </td>
          <td>
            <div style="font-weight: 500; color: #111827;">${lease.property_name || ""
        }</div>
            <div style="font-size: 12px; color: #6b7280;">Property ID: ${lease.property_id || ""
        }</div>
          </td>
          <td>
            <div style="font-size: 13px; font-weight: 500;">${formatDate(
          lease.lease_start_date
        )}</div>
            <div style="font-size: 12px; color: #6b7280;">to ${formatDate(
          lease.lease_end_date
        )}</div>
            <div style="font-size: 11px; color: #9ca3af;">${getDuration(
          lease.lease_start_date,
          lease.lease_end_date
        )}</div>
          </td>
          <td>
            <span class="status-badge status-${(
          lease.lease_status || ""
        ).toLowerCase()}">${lease.lease_status || ""}</span>
          </td>
          <td>
            <div style="font-weight: 700; color: #059669; font-size: 16px;">₱${(
          lease.monthly_rent || 0
        ).toLocaleString()}</div>
            <div style="font-size: 12px; color: #6b7280;">${lease.payment_frequency || ""
        }</div>
          </td>
          <td>
            <div style="font-weight: 500;">${getNextDueDate(lease)}</div>
          </td>
          <td>
            <button class="action-btn action-view" onclick="showDetailView('${lease.lease_id
        }')" title="View Details"><i class="fa-solid fa-eye"></i></button>
            <button class="action-btn action-edit" onclick="showEditView('${lease.lease_id
        }')" title="Edit Lease"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn action-delete" onclick="showDeleteModal('${lease.lease_id
        }')" title="Delete Lease"><i class="fa-solid fa-trash"></i></button>
          </td>
        `;
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

//#endregion

function loadForm(lease) {
  // Defensive DOM assignments: element may not exist on all pages.
  // For select fields (tenant/property), if the option for the current value
  // isn't present (e.g., property filtered out because it's already leased),
  // insert a selected option showing the current tenant/property name so the
  // edit form reflects the existing lease.

  const tenantSelect = document.getElementById("tenantId");
  const propertySelect = document.getElementById("propertyId");

  const safeSet = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value || "";
  };

  // Tenant
  try {
    const tenantVal = lease.tenantId || lease.user_id || "";
    if (tenantSelect) {
      // If option doesn't exist, add a readonly option to display current tenant
      if (tenantVal && !tenantSelect.querySelector(`option[value="${tenantVal}"]`)) {
        const opt = document.createElement('option');
        opt.value = tenantVal;
        opt.textContent = lease.tenantName || lease.tenant_name || `Tenant ${tenantVal}`;
        // keep it selectable but mark as current
        tenantSelect.appendChild(opt);
      }
      tenantSelect.value = tenantVal || "";
    }
  } catch (e) {
    console.warn('Failed to set tenant select value', e);
  }

  // Property
  try {
    const propertyVal = lease.propertyId || lease.property_id || "";
    if (propertySelect) {
      if (propertyVal && !propertySelect.querySelector(`option[value="${propertyVal}"]`)) {
        const opt = document.createElement('option');
        opt.value = propertyVal;
        opt.textContent = lease.propertyName || lease.property_name || `Property ${propertyVal}`;
        propertySelect.appendChild(opt);
      }
      propertySelect.value = propertyVal || "";
    }
  } catch (e) {
    console.warn('Failed to set property select value', e);
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

  const isSecurityRefundableEl = document.getElementById("isSecurityRefundable");
  if (isSecurityRefundableEl) isSecurityRefundableEl.checked = lease.isSecurityRefundable !== false;

  const advanceForfeitedEl = document.getElementById("advanceForfeited");
  if (advanceForfeitedEl) advanceForfeitedEl.checked = lease.advanceForfeited === true;

  safeSet("autoTerminationMonths", lease.autoTerminationMonths || "");
  safeSet("terminationTriggerDays", lease.terminationTriggerDays || 61);
  safeSet("noticeCancelDays", lease.noticeCancelDays || "");
  safeSet("noticeRenewalDays", lease.noticeRenewalDays || "");
  safeSet("rentIncreaseRenewal", lease.rentIncreaseRenewal || "");
  safeSet("notes", lease.notes || "");
}

function clearForm() {
  document.getElementById("tenantId").value = "";
  document.getElementById("propertyId").value = "";
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  document.getElementById("status").value = "PENDING";
  document.getElementById("monthlyRent").value = "";
  // document.getElementById("paymentFrequency").value = "Monthly";
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
}

async function saveLease() {
  console.debug("saveLease called", { currentEditingLeaseId: window.currentEditingLeaseId });

  // If editing an existing lease, require admin password BEFORE proceeding
  // so the admin is prompted as soon as they click Save.
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
      console.debug('Saving (PATCH)', url);
      const response = await fetch(url, { method: "PATCH", body: formData });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error('PATCH failed', response.status, text);
        let errorMessage = 'Failed to update lease';
        try {
          const errorData = JSON.parse(text || '{}');
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // ignore parse error
        }
        throw new Error(errorMessage);
      }

      showToast("Lease updated successfully!");
      window.currentEditingLeaseId = null;
      resetFormState();
      showListView();
    } else {
      const url = `${API_BASE_URL}/create-lease`;
      console.debug('Saving (POST)', url);
      const response = await fetch(url, { method: "POST", body: formData });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error('POST failed', response.status, text);
        let errorMessage = 'Failed to save lease';
        try {
          const errorData = JSON.parse(text || '{}');
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // ignore parse error
        }
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

  // Prefer using the app's Modal component directly when available so the
  // global-styled modal is always used even if modalHelpers hasn't finished
  // loading. Fallback order: Modal.open -> window.showConfirm -> window.confirm
  try {
    if (typeof Modal !== "undefined" && Modal && typeof Modal.open === "function") {
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
        onCancel: function () {
          // no-op, keep editing
        },
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

// Backwards-compatible wrappers in case other modules call these functions.
function showCancelModal() {
  // Delegate to cancelForm which will open the global confirm modal.
  cancelForm();
}

function hideCancelModal() {
  // Try to close a global Modal if one is open.
  try {
    if (typeof Modal !== "undefined" && Modal && typeof Modal.close === "function") {
      Modal.close();
      return;
    }
  } catch (e) {
    /* noop */
  }
}

function confirmCancel() {
  // Immediately perform the cancel action (used by legacy bindings).
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
    }) || (Array.isArray(uploadedFiles) && uploadedFiles.length > 0)
  );
}

function resetFormState() {
  clearForm();
  clearErrors();
  // Always exit edit mode when resetting form state
  window.currentEditingLeaseId = null;
}

async function showEditView(leaseId) {
  try {
    const lease = await fetchLeaseById(leaseId);
    if (!lease) {
      showToast("Lease not found", "error");
      return;
    }

    // mark current editing lease id so saveLease will PATCH instead of POST
    window.currentEditingLeaseId = leaseId;

  // Guard DOM access: some pages or states may not include all elements
  // so check existence before manipulating to avoid uncaught TypeErrors.
  const listViewEl = document.getElementById("listView");
  const formViewEl = document.getElementById("formView");
  const detailViewEl = document.getElementById("detailView");
  const formTitleEl = document.getElementById("formTitle");
  if (listViewEl) listViewEl.classList.add("hidden");
  if (formViewEl) formViewEl.classList.remove("hidden");
  if (detailViewEl) detailViewEl.classList.add("hidden");
  if (formTitleEl) formTitleEl.textContent = "Edit Lease";

    clearErrors();
    // Ensure dropdowns and defaults are populated first so select values can be set
    try {
      await populateTenantDropdown();
      await populatePropertyDropdown();
      await populateFinancialDefaults();
    } catch (e) {
      // non-fatal, still attempt to populate form
      console.warn('Failed to pre-populate dropdowns/defaults for edit view', e);
    }

    loadForm(mapLeaseToFormFields(lease));
    // showTab("details");
  } catch (err) {
    console.error("showEditView error:", err);
    showToast("Failed to load lease for editing", "error");
  }
}

function mapLeaseToFormFields(lease) {
  // Map server lease keys to form-friendly keys used by loadForm
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
    securityDeposit: lease.security_deposit_months || lease.securityDeposit || "",
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
    noticeCancelDays: lease.notice_before_cancel_days || lease.noticeCancelDays || "",
    noticeRenewalDays:
      lease.notice_before_renewal_days || lease.noticeRenewalDays || "",
    rentIncreaseRenewal: lease.rent_increase_on_renewal || lease.rentIncreaseRenewal || "",
    // include display names so loadForm can show a readable option when the
    // tenant/property isn't present in the current dropdown options
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
      <div class="info-label">Security Refundable</div>
      <div class="info-value">${lease.is_security_deposit_refundable ? "Yes" : "No"
      }</div>
    </div>
    <div class="info-item">
      <div class="info-label">Advance Forfeited</div>
      <div class="info-value">${lease.advance_payment_forfeited_on_cancel ? "Yes" : "No"
      }</div>
    </div>
    <div class="info-item">
      <div class="info-label">Auto-Termination</div>
      <div class="info-value">${lease.auto_termination_after_months
      } month(s)</div>
    </div>
    <div class="info-item">
      <div class="info-label">Termination Trigger</div>
      <div class="info-value">${lease.termination_trigger_days} days</div>
    </div>
    <div class="info-item">
      <div class="info-label">Cancel Notice</div>
      <div class="info-value">${lease.notice_before_cancel_days} days</div>
    </div>
    <div class="info-item">
      <div class="info-label">Renewal Notice</div>
      <div class="info-value">${lease.notice_before_renewal_days} days</div>
    </div>
    <div class="info-item">
      <div class="info-label">Rent Increase</div>
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

//#region File Upload
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

//#endregion

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const title = document.getElementById("toastTitle");
  const messageEl = document.getElementById("toastMessage");
  const icon = document.getElementById("toastIcon");

  // Title depending on type
  if (type === "error") title.textContent = "Error!";
  else if (type === "info") title.textContent = "Notice";
  else title.textContent = "Success!";

  messageEl.textContent = message;

  // Reset classes and add type + show (CSS uses .toast and .toast.show)
  toast.classList.remove("show", "error", "info", "success");
  // Ensure base class is present
  if (!toast.classList.contains("toast")) {
    toast.classList.add("toast");
  }
  if (type === "error") toast.classList.add("error");

  // set icon for each type (FontAwesome classes)
  if (icon) {
    icon.className = ""; // clear
    if (type === "error") icon.classList.add("fa-solid", "fa-circle-xmark");
    else if (type === "info") icon.classList.add("fa-solid", "fa-info-circle");
    else icon.classList.add("fa-solid", "fa-circle-check");
  }

  // show
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // hide after delay
  setTimeout(() => {
    toast.classList.remove("show");
    // remove type class shortly after hide to allow CSS transitions
    setTimeout(() => {
      toast.classList.remove("error", "info", "success");
    }, 300);
  }, 4000);
}

function sendReminder() {
  showToast("Payment reminder sent successfully!");
}

async function terminateLease() {
  const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
    ? ((msg, title) => window.showConfirm(msg, title))
    : (msg => Promise.resolve(confirm(String(msg))));

  const ok = !!(await confirmFn("Are you sure you want to terminate this lease?", "Confirm termination"));
  if (!ok) return;
  showToast("Lease termination process initiated");
}

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

// ------------------ Admin password verification (client) ------------------
function createPasswordPromptModal() {
  return new Promise((resolve) => {
    // Create modal elements
    const overlay = document.createElement('div');
    overlay.className = 'admin-password-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '2200';

    const modal = document.createElement('div');
    modal.className = 'admin-password-modal';
    modal.style.background = '#fff';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.width = '380px';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    title.textContent = 'Confirm password';

    const desc = document.createElement('div');
    desc.style.fontSize = '13px';
    desc.style.color = '#374151';
    desc.style.marginBottom = '12px';
    desc.textContent = 'Please enter your password to confirm this action.';

    const input = document.createElement('input');
    // Prevent browser autofill by using unpredictable name and new-password
    input.autocomplete = 'new-password';
    input.name = 'p_' + Math.random().toString(36).slice(2);
    input.type = 'password';
    input.style.width = '100%';
    input.style.padding = '10px 12px';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '6px';
    input.style.marginBottom = '12px';

    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.justifyContent = 'flex-end';
    buttonRow.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '8px 12px';

    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary';
    okBtn.textContent = 'Confirm';
    okBtn.style.padding = '8px 12px';

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(okBtn);

    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(input);
    modal.appendChild(buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      try { document.body.removeChild(overlay); } catch (e) { }
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    okBtn.addEventListener('click', () => {
      const val = input.value || '';
      cleanup();
      resolve(val);
    });

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        okBtn.click();
      }
      if (ev.key === 'Escape') {
        cancelBtn.click();
      }
    });

    // Focus the input
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
    // Always use a reliable inline password prompt to avoid Modal API return-value issues
    const pwd = await createPasswordPromptModal();
    if (!pwd) return false;

    const res = await fetch('/api/v1/admin/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    if (!res.ok) return false;
    return true;
  } catch (err) {
    console.error('verifyAdminPassword error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------

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
window.terminateLease = terminateLease;
window.viewPaymentHistory = viewPaymentHistory;
window.viewAllActivity = viewAllActivity;
window.downloadDocument = downloadDocument;
window.uploadNewDocument = uploadNewDocument;
window.showEditView = showEditView;
window.showDetailView = showDetailView;
window.showListView = showListView;
window.showAccordionSection = showAccordionSection;
// window.showTab = showTab;
