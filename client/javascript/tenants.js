import formatDate from "../utils/formatDate.js";
import formatStatus from "../utils/formatStatus.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

let tenants = [];
let allTenants = [];
let selectedTenants = new Set();
let currentView = "list";
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let currentStep = 1;
let currentSort = "";
let selectedDocumentFiles = [];
const USER_ROLES = window.AppConstants.USER_ROLES;

const API_BASE_URL = "/api/v1";

document.addEventListener("DOMContentLoaded", function () {
  const requiredElements = [
    "gridView",
    "listView",
    "loadingState",
    "errorState",
    "searchInput",
    "statusFilter",
    "listSelectAll",
    "bulkActionsBar",
  ];
  requiredElements.forEach((id) => {
    const element = document.getElementById(id);
  });

  const statusBtn = document.getElementById("statusFilterBtn");
  const statusDropdown = document.getElementById("statusFilterDropdown");
  const statusLabel = document.getElementById("statusFilterLabel");

  if (statusBtn && statusDropdown) {
    statusBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      statusDropdown.style.display =
        statusDropdown.style.display === "block" ? "none" : "block";
      statusBtn.classList.toggle("active");
    });

    document
      .querySelectorAll("#statusFilterDropdown .dropdown-item")
      .forEach((item) => {
        item.addEventListener("click", function () {
          const value = this.getAttribute("data-value");
          document.getElementById("statusFilter").value = value;
          statusLabel.textContent = this.textContent;
          statusDropdown.style.display = "none";
          statusBtn.classList.remove("active");

          filterTenants();
        });
      });

    document.addEventListener("click", function () {
      statusDropdown.style.display = "none";
      statusBtn.classList.remove("active");
    });
  }

  const sortBtn = document.getElementById("sortFilterBtn");
  const sortDropdown = document.getElementById("sortFilterDropdown");
  const sortLabel = document.getElementById("sortFilterLabel");

  if (sortBtn && sortDropdown) {
    sortBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      sortDropdown.style.display =
        sortDropdown.style.display === "block" ? "none" : "block";
      sortBtn.classList.toggle("active");
    });

    sortDropdown.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", function () {
        const sortValue = this.getAttribute("data-sort");
        sortLabel.textContent = this.textContent;
        sortDropdown.style.display = "none";
        sortBtn.classList.remove("active");
        currentSort = sortValue;
        sortTenants();
      });
    });

    document.addEventListener("click", function () {
      sortDropdown.style.display = "none";
      sortBtn.classList.remove("active");
    });
  }
  // Default initial view: List
  try {
    const gridView = document.getElementById("gridView");
    const listView = document.getElementById("listView");
    if (gridView && listView) {
      gridView.style.display = "none";
      listView.style.display = "flex";
    }
    const buttons = document.querySelectorAll(".view-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));
    const listBtn = document.querySelector('.view-btn[data-view="list"]');
    if (listBtn) listBtn.classList.add("active");
  } catch (_) {}

  // Default status filter: ACTIVE
  try {
    const statusFilterInput = document.getElementById("statusFilter");
    const statusLabel = document.getElementById("statusFilterLabel");
    if (statusFilterInput) statusFilterInput.value = "ACTIVE";
    if (statusLabel) statusLabel.textContent = "Active";
  } catch (_) {}

  // Initial load with default filters
  loadTenants(1, { status: "ACTIVE" });
  updateSelectAllButton();
  setupEventListeners();
  setDynamicInfo();
});

document.addEventListener("DOMContentLoaded", function () {
  const tenantsBreadcrumbLink = document.getElementById(
    "tenantsBreadcrumbLink"
  );
  if (tenantsBreadcrumbLink) {
    tenantsBreadcrumbLink.addEventListener("click", function () {
      const formContainer = document.getElementById("tenantDetailsInlineForm");
      if (formContainer) formContainer.style.display = "none";
      const createAccount = document.getElementById(
        "createAccountInlineContainer"
      );
      if (createAccount) createAccount.style.display = "none";
      if (currentView === "grid") {
        document.getElementById("gridView").style.display = "grid";
        document.getElementById("listView").style.display = "none";
      } else {
        document.getElementById("gridView").style.display = "none";
        document.getElementById("listView").style.display = "flex";
      }
      const controlsRow = document.querySelector(".controls-row");
      if (controlsRow) controlsRow.style.display = "";
      const bulkActionsBar = document.getElementById("bulkActionsBar");
      if (bulkActionsBar) bulkActionsBar.style.display = "";
      const pagination = document.getElementById("pagination");
      if (pagination) pagination.style.display = "";
      const emptyState = document.getElementById("emptyState");
      if (emptyState) emptyState.style.display = "none";
    });
  }
});

async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `Tenants - ${company.company_name}`
    : "Tenants";
}

async function loadTenants(page = 1, filters = {}) {
  if (isLoading) return;

  try {
    isLoading = true;
    showLoadingState();

    if (currentSort) {
      filters.sort = currentSort;
    }

    const queryParams = new URLSearchParams({
      page: page,
      limit: 12,
      ...filters,
    });

    const response = await fetch(`${API_BASE_URL}/users?${queryParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.users) {
      tenants = result.users;
      allTenants = [...tenants];

      if (result.pagination) {
        currentPage = result.pagination.currentPage;
        totalPages = result.pagination.totalPages;
      }

      renderTenants();
      renderPagination();
      hideLoadingState();

      if (tenants.length === 0) {
        showEmptyState();
      }
    } else {
      console.error("No users property in response:", result);
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Error loading tenants:", error);
    showErrorState();
  } finally {
    isLoading = false;
  }
}

function renderTenants() {
  if (currentView === "grid") {
    renderGridView();
  } else {
    renderListView();
  }
  updateSelectAllButton();
  updateListSelectAll();
  updateBulkActionsBar();
}

function renderGridView() {
  const container = document.getElementById("gridView");

  if (tenants.length === 0) {
    container.innerHTML = "";
    return;
  }

  const cardsHTML = tenants
    .map((tenant) => {
      const suffix = tenant.suffix ? ` ${tenant.suffix}` : "";
      const fullName = `${tenant.first_name || ""} ${tenant.last_name || ""
        }${suffix}`.trim();
      const isSelected = selectedTenants.has(tenant.user_id);

      const avatarHTML = generateAvatarHTML(tenant);

      return `
        <div class="tenant-card ${isSelected ? "selected" : ""}" data-tenant="${tenant.user_id
        }" tabindex="0" title="Select tenant">
          <div class="tenant-card-header">
            <div class="tenant-info">
              <div class="tenant-avatar">
                ${avatarHTML}
              </div>
              <div class="tenant-details">
                <h4 title="${fullName || "No Name"}">${fullName || "No Name"
        }</h4>
                <div class="tenant-business">
                  ${tenant.business_name || "N/A"}
                </div>
              </div>
            </div>
          </div>
          <div class="tenant-card-body">
            <div class="tenant-meta-item">
              <span class="label">Phone:</span>
              <span class="value">${tenant.phone_number || "Not provided"
        }</span>
            </div>
            <div class="tenant-meta-item">
              <span class="label">Email:</span>
              <span class="value email-value" title="${tenant.email || "No Email"
        }">${tenant.email || "No Email"}</span>
            </div>
          </div>
          <div class="tenant-meta">
            <span class="status-badge status-${(
          tenant.status || "active"
        ).toLowerCase()}">
              ${formatStatus(tenant.status) || "Active"}
            </span>
            <div class="tenant-actions">
              <button class="action-btn" title="View Details" onclick="event.stopPropagation();viewTenantDetails('${tenant.user_id
        }')">
                <i class="fas fa-eye"></i>
              </button>
              <button class="action-btn" title="Edit" onclick="event.stopPropagation();openTenantDetailsInEditMode('${tenant.user_id
        }')">
              <i class="fas fa-edit"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = cardsHTML;
  setupGridEventListeners();
}

