import formatDate from "../utils/formatDate.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

const API_BASE_URL = "/api/v1/leases";

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
  loadLeaseTable();
}

function showCreateView() {
  document.getElementById("listView").classList.add("hidden");
  document.getElementById("formView").classList.remove("hidden");
  document.getElementById("detailView").classList.add("hidden");
  clearForm();
  clearErrors();
  populateTenantDropdown();
  populatePropertyDropdown();
  populateFinancialDefaults();
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

function showEditView(leaseId) {
  const lease = leaseManager.getLeaseById(leaseId);
  if (!lease) {
    showToast("Lease not found", "error");
    return;
  }

  document.getElementById("listView").classList.add("hidden");
  document.getElementById("formView").classList.remove("hidden");
  document.getElementById("detailView").classList.add("hidden");
  document.getElementById("formTitle").textContent = "Edit Lease";

  clearErrors();
  showTab("details");
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
  document.getElementById("tenantId").value = lease.tenantId || "";
  document.getElementById("propertyId").value = lease.propertyId || "";
  document.getElementById("startDate").value = lease.startDate || "";
  document.getElementById("endDate").value = lease.endDate || "";
  document.getElementById("status").value = lease.status || "PENDING";
  document.getElementById("monthlyRent").value = lease.monthlyRent || "";
  document.getElementById("paymentFrequency").value =
    lease.paymentFrequency || "Monthly";
  document.getElementById("quarterlyTax").value = lease.quarterlyTax || "";
  document.getElementById("securityDeposit").value =
    lease.securityDeposit || "";
  document.getElementById("advancePayment").value = lease.advancePayment || "";
  document.getElementById("lateFee").value = lease.lateFee || "";
  document.getElementById("gracePeriod").value = lease.gracePeriod || "";
  document.getElementById("isSecurityRefundable").checked =
    lease.isSecurityRefundable !== false;
  document.getElementById("advanceForfeited").checked =
    lease.advanceForfeited === true;
  document.getElementById("autoTerminationMonths").value =
    lease.autoTerminationMonths || "";
  document.getElementById("terminationTriggerDays").value =
    lease.terminationTriggerDays || 61;
  document.getElementById("noticeCancelDays").value =
    lease.noticeCancelDays || "";
  document.getElementById("noticeRenewalDays").value =
    lease.noticeRenewalDays || "";
  document.getElementById("rentIncreaseRenewal").value =
    lease.rentIncreaseRenewal || "";
  document.getElementById("notes").value = lease.notes || "";
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
  if (!validateForm()) {
    showToast("Please correct the errors in the form", "error");
    return;
  }

  const saveBtn = document.getElementById("saveBtn");
  const saveText = document.getElementById("saveText");

  saveBtn.disabled = true;
  saveText.textContent = "Saving...";

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
    formData.append(
      "payment_frequency",
      document.getElementById("paymentFrequency").value
    );
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

    const response = await fetch(`${API_BASE_URL}/create-lease`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to save lease");
    }

    showToast("Lease created successfully!");
    resetFormState();
    showListView();
  } catch (error) {
    showToast("Error saving lease. Please try again.", "error");
    console.error("Save error:", error);
  } finally {
    saveBtn.disabled = false;
    saveText.textContent = "Save Lease";
  }
}

function cancelForm() {
  const hasUnsavedChanges = checkForUnsavedChanges();

  if (hasUnsavedChanges) {
    showCancelModal();
  } else {
    resetFormState();
    showListView();
  }
}

function showCancelModal() {
  const modal = document.getElementById("cancelModal");
  const message = document.getElementById("cancelModalMessage");

  modal.classList.add("show");
}

function hideCancelModal() {
  document.getElementById("cancelModal").classList.remove("show");
}

function confirmCancel() {
  resetFormState();
  showListView();
  hideCancelModal();
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
    }) || leaseManager.uploadedFiles.length > 0
  );
}

function resetFormState() {
  clearForm();
  clearErrors();
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
  if (deleteLeaseId) {
    const deletedLease = leaseManager.deleteLease(deleteLeaseId);
    if (deletedLease) {
      showToast("Lease deleted successfully");
      loadLeaseTable();
    } else {
      showToast("Error deleting lease", "error");
    }
  }
  hideDeleteModal();
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

  title.textContent = type === "error" ? "Error!" : "Success!";
  messageEl.textContent = message;

  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

function generateContract() {
  showToast("Contract generation feature coming soon!");
}

function sendReminder() {
  showToast("Payment reminder sent successfully!");
}

function terminateLease() {
  if (confirm("Are you sure you want to terminate this lease?")) {
    showToast("Lease termination process initiated");
  }
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
window.generateContract = generateContract;
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