function renderListView() {
  const container = document.getElementById("listContainer");

  if (!container) {
    console.error("❌ listContainer not found in DOM!");
    return;
  }

  if (tenants.length === 0) {
    container.innerHTML = "";
    return;
  }

  const rowsHTML = tenants
    .map((tenant) => {
      const suffix = tenant.suffix ? ` ${tenant.suffix}` : "";
      const fullName = `${tenant.first_name || ""} ${tenant.last_name || ""
        }${suffix}`.trim();
      const isSelected = selectedTenants.has(tenant.user_id);
      const avatarHTML = generateAvatarHTML(tenant, "small");
      return `
        <div class="tenant-list-item ${isSelected ? "selected" : ""
        }" data-tenant="${tenant.user_id}">
          <div class="list-col list-col-checkbox">
            <input type="checkbox" class="list-checkbox" ${isSelected ? "checked" : ""
        }>
          </div>
          <div class="list-col list-col-name">
            <div class="tenant-info">
              <div class="tenant-avatar">
                ${avatarHTML}
              </div>
              <div style="margin-left: 0.5rem;">
                <div style="font-weight: 500;">${fullName || "No Name"}</div>
                <div style="font-size: 0.75rem; color: #6b7280;">
                  ${tenant.business_name || ""}
                </div>
              </div>
            </div>
          </div>
          <div class="list-col list-col-email">${tenant.email || "No Email"
        }</div>
          <div class="list-col list-col-phone">${tenant.phone_number || "Not provided"
        }</div>
          <div class="list-col list-col-status">
            <span class="status-badge status-${(
          tenant.status || "active"
        ).toLowerCase()}">
              ${formatStatus
          ? formatStatus(tenant.status)
          : tenant.status || "Active"
        }
            </span>
          </div>
          <div class="list-col list-col-created">
            ${formatDate ? formatDate(tenant.created_at) : tenant.created_at}
          </div>
          <div class="list-col list-col-actions">
            <button class="action-btn" onclick="viewTenantDetails('${tenant.user_id}')" title="View Details">
              <i class="fas fa-eye"></i>
            </button>
            <button class="action-btn" onclick="openTenantDetailsInEditMode('${tenant.user_id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn" onclick="deleteTenant('${tenant.user_id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = rowsHTML;
  setupListEventListeners();
}

function sortTenants() {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");

  const filters = {};
  if (searchInput && searchInput.value.trim())
    filters.search = searchInput.value.trim();
  if (statusFilter && statusFilter.value) filters.status = statusFilter.value;

  if (currentSort) filters.sort = currentSort;

  currentPage = 1;
  loadTenants(1, filters);
}

function viewTenantDetails(tenantId) {
  openTenantDetailsInlineForm(tenantId);
}

function updateBulkActionsBar() {
  const bulkActionsBar = document.getElementById("bulkActionsBar");
  const selectedCount = document.getElementById("selectedCount");

  if (!bulkActionsBar || !selectedCount) return;

  if (selectedTenants.size > 0) {
    bulkActionsBar.style.display = "flex";
    selectedCount.textContent = `${selectedTenants.size} selected`;
  } else {
    bulkActionsBar.style.display = "none";
  }
}

function clearSelection() {
  selectedTenants.clear();
  document.querySelectorAll(".tenant-card").forEach((card) => {
    card.classList.remove("selected");
    const checkbox = card.querySelector(".checkbox");
    if (checkbox) checkbox.checked = false;
  });
  document.querySelectorAll(".tenant-list-item").forEach((item) => {
    item.classList.remove("selected");
    const checkbox = item.querySelector(".list-checkbox");
    if (checkbox) checkbox.checked = false;
  });
  updateSelectAllButton();
  updateListSelectAll();
  updateBulkActionsBar();
}

function messageSelected() {
  if (selectedTenants.size === 0) {
    if (typeof window !== "undefined" && typeof window.showAlert === "function") {
      window.showAlert("Please select tenants to message.", "warning");
    } else {
      alert("Please select tenants to message.");
    }
    return;
  }

  const selectedIds = Array.from(selectedTenants);
  if (typeof window !== "undefined" && typeof window.showAlert === "function") {
    window.showAlert(`Messaging ${selectedTenants.size} selected tenant(s)`, "info");
  } else {
    alert(`Messaging ${selectedTenants.size} selected tenant(s)`);
  }
}

function exportSelected() {
  if (selectedTenants.size === 0) {
    if (typeof window !== "undefined" && typeof window.showAlert === "function") {
      window.showAlert("Please select tenants to export.", "warning");
    } else {
      alert("Please select tenants to export.");
    }
    return;
  }

  const selectedIds = Array.from(selectedTenants);
  if (typeof window !== "undefined" && typeof window.showAlert === "function") {
    window.showAlert(`Exporting ${selectedTenants.size} selected tenant(s)`, "info");
  } else {
    alert(`Exporting ${selectedTenants.size} selected tenant(s)`);
  }
}

function searchTenants() {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");

  if (!searchInput || !statusFilter) {
    console.error("Search elements not found");
    return;
  }

  const searchTerm = searchInput.value.trim();
  const statusValue = statusFilter.value;

  const filters = {};
  if (searchTerm) filters.search = searchTerm;
  if (statusValue) filters.status = statusValue;

  currentPage = 1;
  loadTenants(1, filters);
}

function filterTenants() {
  searchTenants();
}

function showError(input, message) {
  input.classList.add("is-invalid");
  let error = input.parentElement.querySelector(".invalid-feedback");
  if (!error) {
    error = document.createElement("div");
    error.className = "invalid-feedback";
    input.parentElement.appendChild(error);
  }
  error.textContent = message;
}

function clearError(input) {
  input.classList.remove("is-invalid");
  let error = input.parentElement.querySelector(".invalid-feedback");
  if (error) error.textContent = "";
}

function showLoadingState() {
  document.getElementById("loadingState").style.display = "flex";
  document.getElementById("errorState").style.display = "none";
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("gridView").style.display = "none";
  document.getElementById("listView").style.display = "none";
}

function hideLoadingState() {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("errorState").style.display = "none";
  document.getElementById("emptyState").style.display = "none";

  if (currentView === "grid") {
    document.getElementById("gridView").style.display = "grid";
    document.getElementById("listView").style.display = "none";
  } else {
    document.getElementById("gridView").style.display = "none";
    document.getElementById("listView").style.display = "flex";
  }
}

function showErrorState() {
  document.getElementById("errorState").style.display = "flex";
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("gridView").style.display = "none";
  document.getElementById("listView").style.display = "none";
  document.getElementById("emptyState").style.display = "none";
}

function showEmptyState() {
  document.getElementById("emptyState").style.display = "flex";
  document.getElementById("gridView").style.display = "none";
  document.getElementById("listView").style.display = "none";
}

function toggleView(viewType) {
  const buttons = document.querySelectorAll(".view-btn");
  const gridView = document.getElementById("gridView");
  const listView = document.getElementById("listView");

  buttons.forEach((btn) => btn.classList.remove("active"));
  const targetBtn = document.querySelector(`[data-view="${viewType}"]`);
  if (targetBtn) targetBtn.classList.add("active");

  currentView = viewType;

  if (viewType === "list") {
    gridView.style.display = "none";
    listView.style.display = "flex";
    renderListView();
  } else {
    gridView.style.display = "grid";
    listView.style.display = "none";
    renderGridView();
  }
}

function setupEventListeners() {
  let searchTimeout;
  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(searchTenants, 300);
    });

    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        clearTimeout(searchTimeout);
        searchTenants();
      }
    });
  }

  const statusFilter = document.getElementById("statusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", searchTenants);
  }

  const profileBtn = document.getElementById("profileBtnIcon");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (profileBtn && dropdownMenu) {
    profileBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdownMenu.style.display =
        dropdownMenu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", function () {
      dropdownMenu.style.display = "none";
    });
  }
}

function setupListEventListeners() {
  const listItems = document.querySelectorAll(".tenant-list-item");
  listItems.forEach((item) => {
    const checkbox = item.querySelector(".list-checkbox");
    if (checkbox) {
      checkbox.addEventListener("click", function (e) {
        e.stopPropagation();
        const tenantId = item.dataset.tenant;

        if (this.checked) {
          selectedTenants.add(tenantId);
          item.classList.add("selected");
        } else {
          selectedTenants.delete(tenantId);
          item.classList.remove("selected");
        }

        updateSelectAllButton();
        updateListSelectAll();
        updateBulkActionsBar();
      });
    }

    item.addEventListener("click", function (e) {
      if (
        e.target.classList.contains("action-btn") ||
        e.target.type === "checkbox" ||
        e.target.closest(".action-btn")
      ) {
        return;
      }

      const tenantId = item.dataset.tenant;
      const checkbox = item.querySelector(".list-checkbox");

      toggleTenantSelection(tenantId, item, checkbox);
      updateListSelectAll();
      updateBulkActionsBar();
    });
  });
}

function setupGridEventListeners() {
  const tenantCards = document.querySelectorAll(".tenant-card");
  tenantCards.forEach((card) => {
    card.addEventListener("click", function (e) {
      if (e.target.closest(".action-btn")) return;
      const tenantId = card.dataset.tenant;
      if (selectedTenants.has(tenantId)) {
        selectedTenants.delete(tenantId);
        card.classList.remove("selected");
      } else {
        selectedTenants.add(tenantId);
        card.classList.add("selected");
      }
      updateSelectAllButton();
      updateBulkActionsBar();
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        card.click();
      }
    });
  });
}

function toggleSelectAll() {
  const listSelectAll = document.getElementById("listSelectAll");

  if (listSelectAll && listSelectAll.checked) {
    selectedTenants.clear();
    tenants.forEach((tenant) => selectedTenants.add(tenant.user_id));
    document.querySelectorAll(".tenant-list-item").forEach((item) => {
      item.classList.add("selected");
      const checkbox = item.querySelector(".list-checkbox");
      if (checkbox) checkbox.checked = true;
    });
  } else {
    selectedTenants.clear();
    document.querySelectorAll(".tenant-list-item").forEach((item) => {
      item.classList.remove("selected");
      const checkbox = item.querySelector(".list-checkbox");
      if (checkbox) checkbox.checked = false;
    });
  }

  updateSelectAllButton();
  updateListSelectAll();
  updateBulkActionsBar();
}

function updateListSelectAll() {
  const listSelectAll = document.getElementById("listSelectAll");
  if (!listSelectAll) return;

  const totalTenants = tenants.length;

  if (selectedTenants.size === totalTenants && totalTenants > 0) {
    listSelectAll.checked = true;
    listSelectAll.indeterminate = false;
  } else if (selectedTenants.size > 0) {
    listSelectAll.checked = false;
    listSelectAll.indeterminate = true;
  } else {
    listSelectAll.checked = false;
    listSelectAll.indeterminate = false;
  }
}

function toggleTenantSelection(tenantId, element, checkbox) {
  if (selectedTenants.has(tenantId)) {
    selectedTenants.delete(tenantId);
    element.classList.remove("selected");
    checkbox.checked = false;
  } else {
    selectedTenants.add(tenantId);
    element.classList.add("selected");
    checkbox.checked = true;
  }

  updateSelectAllButton();
  updateBulkActionsBar();
}

function updateSelectAllButton() {
  const selectAllElements = document.querySelectorAll(
    "#selectAllCheckbox, .selectAllCheckbox"
  );
  const totalTenants = tenants.length;

  selectAllElements.forEach((selectAllCheckbox) => {
    if (selectedTenants.size === totalTenants && totalTenants > 0) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedTenants.size > 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  });
}

function selectAll() {
  const allSelected = selectedTenants.size === tenants.length;

  if (allSelected) {
    clearSelection();
  } else {
    selectedTenants.clear();
    tenants.forEach((tenant) => selectedTenants.add(tenant.user_id));

    document.querySelectorAll(".tenant-card").forEach((card) => {
      card.classList.add("selected");
      const checkbox = card.querySelector(".checkbox");
      if (checkbox) checkbox.checked = true;
    });

    document.querySelectorAll(".tenant-list-item").forEach((item) => {
      item.classList.add("selected");
      const checkbox = item.querySelector(".list-checkbox");
      if (checkbox) checkbox.checked = true;
    });

    updateSelectAllButton();
    updateListSelectAll();
    updateBulkActionsBar();
  }
}

function renderPagination() {
  const container = document.getElementById("pagination");

  if (totalPages <= 1) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";

  let paginationHTML = "";

  paginationHTML += `
    <button class="pagination-btn" ${currentPage === 1 ? "disabled" : ""
    } onclick="goToPage(${currentPage - 1})">
      ← Previous
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 2 && i <= currentPage + 2)
    ) {
      paginationHTML += `
        <button class="pagination-btn ${i === currentPage ? "active" : ""
        }" onclick="goToPage(${i})">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      paginationHTML += '<span class="pagination-ellipsis">...</span>';
    }
  }

  paginationHTML += `
    <button class="pagination-btn" ${currentPage === totalPages ? "disabled" : ""
    } onclick="goToPage(${currentPage + 1})">
      Next →
    </button>
  `;

  container.innerHTML = paginationHTML;
}

function getInitials(firstName, lastName) {
  const first = (firstName || "").charAt(0).toUpperCase();
  const last = (lastName || "").charAt(0).toUpperCase();
  return first + last || "??";
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages && page !== currentPage) {
    loadTenants(page);
  }
}

async function deleteTenant(tenantId) {
  const confirmFn =
    typeof window !== "undefined" && typeof window.showConfirm === "function"
      ? (msg, title) => window.showConfirm(msg, title)
      : (msg) => Promise.resolve(confirm(String(msg)));

  const ok = await confirmFn("Are you sure you want to delete this tenant?", "Delete tenant");
  if (!ok) return;

  // Build current filters so refresh respects search/status
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const filters = {};
  if (searchInput && searchInput.value.trim()) filters.search = searchInput.value.trim();
  if (statusFilter && statusFilter.value) filters.status = statusFilter.value;

  try {
    const resp = await fetch(`${API_BASE_URL}/users/${tenantId}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) {
      let msg = "Failed to delete tenant.";
      try {
        const data = await resp.json();
        if (data && data.message) msg = data.message;
      } catch (_) {}
      showTenantSnackbar(msg, "error");
      return;
    }

    showTenantSnackbar("Tenant deleted successfully.", "success");

    // If details view is open, close it
    const details = document.getElementById("tenantDetailsInlineForm");
    if (details && details.style.display !== "none") {
      try { closeTenantDetailsInlineForm(); } catch (_) {}
    }

    // Refresh current page; if empty and not first, go back a page
    await loadTenants(currentPage, filters);
    if (tenants.length === 0 && currentPage > 1) {
      await loadTenants(currentPage - 1, filters);
    }
  } catch (err) {
    console.error("Delete tenant error:", err);
    showTenantSnackbar("An error occurred while deleting the tenant.", "error");
  }
}

function openCreateAccountInline() {
  document.getElementById("createAccountInlineContainer").style.display =
    "block";
  const controlsRow = document.querySelector(".controls-row");
  if (controlsRow) controlsRow.style.display = "none";
  const breadcrumb = document.getElementById("tenantsBreadcrumbNav");
  if (breadcrumb) {
    breadcrumb.innerHTML = `
  <li class="breadcrumb-item" id="tenantsBreadcrumbLink" style="cursor:pointer; color: #959596ff; hover: color: #2563eb;">
    <i class="fas fa-users me-2"></i>Tenants
  </li>
  <li class="breadcrumb-divider"><span>›</span></li>
  <li class="breadcrumb-item active" aria-current="page">
    <i class="fas fa-user-edit me-2"></i> View Tenant Details
  </li>
`;
    attachTenantsBreadcrumbHandler();
  }
  if (document.getElementById("bulkActionsBar"))
    document.getElementById("bulkActionsBar").style.display = "none";
  if (document.getElementById("pagination"))
    document.getElementById("pagination").style.display = "none";
  if (document.getElementById("emptyState"))
    document.getElementById("emptyState").style.display = "none";
  if (document.getElementById("gridView"))
    document.getElementById("gridView").style.display = "none";
  if (document.getElementById("listView"))
    document.getElementById("listView").style.display = "none";

  currentStep = 1;
  updateStepDisplay();
  const profilePreview = document.querySelector(".profile-preview");
  if (profilePreview) {
    profilePreview.innerHTML =
      '<div class="profile-preview-content"><i class="fas fa-user-plus"></i><span>Add Photo</span></div>';
  }
}

function closeCreateAccountInline() {
  document.getElementById("createAccountInlineContainer").style.display =
    "none";
  const controlsRow = document.querySelector(".controls-row");
  if (controlsRow) controlsRow.style.display = "";
  const breadcrumb = document.getElementById("tenantsBreadcrumbNav");
  if (breadcrumb) {
    breadcrumb.innerHTML = `
            <li class="breadcrumb-item active" aria-current="page">
                <i class="fas fa-users me-2"></i> Tenants
            </li>
        `;
  }
  if (document.getElementById("bulkActionsBar"))
    document.getElementById("bulkActionsBar").style.display = "";
  if (document.getElementById("pagination"))
    document.getElementById("pagination").style.display = "";
  if (document.getElementById("gridView"))
    document.getElementById("gridView").style.display = "";
}

function isCreateAccountFormDirty() {
  const form = document.getElementById("createAccountForm");
  if (!form) return false;
  return Array.from(form.elements).some(
    (el) =>
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT") &&
      el.type !== "hidden" &&
      el.type !== "button" &&
      el.type !== "submit" &&
      el.value &&
      el.value.trim() !== ""
  );
}

function updateStepDisplay() {
  for (let i = 1; i <= 3; i++) {
    const step = document.getElementById(`step${i}`);
    const connector = document.getElementById(`connector${i}`);
    const formStep = document.getElementById(`formStep${i}`);

    if (i < currentStep) {
      step.className = "step completed";
      if (connector) connector.className = "step-connector completed";
    } else if (i === currentStep) {
      step.className = "step active";
      if (connector) connector.className = "step-connector";
    } else {
      step.className = "step inactive";
      if (connector) connector.className = "step-connector";
    }

    if (i === currentStep) {
      formStep.classList.add("active");
    } else {
      formStep.classList.remove("active");
    }
  }

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const confirmBtn = document.getElementById("confirmBtn");

  prevBtn.style.display = currentStep === 1 ? "none" : "block";

  if (currentStep === 3) {
    nextBtn.style.display = "none";
    confirmBtn.style.display = "block";
  } else {
    nextBtn.style.display = "block";
    confirmBtn.style.display = "none";
  }
}

function nextStep() {
  if (validateCurrentStep() && currentStep < 3) {
    currentStep++;
    updateStepDisplay();
  }
}

function previousStep() {
  if (currentStep > 1) {
    currentStep--;
    updateStepDisplay();
  }
}

function validateCurrentStep() {
  const currentFormStep = document.getElementById(`formStep${currentStep}`);
  const requiredFields = currentFormStep.querySelectorAll("input[required]");

  for (let field of requiredFields) {
    if (!field.value.trim()) {
      field.focus();
      field.style.borderColor = "#dc3545";
      setTimeout(() => {
        field.style.borderColor = "#e1e8ed";
      }, 3000);
      return false;
    }
  }

  if (currentStep === 3) {
    const password = document.getElementById("defaultPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const agreeTerms = document.getElementById("agreeTerms").checked;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      document.getElementById("confirmPassword").focus();
      return false;
    }

    if (!agreeTerms) {
      alert("Please agree to the terms and privacy policies");
      return false;
    }
  }

  return true;
}

function confirmAccount() {
  if (validateCurrentStep()) {
    const formData = new FormData(document.getElementById("createAccountForm"));
    const accountData = {};

    for (let [key, value] of formData.entries()) {
      accountData[key] = value;
    }

    alert("Tenant account created successfully!");

    closeCreateAccountModal();
    loadTenants();
  }
}

function togglePassword(fieldId, toggleBtn) {
  const field = document.getElementById(fieldId);
  const icon = toggleBtn.querySelector("i");

  if (field.type === "password") {
    field.type = "text";
    icon.className = "fas fa-eye-slash";
  } else {
    field.type = "password";
    icon.className = "fas fa-eye";
  }
}

function handleAvatarError(imgElement, initials) {
  imgElement.style.display = "none";
  const avatarContainer = imgElement.parentElement;

  let initialsDiv = avatarContainer.querySelector(".tenant-avatar-initials");
  if (!initialsDiv) {
    initialsDiv = document.createElement("div");
    initialsDiv.className = "tenant-avatar-initials";
    initialsDiv.textContent = initials;
    avatarContainer.appendChild(initialsDiv);
  }

  initialsDiv.style.display = "flex";
}

function getPlaceholderAvatar(name, size = 48) {
  const colors = [
    "#667eea",
    "#764ba2",
    "#f093fb",
    "#f5576c",
    "#4facfe",
    "#00f2fe",
    "#43e97b",
    "#38f9d7",
    "#ffecd2",
    "#fcb69f",
    "#a8edea",
    "#fed6e3",
  ];

  const initials = getInitials(name?.split(" ")[0], name?.split(" ")[1]);
  const colorIndex = (name || "").length % colors.length;
  const backgroundColor = colors[colorIndex];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    initials
  )}&size=${size}&background=${backgroundColor.replace(
    "#",
    ""
  )}&color=ffffff&bold=true`;
}

function generateAvatarHTML(tenant, size = "normal") {
  const initials = getInitials(tenant.first_name, tenant.last_name);
  const fullName = `${tenant.first_name || ""} ${tenant.last_name || ""
    }`.trim();
  const imageSize = size === "small" ? 32 : 48;

  let avatarSrc = tenant.avatar;
  if (!avatarSrc || avatarSrc.trim() === "") {
    avatarSrc = getPlaceholderAvatar(fullName, imageSize);
  }

  return `
    <img src="${avatarSrc}" 
         alt="${fullName}" 
         class="tenant-avatar-img"
         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
         onload="this.style.display='block'; this.nextElementSibling.style.display='none';">
    <div class="tenant-avatar-initials" style="display: none;">${initials}</div>
  `;
}

function validateName(input) {
  if (!input.value.trim()) {
    showError(input, "This field is required.");
    return false;
  }
  clearError(input);
  return true;
}
function validateEmail(input) {
  if (!input.value.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(input.value.trim())) {
    showError(input, "Enter a valid email address.");
    return false;
  }
  clearError(input);
  return true;
}
function validatePHMobile(input, required = false) {
  if (!input.value.trim() && !required) {
    clearError(input);
    return true;
  }
  if (!/^(\+63|0)9\d{9}$/.test(input.value.trim())) {
    showError(input, "Enter a valid PH mobile number.");
    return false;
  }
  clearError(input);
  return true;
}
function validatePassword(input) {
  const value = input.value || "";
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\\/]/.test(value);

  let message = "";
  if (value.length < minLength) {
    message = "Password must be at least 8 characters.";
  } else if (!hasUpper) {
    message = "Password must include at least one uppercase letter.";
  } else if (!hasLower) {
    message = "Password must include at least one lowercase letter.";
  } else if (!hasDigit) {
    message = "Password must include at least one digit.";
  } else if (!hasSpecial) {
    message = "Password must include at least one special character.";
  }

  if (message) {
    showError(input, message);
    return false;
  }
  clearError(input);
  return true;
}
function validateConfirmPassword(pwd, confirm) {
  if (pwd.value !== confirm.value) {
    showError(confirm, "Passwords do not match.");
    return false;
  }
  clearError(confirm);
  return true;
}
function validateBirthdate(input) {
  if (!input.value) {
    clearError(input);
    return true;
  }
  const bday = new Date(input.value);
  const today = new Date();
  const age =
    today.getFullYear() -
    bday.getFullYear() -
    (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
      ? 1
      : 0);
  if (age < 18) {
    showError(input, "Tenant must be at least 18 years old.");
    return false;
  }
  clearError(input);
  return true;
}

function validateHouseNo(input) {
  if (!input.value.trim()) {
    showError(input, "This field is required.");
    return false;
  }
  clearError(input);
  return true;
}
function validateStreet(input) {
  if (!input.value.trim()) {
    showError(input, "This field is required.");
    return false;
  }
  clearError(input);
  return true;
}
function validateCity(input) {
  if (!input.value.trim()) {
    showError(input, "This field is required.");
    return false;
  }
  clearError(input);
  return true;
}
function validateProvince(input) {
  if (!input.value.trim()) {
    showError(input, "This field is required.");
    return false;
  }
  clearError(input);
  return true;
}
function validateZipCode(input) {
  if (!input.value.trim()) {
    showError(input, "This field is required.");
    return false;
  }
  clearError(input);
  return true;
}

function setupCreateAccountInlineForm() {
  const form = document.getElementById("createAccountForm");
  if (!form) return;

  const documentUpload = document.getElementById("documentUpload");
  const docPreview = document.getElementById("documentPreview");
  if (documentUpload && docPreview) {
    selectedDocumentFiles = [];

    documentUpload.addEventListener("change", function () {
      const newFiles = Array.from(documentUpload.files);

      let combined = selectedDocumentFiles.concat(newFiles);

      combined = combined.filter(
        (file, idx, arr) =>
          arr.findIndex((f) => f.name === file.name && f.size === file.size) ===
          idx
      );

      if (combined.length > 4) {
        showError(documentUpload, "You can only upload up to 4 files.");
        documentUpload.value = "";
        return;
      }

      selectedDocumentFiles = combined;
      renderDocumentPreview();
      documentUpload.value = "";
      clearError(documentUpload);
    });

    function renderDocumentPreview() {
      docPreview.innerHTML = "";
      selectedDocumentFiles.forEach((file, idx) => {
        const ext = file.name.split(".").pop().toLowerCase();
        let thumb;
        if (["jpg", "jpeg", "png"].includes(ext)) {
          thumb = document.createElement("div");
          thumb.className = "doc-thumb";
          thumb.style.position = "relative";
          thumb.innerHTML = `
            <img src="${URL.createObjectURL(file)}">
            <button type="button" class="remove-doc-btn" title="Remove" style="
              position:absolute;top:2px;right:2px;background:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;box-shadow:0 1px 4px #0001;display:flex;align-items:center;justify-content:center;padding:0;">
              <i class="fas fa-times" style="color:#dc2626;font-size:14px;"></i>
            </button>
          `;
        } else if (ext === "pdf") {
          thumb = document.createElement("div");
          thumb.className = "doc-thumb pdf-thumb";
          thumb.style.position = "relative";
          thumb.innerHTML = `
            <i class="fas fa-file-pdf" style="font-size:40px;color:#d9534f;"></i>
            <button type="button" class="remove-doc-btn" title="Remove" style="
              position:absolute;top:2px;right:2px;background:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;box-shadow:0 1px 4px #0001;display:flex;align-items:center;justify-content:center;padding:0;">
              <i class="fas fa-times" style="color:#dc2626;font-size:14px;"></i>
            </button>
          `;
        } else {
          return;
        }
        thumb
          .querySelector(".remove-doc-btn")
          .addEventListener("click", (e) => {
            e.stopPropagation();
            selectedDocumentFiles.splice(idx, 1);
            renderDocumentPreview();
          });
        docPreview.appendChild(thumb);
      });
      docPreview.style.display = selectedDocumentFiles.length ? "flex" : "none";
    }
  }

  const profileUpload = document.getElementById("profileUpload");
  if (profileUpload) {
    profileUpload.addEventListener("change", function (e) {
      const file = e.target.files[0];
      const preview = document.querySelector(".profile-preview");
      if (file && preview) {
        const reader = new FileReader();
        reader.onload = function (e) {
          preview.innerHTML = `<img src="${e.target.result}" alt="Profile Preview">`;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const birthDate = document.getElementById("birthDate");
  if (birthDate) {
    const today = new Date();
    const minYear = today.getFullYear() - 100;
    const maxDate = new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate()
    );
    birthDate.max = maxDate.toISOString().split("T")[0];
    birthDate.min = `${minYear}-01-01`;
  }

  const genBtn = document.getElementById("generatePasswordBtn");
  if (genBtn) {
    genBtn.addEventListener("click", function () {
      const pwd = generatePassword();
      form.defaultPassword.value = pwd;
      form.confirmPassword.value = pwd;
    });
  }

  genBtn.addEventListener("click", function () {
    const pwd = generatePassword();
    form.defaultPassword.value = pwd;
    form.confirmPassword.value = pwd;
    form.defaultPassword.dispatchEvent(new Event("input"));
    form.confirmPassword.dispatchEvent(new Event("input"));
  });

  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function (e) {
      if (isCreateAccountFormDirty()) {
        if (
          !confirm(
            "You have unsaved changes. Are you sure you want to cancel and lose your changes?"
          )
        ) {
          e.preventDefault();
          return;
        }
      }
      form.reset();
      if (docPreview) docPreview.innerHTML = "";
      document
        .querySelectorAll(".is-invalid")
        .forEach((el) => el.classList.remove("is-invalid"));
      document
        .querySelectorAll(".invalid-feedback")
        .forEach((el) => (el.textContent = ""));
      closeCreateAccountInline();
    });
  }

  function filterNameInput(e) {
    e.target.value = e.target.value.replace(/[^a-zA-Z\s\-]/g, "");
  }

  function filterNumberInput(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
  }

  form.firstName.addEventListener("input", filterNameInput);
  form.middleName.addEventListener("input", filterNameInput);
  form.lastName.addEventListener("input", filterNameInput);
  form.suffix.addEventListener("input", filterNameInput);

  if (form.zipCode) form.zipCode.addEventListener("input", filterNumberInput);
  if (form.mobileNumber)
    form.mobileNumber.addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/[^0-9\+]/g, "");
    });
  if (form.altMobileNumber)
    form.altMobileNumber.addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/[^0-9\+]/g, "");
    });
  if (form.emergencyNumber)
    form.emergencyNumber.addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/[^0-9\+]/g, "");
    });

  form.firstName.addEventListener("input", () => validateName(form.firstName));
  form.lastName.addEventListener("input", () => validateName(form.lastName));
  form.email.addEventListener("input", () => validateEmail(form.email));
  form.mobileNumber.addEventListener("input", () =>
    validatePHMobile(form.mobileNumber, true)
  );
  form.altMobileNumber.addEventListener("input", () =>
    validatePHMobile(form.altMobileNumber)
  );
  form.defaultPassword.addEventListener("input", () =>
    validatePassword(form.defaultPassword)
  );
  form.confirmPassword.addEventListener("input", () =>
    validateConfirmPassword(form.defaultPassword, form.confirmPassword)
  );
  form.birthDate.addEventListener("change", () =>
    validateBirthdate(form.birthDate)
  );
  if (documentUpload) {
    documentUpload.addEventListener("change", function () {
      if (documentUpload.files.length > 4) {
        showError(documentUpload, "You can only upload up to 4 files.");
      } else {
        clearError(documentUpload);
      }
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const createBtn = document.getElementById("confirmBtn");
    if (createBtn) {
      createBtn.classList.add("btn-loading");
      createBtn.disabled = true;
      createBtn.innerHTML = `<span class="spinner"></span>Creating...`;
    }

    let valid =
      validateName(form.firstName) &
      validateName(form.lastName) &
      validateEmail(form.email) &
      validatePHMobile(form.mobileNumber, true) &
      validatePassword(form.defaultPassword) &
      validateConfirmPassword(form.defaultPassword, form.confirmPassword) &
      validateBirthdate(form.birthDate);

    if (!valid) {
      return;
    }

    const address = {
      house_no: form.houseNo ? form.houseNo.value : "",
      street_address: form.street ? form.street.value : "",
      city: form.city ? form.city.value : "",
      province: form.province ? form.province.value : "",
      zip_code: form.zipCode ? form.zipCode.value : "",
      country: form.country ? form.country.value : "",
    };

    const emergency_contacts = [];
    if (
      (form.emergencyName && form.emergencyName.value) ||
      (form.emergencyNumber && form.emergencyNumber.value) ||
      (form.emergencyRelationship && form.emergencyRelationship.value)
    ) {
      emergency_contacts.push({
        contact_name: form.emergencyName ? form.emergencyName.value : "",
        contact_phone: form.emergencyNumber ? form.emergencyNumber.value : "",
        contact_relationship: form.emergencyRelationship
          ? form.emergencyRelationship.value
          : "",
      });
    }

    const formData = new FormData();

    formData.append("first_name", form.firstName.value);
    formData.append(
      "middle_name",
      form.middleName ? form.middleName.value : ""
    );
    formData.append("last_name", form.lastName.value);
    formData.append("suffix", form.suffix ? form.suffix.value : "");
    formData.append("birthdate", form.birthDate.value);
    formData.append("gender", form.gender ? form.gender.value : "");
    formData.append("email", form.email.value);
    formData.append("phone_number", form.mobileNumber.value);
    formData.append(
      "alt_phone_number",
      form.altMobileNumber ? form.altMobileNumber.value : ""
    );
    formData.append("password", form.defaultPassword.value);
    formData.append("role", USER_ROLES.TENANT);
    formData.append("status", "ACTIVE");
    formData.append("address", JSON.stringify(address));
    formData.append("emergency_contacts", JSON.stringify(emergency_contacts));

    if (profileUpload && profileUpload.files.length > 0) {
      formData.append("avatar", profileUpload.files[0]);
    }
    if (selectedDocumentFiles && selectedDocumentFiles.length > 0) {
      selectedDocumentFiles.forEach((file) => {
        formData.append("tenant_id_file", file);
      });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/create-user`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        showTenantSnackbar(
          error.message || "Failed to create tenant.",
          "error"
        );
        if (createBtn) {
          createBtn.classList.remove("btn-loading");
          createBtn.disabled = false;
          createBtn.innerHTML = `<i class="fas fa-check"></i> Create Account`;
        }
        return;
      }

      showTenantSnackbar("Tenant account created successfully!", "success");
      clearSavedFormData();
      form.reset();
      currentStep = 1;
      updateStepDisplay();
      if (docPreview) docPreview.innerHTML = "";
      document
        .querySelectorAll(".is-invalid")
        .forEach((el) => el.classList.remove("is-invalid"));
      document
        .querySelectorAll(".invalid-feedback")
        .forEach((el) => (el.textContent = ""));
      closeCreateAccountInline();
      loadTenants();
    } catch (err) {
      showTenantSnackbar(
        "An error occurred while creating the tenant.",
        "error"
      );
      console.error(err);
      if (createBtn) {
        createBtn.classList.remove("btn-loading");
        createBtn.disabled = false;
        createBtn.innerHTML = `<i class="fas fa-check"></i> Create Account`;
      }
    }
  });
}

function generatePassword(length = 12) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const specials = "!@#$%^&*()_+-=[]{}|;:',.<>/?";
  const all = upper + lower + digits + specials;

  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];

  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  pwd = pwd.sort(() => Math.random() - 0.5);

  return pwd.join("");
}

function autoSaveFormData() {
  const form = document.getElementById("createAccountForm");
  if (!form) return;

  const formData = new FormData(form);
  const data = {};
  for (let [key, value] of formData.entries()) {
    if (typeof value === "string") {
      data[key] = value;
    }
  }
  try {
    sessionStorage.setItem("tenantFormData", JSON.stringify(data));
  } catch (e) { }
}

function loadSavedFormData() {
  try {
    const savedData = sessionStorage.getItem("tenantFormData");
    if (savedData) {
      const data = JSON.parse(savedData);
      Object.keys(data).forEach((key) => {
        const field = document.querySelector(`[name="${key}"]`);
        if (field && field.type !== "file") {
          field.value = data[key];
        }
      });
    }
  } catch (e) { }
}

function clearSavedFormData() {
  try {
    sessionStorage.removeItem("tenantFormData");
  } catch (e) { }
}

function showTenantSnackbar(message, type = "success") {
  const existing = document.getElementById("tenantSnackbar");
  if (existing) existing.remove();

  const snackbar = document.createElement("div");
  snackbar.id = "tenantSnackbar";
  snackbar.style.cssText = `
    position: fixed;
    top: 24px;
    right: 24px;
    background: linear-gradient(135deg, ${type === "success"
      ? "#10b981 0%, #059669 100%"
      : "#ef4444 0%, #dc2626 100%"
    });
    color: white;
    padding: 15px 24px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(${type === "success" ? "16,185,129" : "239,68,68"
    },0.18);
    z-index: 1000000;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: tenantSnackbarIn 0.3s ease;
  `;
  snackbar.innerHTML = `
    <i class="fas ${type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
    } me-2"></i>${message}
  `;

  document.body.appendChild(snackbar);

  setTimeout(
    () => {
      snackbar.style.animation = "tenantSnackbarOut 0.3s ease";
      setTimeout(() => snackbar.remove(), 300);
    },
    type === "success" ? 5000 : 7000
  );
}

function attachTenantsBreadcrumbHandler() {
  const tenantsBreadcrumbLink = document.getElementById(
    "tenantsBreadcrumbLink"
  );
  if (tenantsBreadcrumbLink) {
    tenantsBreadcrumbLink.addEventListener("click", function (e) {
      const form = document.getElementById("createAccountForm");
      if (form && form.offsetParent !== null && isCreateAccountFormDirty()) {
        if (
          !confirm(
            "You have unsaved changes. Are you sure you want to leave this page?"
          )
        ) {
          e.preventDefault();
          return;
        }
      }
      const formContainer = document.getElementById("tenantDetailsInlineForm");
      if (formContainer) formContainer.style.display = "none";
      const createAccount = document.getElementById(
        "createAccountInlineContainer"
      );
      if (createAccount) createAccount.style.display = "none";
      if (currentView === "grid") {
        document.getElementById("gridView").style.display = "grid";
        document.getElementById("listView").style.display = "none";
      } else {
        document.getElementById("gridView").style.display = "none";
        document.getElementById("listView").style.display = "flex";
      }
      const controlsRow = document.querySelector(".controls-row");
      if (controlsRow) controlsRow.style.display = "";
      const bulkActionsBar = document.getElementById("bulkActionsBar");
      if (bulkActionsBar) bulkActionsBar.style.display = "";
      const pagination = document.getElementById("pagination");
      if (pagination) pagination.style.display = "";
      const emptyState = document.getElementById("emptyState");
      if (emptyState) emptyState.style.display = "none";
    });
  }
}

/**
 * Show the inline tenant details form for editing.
 * @param {string} tenantId
 */
async function openTenantDetailsInlineForm(tenantId) {
  document.getElementById("gridView").style.display = "none";
  document.getElementById("listView").style.display = "none";
  const controlsRow = document.querySelector(".controls-row");
  if (controlsRow) controlsRow.style.display = "none";
  const bulkActionsBar = document.getElementById("bulkActionsBar");
  if (bulkActionsBar) bulkActionsBar.style.display = "none";
  const pagination = document.getElementById("pagination");
  if (pagination) pagination.style.display = "none";
  const emptyState = document.getElementById("emptyState");
  if (emptyState) emptyState.style.display = "none";

  const formContainer = document.getElementById("tenantDetailsInlineForm");
  if (formContainer) formContainer.style.display = "block";

  const breadcrumb = document.getElementById("tenantsBreadcrumbNav");
  if (breadcrumb) {
    breadcrumb.innerHTML = `
  <li class="breadcrumb-item" id="tenantsBreadcrumbLink" style="cursor:pointer; color: #959596ff; hover: color: #2563eb;">
    <i class="fas fa-users me-2"></i>Tenants
  </li>
  <li class="breadcrumb-divider"><span>›</span></li>
  <li class="breadcrumb-item active" aria-current="page">
    <i class="fas fa-user-edit me-2"></i> View Tenant Details
  </li>
`;
    attachTenantsBreadcrumbHandler();
  }

  try {
    const response = await fetch(`/api/v1/users/${tenantId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Failed to fetch tenant details");
    const tenant = await response.json();

    window.currentTenantFiles = (tenant.tenant_id_files || []).map((f) => ({
      ...f,
    }));

    populateEditTenantFormWithFullData(tenant);

    renderTenantIdFiles(window.currentTenantFiles, false);

    setTenantDetailsEditMode(false);
  } catch (err) {
    showTenantSnackbar("Failed to load tenant details.", "error");
    closeTenantDetailsInlineForm();
  }
}

/**
 * Render tenant ID files and upload UI in edit mode.
 * @param {Array} files
 * @param {boolean} editable
 */
function renderTenantIdFiles(files, editable = false) {
  const container = document.getElementById("tenantIdFilesList");
  if (!container) return;
  container.innerHTML = "";

  const listDiv = document.createElement("div");
  listDiv.className = "tenant-id-files-list";

  files.forEach((file, idx) => {
    const ext = file.id_url.split(".").pop().toLowerCase();
    const fileName = file.id_url.split("/").pop();
    let fileThumb = document.createElement("div");
    fileThumb.className = "tenant-id-file-thumb";
    fileThumb.style.position = "relative";

    if (["jpg", "jpeg", "png"].includes(ext)) {
      fileThumb.innerHTML = `
        <a href="${file.id_url}" target="_blank" style="display:block;width:100%;height:100%;">
          <img src="${file.id_url}" alt="ID File">
        </a>
      `;
    } else if (ext === "pdf") {
      fileThumb.innerHTML = `
        <a href="${file.id_url}" target="_blank" style="display:block;width:100%;height:100%;text-align:center;">
          <i class="fas fa-file-pdf"></i>
          <div class="tenant-id-file-label">${fileName}</div>
        </a>
      `;
    } else {
      fileThumb.innerHTML = `
        <a href="${file.id_url}" target="_blank">${fileName}</a>
      `;
    }

    if (editable) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-doc-btn";
      removeBtn.title = "Remove";
      removeBtn.innerHTML = `<i class="fas fa-times"></i>`;
      removeBtn.style.position = "absolute";
      removeBtn.style.top = "8px";
      removeBtn.style.right = "8px";
      removeBtn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        files.splice(idx, 1);
        renderTenantIdFiles(files, true);
      };
      fileThumb.appendChild(removeBtn);
    }

    listDiv.appendChild(fileThumb);
  });

  if (editable) {
    const uploadThumb = document.createElement("div");
    uploadThumb.className = "tenant-id-file-thumb";
    uploadThumb.style.display = "flex";
    uploadThumb.style.alignItems = "center";
    uploadThumb.style.justifyContent = "center";
    uploadThumb.style.cursor = "pointer";
    uploadThumb.innerHTML = `
    <label style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:pointer;">
      <i class="fas fa-plus" style="font-size:2rem;color:#2563eb;"></i>
      <span style="font-size:0.95rem;color:#2563eb;">Add ID File</span>
      <input type="file" id="editTenantIdFileInput" accept="image/*,application/pdf" style="display:none" multiple>
    </label>
  `;
    uploadThumb.querySelector("input").addEventListener("change", function (e) {
      const newFiles = Array.from(e.target.files);
      newFiles.forEach((file) => {
        const ext = file.name.split(".").pop().toLowerCase();
        let id_url = "";
        if (["jpg", "jpeg", "png"].includes(ext)) {
          id_url = URL.createObjectURL(file);
        } else if (ext === "pdf") {
          id_url = URL.createObjectURL(file);
        }
        files.push({
          id_url,
          name: file.name,
          _file: file,
          _isNew: true,
        });
      });
      renderTenantIdFiles(files, true);
    });
    listDiv.appendChild(uploadThumb);
  }

  container.appendChild(listDiv);
}

function renderEditAvatarPreview(avatarUrl, firstName, lastName) {
  const preview = document.getElementById("editAvatarPreview");
  if (!preview) return;

  preview.innerHTML = "";

  if (avatarUrl && avatarUrl.trim() !== "") {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = "Avatar";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "50%";
    img.style.display = "block";
    img.onerror = function () {
      preview.innerHTML = `<div class="profile-preview-content">${getInitials(
        firstName,
        lastName
      )}</div>`;
    };
    preview.appendChild(img);
  } else {
    preview.innerHTML = `
      <div class="profile-preview-content">
        <i class="fas fa-user-plus"></i>
        <span>Add Photo</span>
      </div>
    `;
  }
}

function populateEditTenantFormWithFullData(tenant) {
  document.querySelector('[data-field="firstName"]').textContent =
    tenant.first_name || "";
  document.querySelector('[data-field="middleName"]').textContent =
    tenant.middle_name || "";
  document.querySelector('[data-field="lastName"]').textContent =
    tenant.last_name || "";
  document.querySelector('[data-field="suffix"]').textContent =
    tenant.suffix || "";
  document.querySelector('[data-field="birthDate"]').textContent =
    tenant.birthdate ? tenant.birthdate.split("T")[0] : "";
  document.querySelector('[data-field="gender"]').textContent =
    tenant.gender || "";
  document.querySelector('[data-field="phoneNumber"]').textContent =
    tenant.phone_number || "";
  document.querySelector('[data-field="altPhoneNumber"]').textContent =
    tenant.alt_phone_number || "";
  document.querySelector('[data-field="email"]').textContent =
    tenant.email || "";
  document.querySelector('[data-field="houseNo"]').textContent =
    tenant.address?.house_no || "";
  document.querySelector('[data-field="street"]').textContent =
    tenant.address?.street_address || "";
  document.querySelector('[data-field="city"]').textContent =
    tenant.address?.city || "";
  document.querySelector('[data-field="province"]').textContent =
    tenant.address?.province || "";
  document.querySelector('[data-field="zipCode"]').textContent =
    tenant.address?.zip_code || "";
  document.querySelector('[data-field="country"]').textContent =
    tenant.address?.country || "";
  document.querySelector('[data-field="emergencyName"]').textContent =
    tenant.emergency_contacts?.[0]?.contact_name || "";
  document.querySelector('[data-field="emergencyNumber"]').textContent =
    tenant.emergency_contacts?.[0]?.contact_phone || "";
  document.querySelector('[data-field="emergencyRelationship"]').textContent =
    tenant.emergency_contacts?.[0]?.contact_relationship || "";
  document.querySelector('[data-field="status"]').textContent =
    tenant.status || "ACTIVE";
  document.querySelector('[data-field="role"]').textContent =
    tenant.role || USER_ROLES.TENANT;

  renderEditAvatarPreview(tenant.avatar, tenant.first_name, tenant.last_name);
  document.getElementById("tenantNameDisplay").textContent =
    `${tenant.first_name || ""} ${tenant.last_name || ""}`.trim() ||
    "Tenant Details";
  document.getElementById("tenantEmailDisplay").textContent =
    tenant.email || "";

  const form = document.getElementById("editTenantForm");
  if (!form) return;
  form.setAttribute("data-tenant-id", tenant.user_id || "");
  form.firstName.value = tenant.first_name || "";
  form.middleName.value = tenant.middle_name || "";
  form.lastName.value = tenant.last_name || "";
  form.suffix.value = tenant.suffix || "";
  form.birthDate.value = tenant.birthdate ? tenant.birthdate.split("T")[0] : "";
  form.gender.value = tenant.gender || "";
  form.phoneNumber.value = tenant.phone_number || "";
  form.altPhoneNumber.value = tenant.alt_phone_number || "";
  form.email.value = tenant.email || "";
  form.houseNo.value = tenant.address?.house_no || "";
  form.street.value = tenant.address?.street_address || "";
  form.city.value = tenant.address?.city || "";
  form.province.value = tenant.address?.province || "";
  form.zipCode.value = tenant.address?.zip_code || "";
  form.country.value = tenant.address?.country || "";
  form.emergencyName.value = tenant.emergency_contacts?.[0]?.contact_name || "";
  form.emergencyNumber.value =
    tenant.emergency_contacts?.[0]?.contact_phone || "";
  form.emergencyRelationship.value =
    tenant.emergency_contacts?.[0]?.contact_relationship || "";
  form.status.value = tenant.status || "ACTIVE";
  form.role.value = tenant.role || USER_ROLES.TENANT;
}

/**
 * Toggle between view and edit mode for tenant details.
 * @param {boolean} editable
 */
function setTenantDetailsEditMode(editable) {
  document.querySelectorAll(".tenant-details-value").forEach((el) => {
    el.style.display = editable ? "none" : "block";
  });
  document.querySelectorAll(".tenant-details-input").forEach((el) => {
    el.style.display = editable ? "block" : "none";
    el.disabled = !editable;
  });

  const avatarUploadWrapper = document.getElementById(
    "editAvatarUploadWrapper"
  );
  if (avatarUploadWrapper) {
    avatarUploadWrapper.style.display = editable ? "block" : "none";
  }

  const roleInput = document.getElementById("editTenantForm")?.role;
  if (roleInput) {
    roleInput.disabled = true;
    roleInput.style.background = "#f3f4f6";
    roleInput.style.cursor = "not-allowed";
  }

  const countryInput = document.getElementById("editTenantForm")?.country;
  if (countryInput) {
    countryInput.disabled = true;
    countryInput.style.background = "#f3f4f6";
  }

  const footer = document.querySelector(".tenant-details-footer");
  if (footer) {
    if (editable) {
      footer.style.display = "flex";
      footer.classList.add("sticky-footer");
    } else {
      footer.style.display = "none";
      footer.classList.remove("sticky-footer");
    }
  }

  const editBtn = document.getElementById("editUserBtn");
  if (editBtn) editBtn.disabled = editable;

  if (!editable) {
    document
      .querySelectorAll("#editTenantForm .is-invalid")
      .forEach((el) => el.classList.remove("is-invalid"));
    document
      .querySelectorAll("#editTenantForm .invalid-feedback")
      .forEach((el) => (el.textContent = ""));
  }

  if (window.currentTenantFiles) {
    renderTenantIdFiles(window.currentTenantFiles, editable);
  }

  if (editable) {
    const avatarInput = document.getElementById("editAvatarUpload");
    const preview = document.getElementById("editAvatarPreview");
    if (avatarInput && preview) {
      avatarInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Avatar Preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }
}

/**
 * Handler for Edit User button.
 */
function toggleEditTenantForm(editable) {
  setTenantDetailsEditMode(editable);
}

/**
 * Handler for Delete button in details view.
 */
function deleteTenantFromDetails() {
  const email = document.getElementById("tenantEmailDisplay").textContent;
  if (confirm(`Are you sure you want to delete this tenant (${email})?`)) {
    const tenant = tenants.find((t) => t.email === email);
    if (tenant) deleteTenant(tenant.user_id);
  }
}

function closeTenantDetailsInlineForm() {
  const formContainer = document.getElementById("tenantDetailsInlineForm");
  if (formContainer) formContainer.style.display = "none";

  if (currentView === "grid") {
    document.getElementById("gridView").style.display = "grid";
    document.getElementById("listView").style.display = "none";
  } else {
    document.getElementById("gridView").style.display = "none";
    document.getElementById("listView").style.display = "flex";
  }
  const controlsRow = document.querySelector(".controls-row");
  if (controlsRow) controlsRow.style.display = "";
  const bulkActionsBar = document.getElementById("bulkActionsBar");
  if (bulkActionsBar) bulkActionsBar.style.display = "";
  const pagination = document.getElementById("pagination");
  if (pagination) pagination.style.display = "";

  const breadcrumb = document.getElementById("tenantsBreadcrumbNav");
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <li class="breadcrumb-item active" aria-current="page">
        <i class="fas fa-users me-2"></i> Tenants
      </li>
    `;
  }
}

async function handleEditTenantFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("editTenantForm");
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.classList.add("btn-loading");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span>Saving...`;
  }

  const formData = new FormData();
  formData.set("first_name", form.firstName.value);
  formData.set("middle_name", form.middleName.value);
  formData.set("last_name", form.lastName.value);
  formData.set("suffix", form.suffix.value);
  formData.set("birthdate", form.birthDate.value);
  formData.set("gender", form.gender.value);
  formData.set("email", form.email.value);
  formData.set("phone_number", form.phoneNumber.value);
  formData.set("alt_phone_number", form.altPhoneNumber.value);
  formData.set("status", form.status.value);

  const address = {
    house_no: form.houseNo.value,
    street_address: form.street.value,
    city: form.city.value,
    province: form.province.value,
    zip_code: form.zipCode.value,
    country: form.country.value,
  };
  formData.set("address", JSON.stringify(address));

  const emergency_contacts = [
    {
      contact_name: form.emergencyName.value,
      contact_phone: form.emergencyNumber.value,
      contact_relationship: form.emergencyRelationship.value,
    },
  ];
  formData.set("emergency_contacts", JSON.stringify(emergency_contacts));

  const avatarInput = document.getElementById("editAvatarUpload");
  if (avatarInput && avatarInput.files && avatarInput.files.length > 0) {
    formData.set("avatar", avatarInput.files[0]);
  }

  let tenantIdFiles = [];
  if (window.currentTenantFiles && window.currentTenantFiles.length > 0) {
    tenantIdFiles = window.currentTenantFiles
      .filter((f) => f.id_url && !f._file)
      .map((f) => ({ id_url: f.id_url }));

    window.currentTenantFiles
      .filter((f) => f._file)
      .forEach((f) => {
        formData.append("tenant_id_file", f._file);
        tenantIdFiles.push({ id_url: f.id_url });
      });
  }
  formData.set("tenant_id_files", JSON.stringify(tenantIdFiles));

  try {
    const tenantId =
      form.getAttribute("data-tenant-id") || formData.get("user_id");
    const response = await fetch(`/api/v1/users/${tenantId}`, {
      method: "PATCH",
      body: formData,
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to update tenant");
    showTenantSnackbar("Tenant updated successfully!", "success");
    setTenantDetailsEditMode(false);
    openTenantDetailsInlineForm(tenantId);
  } catch (err) {
    showTenantSnackbar("Failed to update tenant.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.classList.remove("btn-loading");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fas fa-save"></i>Save Changes`;
    }
  }
}

async function openTenantDetailsInEditMode(tenantId) {
  await openTenantDetailsInlineForm(tenantId);
  setTenantDetailsEditMode(true);
}

document.addEventListener("DOMContentLoaded", function () {
  const editForm = document.getElementById("editTenantForm");
  if (editForm) {
    editForm.addEventListener("submit", handleEditTenantFormSubmit);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const editForm = document.getElementById("editTenantForm");
  const saveBtn = editForm
    ? editForm.querySelector('button[type="submit"]')
    : null;
  if (!editForm) return;
  const requiredFields = [
    editForm.firstName,
    editForm.lastName,
    editForm.email,
    editForm.phoneNumber,
    editForm.birthDate,
    editForm.houseNo,
    editForm.street,
    editForm.city,
    editForm.province,
    editForm.zipCode,
  ];

  function validateAllFields() {
    let allValid = true;
    const editForm = document.getElementById("editTenantForm");
    if (!editForm) return false;

    const visibleFields = Array.from(
      editForm.querySelectorAll("input, select")
    ).filter((el) => el.offsetParent !== null && !el.disabled);

    visibleFields.forEach((field) => {
      switch (field.name) {
        case "firstName":
          if (!validateName(field)) allValid = false;
          break;
        case "lastName":
          if (!validateName(field)) allValid = false;
          break;
        case "email":
          if (!validateEmail(field)) allValid = false;
          break;
        case "phoneNumber":
          if (!validatePHMobile(field, true)) allValid = false;
          break;
        case "birthDate":
          if (!validateBirthdate(field)) allValid = false;
          break;
        case "houseNo":
          if (!validateHouseNo(field)) allValid = false;
          break;
        case "street":
          if (!validateStreet(field)) allValid = false;
          break;
        case "city":
          if (!validateCity(field)) allValid = false;
          break;
        case "province":
          if (!validateProvince(field)) allValid = false;
          break;
        case "zipCode":
          if (field.required || field.value.trim() !== "") {
            if (!validateZipCode(field)) allValid = false;
          } else {
            clearError(field);
          }
          break;
        default:
          break;
      }
    });

    const saveBtn = editForm.querySelector('button[type="submit"]');
    if (saveBtn) saveBtn.disabled = !allValid;
    return allValid;
  }

  if (editForm.firstName)
    editForm.firstName.addEventListener("input", function () {
      validateName(editForm.firstName);
      validateAllFields();
    });
  if (editForm.lastName)
    editForm.lastName.addEventListener("input", function () {
      validateName(editForm.lastName);
      validateAllFields();
    });
  if (editForm.email)
    editForm.email.addEventListener("input", function () {
      validateEmail(editForm.email);
      validateAllFields();
    });
  if (editForm.phoneNumber)
    editForm.phoneNumber.addEventListener("input", function () {
      validatePHMobile(editForm.phoneNumber, true);
      validateAllFields();
    });
  if (editForm.birthDate)
    editForm.birthDate.addEventListener("change", function () {
      validateBirthdate(editForm.birthDate);
      validateAllFields();
    });
  if (editForm.houseNo)
    editForm.houseNo.addEventListener("input", function () {
      validateHouseNo(editForm.houseNo);
      validateAllFields();
    });
  if (editForm.street)
    editForm.street.addEventListener("input", function () {
      validateStreet(editForm.street);
      validateAllFields();
    });
  if (editForm.city)
    editForm.city.addEventListener("input", function () {
      validateCity(editForm.city);
      validateAllFields();
    });
  if (editForm.province)
    editForm.province.addEventListener("input", function () {
      validateProvince(editForm.province);
      validateAllFields();
    });
  if (editForm.zipCode)
    editForm.zipCode.addEventListener("input", function () {
      validateZipCode(editForm.zipCode);
      validateAllFields();
    });

  validateAllFields();

  editForm.addEventListener("submit", function (e) {
    let valid = validateAllFields();
    if (!valid) {
      e.preventDefault();
      showTenantSnackbar("Please correct the highlighted fields.", "error");
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const backBtn = document.getElementById("backToGridBtn");
  if (backBtn) {
    backBtn.addEventListener("click", function () {
      closeTenantDetailsInlineForm();
    });
  }
});

document.addEventListener("DOMContentLoaded", setupCreateAccountInlineForm);

setInterval(autoSaveFormData, 30000);

window.toggleView = toggleView;
window.deleteTenant = deleteTenant;
window.selectAll = selectAll;
window.clearSelection = clearSelection;
window.messageSelected = messageSelected;
window.exportSelected = exportSelected;
window.toggleSelectAll = toggleSelectAll;
window.nextStep = nextStep;
window.previousStep = previousStep;
window.confirmAccount = confirmAccount;
window.togglePassword = togglePassword;
window.handleAvatarError = handleAvatarError;
window.goToPage = goToPage;
window.formatStatus = formatStatus;
window.formatDate = formatDate;
window.openCreateAccountInline = openCreateAccountInline;
window.closeCreateAccountInline = closeCreateAccountInline;
window.viewTenantDetails = viewTenantDetails;
window.openTenantDetailsInlineForm = openTenantDetailsInlineForm;
window.closeTenantDetailsInlineForm = closeTenantDetailsInlineForm;
window.toggleEditTenantForm = toggleEditTenantForm;
window.openTenantDetailsInEditMode = openTenantDetailsInEditMode;
