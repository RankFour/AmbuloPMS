import formatAddress from "../utils/formatAddress.js";
import formatDate from "../utils/formatDate.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

let properties = [];
let filteredProperties = [];

let isAddingProperty = false;
let inlineFormHandler = null;

let isEditingProperty = false;
let currentEditPropertyId = null;
let editInlineFormHandler = null;

let editShowcaseImages = [];
const MAX_SHOWCASE_IMAGES = 10;
let deletedShowcaseImages = [];

let currentPage = 1;
let pageSize = 8;
let totalProperties = 0;

let currentStatusFilter = "all";
let currentAddressFilter = "all";
let currentSearchQuery = "";
window.currentStatusFilter = "all";

const API_BASE_URL = "/api/v1/properties";

document.addEventListener("DOMContentLoaded", function () {
  populateAddressFilterDropdown();
  loadProperties(1, pageSize);
  setupEventListeners();
  setDynamicInfo();

  const addressFilterDropdown = document.getElementById(
    "addressFilterDropdown"
  );
  if (addressFilterDropdown) {
    addressFilterDropdown.addEventListener("change", handleAddressFilterChange);
  }

  const clearBtn = document.getElementById("clearFiltersBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.value = "";
      currentSearchQuery = "";

      currentStatusFilter = "all";
      updateStatusDropdownLabel("all");
      highlightActiveStatus("all");

      loadProperties(1, pageSize);
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
    ? `Properties - ${company.company_name}`
    : "Properties";
}

async function loadProperties(page = 1, limit = pageSize) {
  try {
    showLoadingState();

    const addressFilter = getAddressFilterValue();
    let url = API_BASE_URL;
    let params = [];

    if (addressFilter !== "all") {
      params.push(`address_id=${encodeURIComponent(addressFilter)}`);
    }

    if (currentStatusFilter && currentStatusFilter !== "all") {
      params.push(
        `property_status=${encodeURIComponent(
          mapStatusToBackend(currentStatusFilter)
        )}`
      );
    }

    if (currentSearchQuery && currentSearchQuery.trim() !== "") {
      params.push(`search=${encodeURIComponent(currentSearchQuery.trim())}`);
    }

    params.push(`page=${page}`);
    params.push(`limit=${limit}`);

    if (params.length) {
      url += "?" + params.join("&");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const result = await response.json();

    if (result.properties) {
      properties = result.properties.map(transformPropertyData);
      totalProperties = result.total || result.properties.length;
      currentPage = result.page || 1;
      pageSize = result.limit || pageSize;

      filteredProperties = properties;
      renderProperties();
      renderPagination();
      hideLoadingState();
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Error loading properties:", error);
    showErrorState();
  }
}

function transformPropertyData(backendProperty) {
  return {
    id: backendProperty.property_id,
    property_name: backendProperty.property_name || "Unnamed Property",
    location: formatAddress(backendProperty, false),
    status: mapPropertyStatus(backendProperty.property_status),
    base_rent: backendProperty.base_rent || 0,
    floor_area_sqm: backendProperty.floor_area_sqm || 0,
    description: backendProperty.description || "",
    display_image: backendProperty.display_image,
    property_pictures: backendProperty.property_pictures,
    advance_months: backendProperty.advance_months || 0,
    security_deposit_months: backendProperty.security_deposit_months || 2,
    minimum_lease_term_months: backendProperty.minimum_lease_term_months || 24,
    address_id: backendProperty.address_id,
    building_name: backendProperty.building_name,
    street: backendProperty.street,
    barangay: backendProperty.barangay,
    city: backendProperty.city,
    province: backendProperty.province,
    postal_code: backendProperty.postal_code,
    country: backendProperty.country,
    created_at: backendProperty.created_at,
    updated_at: backendProperty.updated_at,
  };
}

function renderPagination() {
  const paginationContainerId = "paginationContainer";
  let container = document.getElementById(paginationContainerId);

  if (isAddingProperty || isEditingProperty) {
    if (container) {
      container.innerHTML = "";
      container.style.display = "none";
    }
    return;
  }

  if (!container) {
    container = document.createElement("div");
    container.id = paginationContainerId;
    container.style.textAlign = "center";
    container.style.margin = "20px 0";
    document.getElementById("propertiesGrid").after(container);
  }

  if (totalProperties <= pageSize) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "block";

  const totalPages = Math.ceil(totalProperties / pageSize);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `<nav aria-label="Property pagination"><ul class="pagination justify-content-center">`;

  if (currentPage === 1) {
    html += `<li class="page-item disabled">
      <span class="page-link" tabindex="-1" aria-disabled="true">Previous</span>
    </li>`;
  } else {
    html += `<li class="page-item">
      <a class="page-link" href="#" onclick="goToPage(${currentPage - 1
      });return false;">Previous</a>
    </li>`;
  }

  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, currentPage + 2);
  if (currentPage <= 3) end = Math.min(5, totalPages);
  if (currentPage > totalPages - 2) start = Math.max(1, totalPages - 4);

  for (let i = start; i <= end; i++) {
    html += `<li class="page-item${i === parseInt(currentPage) ? " active" : ""
      }">
      <a class="page-link" href="#" onclick="goToPage(${i});return false;">${i}</a>
    </li>`;
  }

  if (currentPage === totalPages) {
    html += `<li class="page-item disabled">
      <span class="page-link" tabindex="-1" aria-disabled="true">Next</span>
    </li>`;
  } else {
    html += `<li class="page-item">
      <a class="page-link" href="#" onclick="goToPage(${currentPage + 1
      });return false;">Next</a>
    </li>`;
  }

  html += `</ul></nav>`;

  container.innerHTML = html;
}

function mapPropertyStatus(backendStatus) {
  const statusMap = {
    Available: "available",
    Occupied: "occupied",
    Maintenance: "maintenance",
    "Under Maintenance": "maintenance",
    Reserved: "reserved",
  };
  return statusMap[backendStatus] || "available";
}

function mapStatusToBackend(frontendStatus) {
  const statusMap = {
    available: "Available",
    occupied: "Occupied",
    maintenance: "Maintenance",
    reserved: "Reserved",
  };
  return statusMap[frontendStatus] || "Available";
}

function setupEventListeners() {
  document
    .getElementById("searchInput")
    .addEventListener("input", function (e) {
      searchProperties(e.target.value);
    });
}

function getAddressFilterValue() {
  return localStorage.getItem("addressFilter") || "all";
}
function setAddressFilterValue(val) {
  localStorage.setItem("addressFilter", val);
}

async function populateAddressFilterDropdown() {
  const dropdown = document.getElementById("addressFilterDropdown");
  if (!dropdown) return;

  const prevValue = getAddressFilterValue();
  dropdown.innerHTML = `<option value="all">All Addresses</option>`;

  try {
    const response = await fetch(`api/v1/addresses`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to fetch addresses");
    const result = await response.json();

    const uniqueAddresses = new Map();
    result.addresses.forEach((address) => {
      if (address.address_id) {
        let label = address.building_name?.trim();
        if (!label) {
          label = formatAddress(address, false);
        }
        uniqueAddresses.set(address.address_id, label);
      }
    });

    const sorted = Array.from(uniqueAddresses.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );

    sorted.forEach(([address_id, label]) => {
      const option = document.createElement("option");
      option.value = address_id;
      option.textContent = label;
      dropdown.appendChild(option);
    });

    dropdown.value = prevValue;
  } catch (error) {
    console.error("Error populating address filter:", error);
  }
}

async function handleAddressFilterChange() {
  const dropdown = document.getElementById("addressFilterDropdown");
  if (!dropdown) return;
  const value = dropdown.value;
  currentAddressFilter = value;
  setAddressFilterValue(value);

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";
  currentSearchQuery = "";
  currentStatusFilter = "all";
  updateStatusDropdownLabel("all");
  highlightActiveStatus("all");

  loadProperties(1, pageSize);
}

function renderProperties() {
  const grid = document.getElementById("propertiesGrid");

  if (!grid) {
    console.error("Properties grid element not found!");
    return;
  }

  if (filteredProperties.length === 0) {
    grid.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <i class="fas fa-home fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No properties found</h5>
                    <p class="text-muted">Try adjusting your search criteria or add a new property.</p>
                </div>
            </div>
        `;
    return;
  }

  grid.innerHTML = filteredProperties
    .map(
      (property) => `
        <div class="property-card-wrapper">
            <div class="property-card h-100" data-id="${property.id}">
                <!-- Property Image Section -->
                <div class="property-image-container">
                    <div class="property-image ${getPropertyImageSrc(property) ? "" : "no-image"
        }">
                        ${getPropertyImageSrc(property)
          ? `<img src="${getPropertyImageSrc(
            property
          )}" alt="${property.property_name
          }" class="img-fluid">`
          : `
                                <div class="no-image-placeholder">
                                    <i class="fas fa-image fa-2x text-muted mb-2"></i>
                                    <small class="text-muted">No Image Available</small>
                                </div>
                            `
        }
                        <div class="image-overlay">
                            <button class="btn-image-action" onclick="openEditPropertyForm('${property.id
        }')" title="Edit Property">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                    <div class="status-badge-container">
                        <span class="status-badge status-${property.status}">
                            <i class="fas ${getStatusIcon(
          property.status
        )} me-1"></i>
                            ${property.status.charAt(0).toUpperCase() +
        property.status.slice(1)
        }
                        </span>
                    </div>
                </div>
                
                <!-- Property Info Section -->
                <div class="property-card-body">
                    <!-- Header Section -->
                    <div class="property-header-section">
                        <h5 class="property-title">${property.property_name
        }</h5>
                        <p class="property-location">
                            <i class="fas fa-map-marker-alt text-muted me-1"></i>
                            ${property.location}
                        </p>
                    </div>
                    
                    <!-- Price Section -->
                    <div class="property-price-section">
                        <div class="price-main">₱${property.base_rent.toLocaleString()}</div>
                        <div class="price-label">per month</div>
                    </div>
                    
                    <!-- Key Details Grid -->
                    <div class="property-details-grid">
                        <div class="detail-card">
                            <div class="detail-icon">
                                <i class="fas fa-ruler-combined"></i>
                            </div>
                            <div class="detail-content">
                                <div class="detail-value">${property.floor_area_sqm
        }</div>
                                <div class="detail-label">m² Area</div>
                            </div>
                        </div>
                        
                        <div class="detail-card">
                            <div class="detail-icon">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                            <div class="detail-content">
                                <div class="detail-value">${property.minimum_lease_term_months
        } MONTHS</div>
                                <div class="detail-label">Minimum Lease Time</div>
                            </div>
                        </div>
                        
                        <div class="detail-card">
                            <div class="detail-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="detail-content">
                                <div class="detail-value">${property.security_deposit_months
        } MONTHS</div>
                                <div class="detail-label">Security Deposit</div>
                            </div>
                        </div>
                        
                        <div class="detail-card">
                            <div class="detail-icon">
                                <i class="fa-sharp fa-solid fa-money-bill-wave"></i>
                            </div>
                            <div class="detail-content">
                                <div class="detail-value">${property.advance_months
        } MONTHS </div>
                                <div class="detail-label">Advance Payment</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actions Section -->
                    <div class="property-actions">
                        <button class="btn btn-outline-primary btn-sm flex-fill" onclick="showPropertyDetails('${property.id
        }')">
                            <i class="fas fa-eye me-1"></i>
                            View Details
                        </button>
                        <button class="btn btn-primary btn-sm flex-fill" onclick="openEditPropertyForm('${property.id
        }')">
                            <i class="fas fa-edit me-1"></i>
                            Edit
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="removeProperty('${property.id
        }')" title="Remove Property">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `
    )
    .join("");
}

function getStatusIcon(status) {
  const iconMap = {
    available: "fa-check-circle",
    occupied: "fa-user",
    maintenance: "fa-tools",
    reserved: "fa-bookmark",
  };
  return iconMap[status] || "fa-circle";
}

function getPropertyImageSrc(property) {
  if (property.display_image) {
    return property.display_image;
  }
  if (property.property_pictures && property.property_pictures.length > 0) {
    return property.property_pictures[0].image_url;
  }
  return null;
}

function showLoadingState() {
  try {
    const grid = document.getElementById("propertiesGrid");
    if (!grid) {
      console.warn("showLoadingState: #propertiesGrid not found in DOM");
      return;
    }
    grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px;">
                    <div style="font-size: 18px; color: #666; margin-bottom: 10px;">Loading properties...</div>
                    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #4a90e2; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
            `;
  } catch (e) {
    console.warn('showLoadingState error', e);
  }
}

function showErrorState() {
  try {
    const grid = document.getElementById("propertiesGrid");
    if (!grid) {
      console.warn("showErrorState: #propertiesGrid not found in DOM");
      return;
    }
    grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: #dc2626;">
                    <div style="font-size: 18px; margin-bottom: 15px;">Failed to load properties</div>
                    <button onclick="loadProperties()" style="background: #4a90e2; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
  } catch (e) {
    console.warn('showErrorState error', e);
  }
}

function hideLoadingState() { hideLoadingStateSafe(); }


function hideLoadingStateSafe() {
  try {
    const grid = document.getElementById("propertiesGrid");
    if (!grid) return;
    
    
    const loadingNode = grid.querySelector("[style*='Loading properties...']");
    if (loadingNode) {
      grid.innerHTML = "";
    }
  } catch (e) {
    console.warn('hideLoadingStateSafe error', e);
  }
}

function openAddModal() {
  hideEditPropertyForm();
  showAddPropertyForm();
}

function closeAddModal() {
  hideAddPropertyForm();
}

function openEditPropertyForm(id) {
  const property = properties.find((p) => p.id === id);
  if (!property) {
    console.error("Property not found:", id);
    return;
  }

  showEditPropertyForm(id);
}

function closeEditModal() {
  hideEditPropertyForm();
}

function closeDetailsModal() {
  if (detailsModal) {
    detailsModal.close();
  }
}

function searchProperties(query) {
  currentSearchQuery = query;
  loadProperties(1, pageSize);
}

function toggleDropdown(dropdownId) {
  event.stopPropagation();
  closeAllDropdowns();
  const dropdown = document.getElementById(dropdownId);
  dropdown.classList.toggle("show");
}

function closeAllDropdowns() {
  document
    .querySelectorAll(".property-dropdown-content")
    .forEach((dropdown) => {
      dropdown.classList.remove("show");
    });
}

function updateStatusDropdownLabel(status) {
  const label = document.getElementById("currentStatusLabel");
  if (!label) return;
  let text = "Status";
  let color = "#64748b";
  let icon = '<i class="fas fa-list me-2"></i>';

  switch (status) {
    case "available":
      text = "Available";
      color = "#059669";
      icon = '<i class="fas fa-check-circle me-2"></i>';
      break;
    case "occupied":
      text = "Occupied";
      color = "#2563eb";
      icon = '<i class="fas fa-user me-2"></i>';
      break;
    case "maintenance":
      text = "Maintenance";
      color = "#d97706";
      icon = '<i class="fas fa-tools me-2"></i>';
      break;
    case "reserved":
      text = "Reserved";
      color = "#59657cff";
      icon = '<i class="fas fa-bookmark me-2"></i>';
      break;
    case "all":
    default:
      text = "All";
      color = "#64748b";
      icon = '<i class="fas fa-list me-2"></i>';
      break;
  }
  label.innerHTML =
    icon + `<span style="color:${color};font-weight:600;">${text}</span>`;
}

function highlightActiveStatus(status) {
  document.querySelectorAll("#statusDropdown a").forEach((a) => {
    a.classList.remove("active");
    if (a.classList.contains(status)) a.classList.add("active");
  });
}

function filterByStatus(status) {
  currentStatusFilter = status;
  updateStatusDropdownLabel(status);
  highlightActiveStatus(status);
  loadProperties(1, pageSize);
  closeAllDropdowns();
}

function showAddPropertyForm() {
  isAddingProperty = true;
  updateBreadcrumb();
  showFormContainer();
  setupInlineForm();
  hidePropertyDetails();

  const addressFilterDropdown = document.getElementById(
    "addressFilterDropdownContainer"
  );
  if (addressFilterDropdown) addressFilterDropdown.style.display = "none";
}

async function hideAddPropertyForm() {
  const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
    ? ((msg, title) => window.showConfirm(msg, title))
    : (msg => Promise.resolve(confirm(String(msg))));

  const ok = !!(await confirmFn("Are you sure you want to cancel? All entered data will be lost.", 'Cancel'));
  if (!ok) return;

  isAddingProperty = false;
  updateBreadcrumb();
  showPropertiesGrid();
  resetInlineForm();

  const addPropertyBtn = document.querySelector(".new-ticket-btn");
  const propertyControls = document.getElementById("propertyControls");

  if (addPropertyBtn) addPropertyBtn.style.display = "flex";
  if (propertyControls) propertyControls.style.display = "flex";
}

function updateBreadcrumb(customBreadcrumbs = null) {
  const breadcrumbNav = document.getElementById("breadcrumbNav");
  const propertyControls = document.getElementById("propertyControls");
  const addPropertyBtn = document.querySelector(".new-ticket-btn");

  if (customBreadcrumbs) {
    const breadcrumbItems = customBreadcrumbs
      .map((item) => {
        if (item.active) {
          return `<li class="breadcrumb-item active" aria-current="page">
          ${item.text}
        </li>`;
        } else {
          return `<li class="breadcrumb-item">
          <a href="#" onclick="${item.onclick}">
            ${item.text}
          </a>
        </li>`;
        }
      })
      .join("");

    breadcrumbNav.innerHTML = breadcrumbItems;

    if (propertyControls) propertyControls.style.display = "none";
    if (addPropertyBtn) addPropertyBtn.style.display = "none";
  } else if (isAddingProperty) {
    breadcrumbNav.innerHTML = `
      <li class="breadcrumb-item">
        <a href="#" onclick="hideAddPropertyForm()">
          <i class="fas fa-home me-2"></i>Properties
        </a>
      </li>
      <li class="breadcrumb-item active" aria-current="page">
        <i class="fas fa-plus me-2"></i>Add New Property
      </li>
    `;
    if (propertyControls) propertyControls.style.display = "none";
    if (addPropertyBtn) addPropertyBtn.style.display = "none";
  } else if (isEditingProperty) {
    const property = properties.find((p) => p.id === currentEditPropertyId);
    const propertyName = property ? property.property_name : "Property";

    breadcrumbNav.innerHTML = `
      <li class="breadcrumb-item">
        <a href="#" onclick="hideEditPropertyForm(false)">
          <i class="fas fa-home me-2"></i>Properties
        </a>
      </li>
      <li class="breadcrumb-item active" aria-current="page">
        <i class="fas fa-edit me-2"></i>Edit ${propertyName}
      </li>
    `;
    if (propertyControls) propertyControls.style.display = "none";
    if (addPropertyBtn) addPropertyBtn.style.display = "none";
  } else {
    breadcrumbNav.innerHTML = `
      <li class="breadcrumb-item active" aria-current="page">
        <i class="fas fa-home me-2"></i>Properties
      </li>
    `;
    if (propertyControls) propertyControls.style.display = "flex";
    if (addPropertyBtn) addPropertyBtn.style.display = "flex";
  }
}

function showEditPropertyForm(propertyId) {
  isEditingProperty = true;
  currentEditPropertyId = propertyId;
  updateBreadcrumb();
  showEditFormContainer();
  setupEditInlineForm();
  populateEditForm(propertyId);

  const addressFilterDropdown = document.getElementById(
    "addressFilterDropdownContainer"
  );
  if (addressFilterDropdown) addressFilterDropdown.style.display = "none";
}

async function hideEditPropertyForm(skipConfirmation = false) {
  if (!skipConfirmation && isEditingProperty) {
    const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
      ? ((msg, title) => window.showConfirm(msg, title))
      : (msg => Promise.resolve(confirm(String(msg))));

    const ok = !!(await confirmFn("Are you sure you want to cancel? All changes will be lost.", 'Cancel'));
    if (!ok) return;
  }

  isEditingProperty = false;
  currentEditPropertyId = null;

  const editContainer = document.getElementById("editPropertyFormContainer");
  if (editContainer) {
    editContainer.style.display = "none";
  }

  updateBreadcrumb();
  showPropertiesGrid();
  resetEditInlineForm();

  const addPropertyBtn = document.querySelector(".new-ticket-btn");
  const propertyControls = document.getElementById("propertyControls");

  if (addPropertyBtn) addPropertyBtn.style.display = "flex";
  if (propertyControls) propertyControls.style.display = "flex";
}

function showFormContainer() {
  document.getElementById("propertiesGrid").style.display = "none";
  document.getElementById("editPropertyFormContainer").style.display = "none";
  document.getElementById("addPropertyFormContainer").style.display = "block";

  const addPropertyBtn = document.querySelector(".new-ticket-btn");
  if (addPropertyBtn) {
    addPropertyBtn.style.display = "none";
  }

  const paginationContainer = document.getElementById("paginationContainer");
  if (paginationContainer) {
    paginationContainer.style.display = "none";
  }

  handleFloatingFormActions("addPropertyFormContainer");
}

function showEditFormContainer() {
  document.getElementById("propertiesGrid").style.display = "none";
  document.getElementById("addPropertyFormContainer").style.display = "none";
  document.getElementById("editPropertyFormContainer").style.display = "block";
  hidePropertyDetails();

  const addPropertyBtn = document.querySelector(".new-ticket-btn");
  if (addPropertyBtn) {
    addPropertyBtn.style.display = "none";
  }

  const addressFilterDropdown = document.getElementById(
    "addressFilterDropdownContainer"
  );
  if (addressFilterDropdown) addressFilterDropdown.style.display = "none";

  const paginationContainer = document.getElementById("paginationContainer");
  if (paginationContainer) {
    paginationContainer.style.display = "none";
  }

  handleFloatingFormActions("editPropertyFormContainer");
}

function handleFloatingFormActions(
  formContainerId,
  actionsClass = ".form-actions"
) {
  const formContainer = document.getElementById(formContainerId);
  if (!formContainer) return;

  const actions = formContainer.querySelector(actionsClass);
  if (!actions) return;

  function checkFloating() {
    const rect = actions.getBoundingClientRect();
    const windowHeight =
      window.innerHeight || document.documentElement.clientHeight;

    if (rect.bottom > windowHeight - 10) {
      actions.classList.add("floating-actions");
    } else {
      actions.classList.remove("floating-actions");
    }
  }

  checkFloating();
  window.addEventListener("scroll", checkFloating, { passive: true });
  window.addEventListener("resize", checkFloating);
}

function showPropertiesGrid() {
  const addContainer = document.getElementById("addPropertyFormContainer");
  const editContainer = document.getElementById("editPropertyFormContainer");
  const detailsContainer = document.getElementById(
    "propertyDetailsViewContainer"
  );

  if (addContainer) addContainer.style.display = "none";
  if (editContainer) editContainer.style.display = "none";
  if (detailsContainer) detailsContainer.style.display = "none";

  const propertiesGrid = document.getElementById("propertiesGrid");
  if (propertiesGrid) {
    propertiesGrid.style.display = "grid";
  }

  const addressFilterDropdown = document.getElementById(
    "addressFilterDropdownContainer"
  );
  if (addressFilterDropdown)
    addressFilterDropdown.style.display = "inline-block";

  const propertyControls = document.getElementById("propertyControls");
  const addPropertyBtn = document.querySelector(".new-ticket-btn");

  if (propertyControls) propertyControls.style.display = "flex";
  if (addPropertyBtn) addPropertyBtn.style.display = "flex";

  renderPagination();
  const paginationContainer = document.getElementById("paginationContainer");
  if (paginationContainer) {
    paginationContainer.style.display = "block";
  }
}

function setupEditImageShowcase() {
  const showcaseContainer = document.getElementById(
    "editImageShowcaseContainer"
  );
  const uploadPrompt = document.getElementById("editShowcaseUploadPrompt");
  const fileInput = document.getElementById("editShowcaseImageInput");
  const addMoreBtn = document.getElementById("editAddMoreImagesBtn");

  uploadPrompt.addEventListener("click", () => {
    if (editShowcaseImages.length < MAX_SHOWCASE_IMAGES) {
      fileInput.click();
    }
  });

  addMoreBtn.addEventListener("click", () => {
    if (editShowcaseImages.length < MAX_SHOWCASE_IMAGES) {
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", handleEditShowcaseImageFiles);

  showcaseContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    showcaseContainer.style.borderColor = "#f59e0b";
    showcaseContainer.style.background = "#fffbeb";
  });

  showcaseContainer.addEventListener("dragleave", (e) => {
    e.preventDefault();
    showcaseContainer.style.borderColor = "#cbd5e0";
    showcaseContainer.style.background = "#f9fafb";
  });

  showcaseContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    showcaseContainer.style.borderColor = "#cbd5e0";
    showcaseContainer.style.background = "#f9fafb";

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length > 0) {
      handleEditShowcaseImageFiles({ target: { files: imageFiles } });
    }
  });
}

function handleEditShowcaseImageFiles(event) {
  const files = Array.from(event.target.files);
  const remainingSlots = MAX_SHOWCASE_IMAGES - editShowcaseImages.length;

  if (files.length > remainingSlots) {
    showInlineErrorMessage(
      `You can only add ${remainingSlots} more images. Maximum ${MAX_SHOWCASE_IMAGES} images allowed.`
    );
    return;
  }

  files.forEach((file) => {
    if (validateEditShowcaseImage(file)) {
      addEditShowcaseImage(file);
    }
  });

  event.target.value = "";
}

function validateEditShowcaseImage(file) {
  if (!file.type.startsWith("image/")) {
    showInlineErrorMessage(`${file.name} is not a valid image file.`);
    return false;
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showInlineErrorMessage(
      `${file.name} is too large. Maximum file size is 5MB.`
    );
    return false;
  }

  if (editShowcaseImages.length >= MAX_SHOWCASE_IMAGES) {
    showInlineErrorMessage(`Maximum ${MAX_SHOWCASE_IMAGES} images allowed.`);
    return false;
  }

  return true;
}

function addEditShowcaseImage(file, existingData = null) {
  const imageId = Date.now() + Math.random();
  const imageData = {
    id: imageId,
    file: file,
    description: existingData?.image_desc || "",
    isExisting: !!existingData,
    existingId: existingData?.id || null,
  };

  editShowcaseImages.push(imageData);

  const reader = new FileReader();
  reader.onload = (e) => {
    imageData.dataUrl = e.target.result;
    renderEditShowcasePreview();
  };
  reader.readAsDataURL(file);
}

function loadExistingShowcaseImages(property) {
  editShowcaseImages = [];

  if (property.property_pictures && property.property_pictures.length > 0) {
    property.property_pictures.forEach((picture, index) => {
      const mockFile = new File([""], `existing-image-${index}.jpg`, {
        type: "image/jpeg",
      });

      const imageData = {
        id: Date.now() + index,
        file: mockFile,
        description: picture.image_desc || "",
        isExisting: true,
        existingId: picture.id,
        dataUrl: picture.image_url,
      };

      editShowcaseImages.push(imageData);
    });
  }

  renderEditShowcasePreview();
}

function renderEditShowcasePreview() {
  const previewGrid = document.getElementById("editShowcasePreviewGrid");
  const uploadPrompt = document.getElementById("editShowcaseUploadPrompt");
  const addMoreSection = document.getElementById("editShowcaseAddMore");
  const currentCount = document.getElementById("editCurrentImageCount");

  if (currentCount) {
    currentCount.textContent = editShowcaseImages.length;
  }

  if (editShowcaseImages.length === 0) {
    uploadPrompt.style.display = "block";
    addMoreSection.style.display = "none";
    previewGrid.innerHTML = "";
    previewGrid.className = "showcase-preview-grid";
    return;
  }

  uploadPrompt.style.display = "none";
  addMoreSection.style.display =
    editShowcaseImages.length < MAX_SHOWCASE_IMAGES ? "flex" : "none";

  previewGrid.className = `showcase-preview-grid count-${editShowcaseImages.length}`;

  previewGrid.innerHTML = editShowcaseImages
    .map(
      (imageData, index) => `
        <div class="showcase-image-card ${imageData.isNew ? "new" : ""
        }" data-image-id="${imageData.id}">
            <div class="showcase-image-number">${index + 1}</div>
            <img src="${imageData.dataUrl
        }" class="showcase-image-preview" alt="Showcase image ${index + 1}">
            <div class="showcase-image-info">
                <textarea 
                    class="showcase-image-description" 
                    placeholder="Add a description for this image..."
                    data-image-id="${imageData.id}"
                >${imageData.description}</textarea>
                <div class="showcase-image-actions">
                    <button type="button" class="showcase-remove-btn" onclick="removeEditShowcaseImage('${imageData.id
        }')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        </div>
    `
    )
    .join("");

  previewGrid
    .querySelectorAll(".showcase-image-description")
    .forEach((textarea) => {
      textarea.addEventListener("input", (e) => {
        const imageId = e.target.dataset.imageId;
        const imageData = editShowcaseImages.find((img) => img.id == imageId);
        if (imageData) {
          imageData.description = e.target.value;
        }
      });
    });

  setTimeout(() => {
    previewGrid.querySelectorAll(".showcase-image-card.new").forEach((card) => {
      card.classList.remove("new");
    });
  }, 300);
}

function removeEditShowcaseImage(imageId) {
  const imageToRemove = editShowcaseImages.find((img) => img.id == imageId);

  if (imageToRemove && imageToRemove.isExisting && imageToRemove.existingId) {
    const validId = parseInt(imageToRemove.existingId);
    if (!isNaN(validId) && validId > 0) {
      deletedShowcaseImages.push(validId);
    } else {
      console.warn("Invalid existing image ID:", imageToRemove.existingId);
    }
  }

  editShowcaseImages = editShowcaseImages.filter((img) => img.id != imageId);
  renderEditShowcasePreview();
}

function getEditShowcaseImagesForSubmission() {
  const newImages = editShowcaseImages.filter((img) => !img.isExisting);
  const updatedImages = editShowcaseImages.filter(
    (img) => img.isExisting && img.existingId
  );
  const deletedImages = deletedShowcaseImages.filter(
    (id) => id && id !== "undefined" && !isNaN(id)
  );

  return {
    newImages: newImages.map((imageData) => ({
      file: imageData.file,
      description: imageData.description,
    })),
    updatedImages: updatedImages.map((imageData) => ({
      existingId: imageData.existingId,
      description: imageData.description,
    })),
    deletedImages: deletedImages,
  };
}

function setupEditInlineForm() {
  if (editInlineFormHandler) return;
  // Initialize edit form components (image upload, showcase, validation).
  setupEditInlineImageUpload();
  setupEditImageShowcase();
  // Removed: setupEditInlineAddressHandlers() and new address creation logic.
  setupRealTimeValidation(true);
  const formEl = document.getElementById("inlineEditPropertyForm");
  if (formEl) formEl.addEventListener("submit", handleEditInlineFormSubmit);
  // Load existing addresses only (no inline creation now).
  loadEditInlineAddresses();
  editInlineFormHandler = true;
}

function populateEditForm(propertyId) {
  deletedShowcaseImages = [];

  const property = properties.find((p) => p.id === propertyId);
  if (!property) {
    console.error("Property not found:", propertyId);
    return;
  }

  const fieldMappings = {
    editPropertyName: property.property_name,
    editFloorArea: property.floor_area_sqm,
    editPropertyStatus: mapStatusToBackend(property.status),
    editBaseRent: property.base_rent,
    editAdvanceMonths: property.advance_months,
    editSecurityDeposit: property.security_deposit_months,
    editLeaseTerm: property.minimum_lease_term_months,
    editDescription: property.description || "",
  };
  Object.entries(fieldMappings).forEach(([fieldId, value]) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = value || "";
    } else {
      console.warn(`Field ${fieldId} not found`);
    }
  });

  const descEditor = document.getElementById("editDescriptionEditor");
  if (descEditor) {
    descEditor.innerHTML = property.description || "";
  }

  const addressSelect = document.getElementById("editInlineAddressSelect");
  if (addressSelect && property.address_id) {
    addressSelect.value = property.address_id;
    if (window.editInlineAddressTomSelect) {
      window.editInlineAddressTomSelect.setValue(property.address_id, true);
    }
  } else if (addressSelect) {
    addressSelect.value = "";
    if (window.editInlineAddressTomSelect) {
      window.editInlineAddressTomSelect.clear(true);
    }
  }

  const uploadContainer = document.getElementById(
    "editInlineImageUploadContainer"
  );
  if (uploadContainer && uploadContainer.setExistingImage) {
    uploadContainer.setExistingImage(property.display_image);
  }

  loadExistingShowcaseImages(property);
}

function validateImage(file) {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  if (!validTypes.includes(file.type)) {
    showInlineErrorMessage(
      `${file.name} is not a valid image file (JPG, PNG, GIF)`
    );
    return false;
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showInlineErrorMessage(
      `${file.name} is too large. Maximum file size is 5MB`
    );
    return false;
  }

  return true;
}

function setupEditInlineImageUpload() {
  const uploadContainer = document.getElementById(
    "editInlineImageUploadContainer"
  );
  const uploadPrompt = document.getElementById("editInlineUploadPrompt");
  const imagePreview = document.getElementById("editInlineImagePreview");
  const previewImage = document.getElementById("editInlinePreviewImage");
  const fileInput = document.getElementById("editInlineDisplayImageInput");
  const removeBtn = document.getElementById("editInlineRemoveImageBtn");
  const changeBtn = document.getElementById("editInlineChangeImageBtn");

  if (
    !uploadContainer ||
    !uploadPrompt ||
    !imagePreview ||
    !previewImage ||
    !fileInput
  ) {
    console.warn("Edit inline image upload elements not found");
    return;
  }

  let uploadedFile = null;
  let shouldRemoveExistingImage = false;

  uploadPrompt.addEventListener("click", () => {
    fileInput.click();
  });

  if (changeBtn) {
    changeBtn.addEventListener("click", () => {
      fileInput.click();
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      uploadedFile = null;
      fileInput.value = "";
      shouldRemoveExistingImage = true;

      imagePreview.style.display = "none";
      uploadPrompt.style.display = "block";
    });
  }

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      shouldRemoveExistingImage = false;

      if (validateImage(file)) {
        uploadedFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
          previewImage.src = e.target.result;
          uploadPrompt.style.display = "none";
          imagePreview.style.display = "block";
        };
        reader.readAsDataURL(file);
      }
    }
  });

  uploadContainer.getUploadedImage = () => uploadedFile;
  uploadContainer.shouldRemoveImage = () => shouldRemoveExistingImage;

  uploadContainer.reset = () => {
    uploadedFile = null;
    shouldRemoveExistingImage = false;
    fileInput.value = "";
    imagePreview.style.display = "none";
    uploadPrompt.style.display = "block";
  };

  uploadContainer.setExistingImage = (imageUrl) => {
    if (imageUrl) {
      shouldRemoveExistingImage = false;
      previewImage.src = imageUrl;
      uploadPrompt.style.display = "none";
      imagePreview.style.display = "block";
    } else {
      uploadPrompt.style.display = "block";
      imagePreview.style.display = "none";
    }
  };
}

function populateAddressSelectFromCachedProperties(
  selectElement,
  propertiesData
) {
  selectElement.innerHTML =
    '<option value="">Select an existing address</option>';

  const uniqueAddresses = new Map();

  propertiesData.forEach((property) => {
    if (
      property.address_id &&
      (property.building_name || property.street || property.city)
    ) {
      const addressKey = [
        property.building_name,
        property.street,
        property.barangay,
        property.city,
        property.province,
        property.country,
      ]
        .filter((part) => part && part.trim())
        .join("|");

      if (addressKey && !uniqueAddresses.has(addressKey)) {
        uniqueAddresses.set(addressKey, {
          address_id: property.address_id,
          formatted: formatAddress(addressKey, false),
        });
      }
    }
  });

  if (uniqueAddresses.size === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No addresses available";
    option.disabled = true;
    selectElement.appendChild(option);
    return;
  }

  const sortedAddresses = Array.from(uniqueAddresses.values()).sort((a, b) =>
    a.formatted.localeCompare(b.formatted)
  );

  sortedAddresses.forEach((address) => {
    const option = document.createElement("option");
    option.value = address.address_id;
    option.textContent = address.formatted;
    selectElement.appendChild(option);
  });
}

async function loadEditInlineAddresses() {
  const addressSelect = document.getElementById("editInlineAddressSelect");
  if (!addressSelect) {
    console.error("Edit address select element not found");
    return;
  }
  if (window.editInlineAddressTomSelect) {
    window.editInlineAddressTomSelect.destroy();
    window.editInlineAddressTomSelect = null;
  }

  addressSelect.innerHTML = '<option value="">Loading addresses...</option>';

  try {
    const response = await fetch(`api/v1/addresses`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();
      if (result.addresses && Array.isArray(result.addresses)) {
        addressSelect.innerHTML =
          '<option value="">Select an existing address (optional)</option>';

        result.addresses.forEach((address) => {
          const lines = formatAddress(address, true);
          const option = document.createElement("option");
          option.value = address.address_id;
          option.textContent = `${lines.line1} — ${lines.line2}`;
          addressSelect.appendChild(option);
        });

        window.editInlineAddressTomSelect = new TomSelect(addressSelect, {
          create: false,
          sortField: {
            field: "text",
            direction: "asc",
          },
          render: {
            option: function (data, escape) {
              let [line1, line2] = (data.text || "").split(" — ");
              return `<div>
                <span style="font-weight:600;">${escape(line1 || "")}</span><br>
                <span style="font-size:0.92em;color:#64748b;">${escape(
                line2 || ""
              )}</span>
              </div>`;
            },
            item: function (data, escape) {
              let [line1, line2] = (data.text || "").split(" — ");
              return `<div>
                <span style="font-weight:600;">${escape(line1 || "")}</span>
                <span style="font-size:0.92em;color:#64748b;">${escape(
                line2 || ""
              )}</span>
              </div>`;
            },
          },
          placeholder: "Select an existing address",
          dropdownInput:
            '<input type="text" autocomplete="off" class="ts-dropdown-input" placeholder="Type to search addresses...">',
        });

        return;
      }
      throw new Error("Invalid response format");
    } else {
      throw new Error(`Server error: ${response.status}`);
    }
  } catch (error) {
    console.error("Error fetching addresses for EDIT form:", error);
    populateAddressSelectFromCachedProperties(addressSelect, properties);
  }
}

async function handleEditInlineFormSubmit(event) {
  event.preventDefault();

  const descEditor = document.getElementById("editDescriptionEditor");
  const descTextarea = document.getElementById("editDescription");
  if (descEditor && descTextarea) {
    descTextarea.value = descEditor.innerHTML;
  }
  if (!validateForm(true)) {
    const submitBtn = document.getElementById("editInlineSubmitBtn");
    submitBtn.style.animation = "shake 0.5s ease-in-out";
    setTimeout(() => {
      submitBtn.style.animation = "";
    }, 500);

    showInlineErrorMessage(
      "Please fix the validation errors before submitting."
    );
    return;
  }

  const submitBtn = document.getElementById("editInlineSubmitBtn");
  const originalText = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i> Updating Property...';

    const formData = new FormData(event.target);

    const addressSelect = document.getElementById("editInlineAddressSelect");
    if (addressSelect.value && addressSelect.value !== "") {
      if (addressSelect.value.startsWith("temp_")) {
        let addressData = null;

        if (window.editInlineAddressTomSelect) {
          const optionData =
            window.editInlineAddressTomSelect.options[addressSelect.value];
          if (optionData && optionData.addressData) {
            addressData = JSON.parse(optionData.addressData);
          }
        }

        if (!addressData) {
          const selectedOption =
            addressSelect.options[addressSelect.selectedIndex];
          if (selectedOption && selectedOption.dataset.addressData) {
            addressData = JSON.parse(selectedOption.dataset.addressData);
          }
        }

        if (addressData) {
          delete addressData.address_id;
          delete addressData.is_new;
          Object.entries(addressData).forEach(([key, value]) => {
            if (value && value.trim()) {
              formData.append(key, value);
            }
          });
          formData.delete("address_id");
        } else {
          showInlineErrorMessage("Could not retrieve new address data.");
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }
      } else {
        formData.set("address_id", addressSelect.value);
      }
    } else {
      formData.delete("address_id");
    }
    const uploadContainer = document.getElementById(
      "editInlineImageUploadContainer"
    );
    const uploadedImage = uploadContainer.getUploadedImage();
    const shouldRemoveImage = uploadContainer.shouldRemoveImage();

    if (uploadedImage) {
      formData.set("display_image", uploadedImage);
    } else if (shouldRemoveImage) {
      formData.set("remove_display_image", "true");
    }

    const showcaseData = getEditShowcaseImagesForSubmission();

    if (showcaseData.newImages && showcaseData.newImages.length > 0) {
      showcaseData.newImages.forEach((imageData) => {
        formData.append("showcase_images", imageData.file);
        formData.append("showcase_descriptions", imageData.description);
      });
    }

    if (showcaseData.updatedImages && showcaseData.updatedImages.length > 0) {
      showcaseData.updatedImages.forEach((imageData) => {
        const validId = parseInt(imageData.existingId);
        if (!isNaN(validId) && validId > 0) {
          formData.append("existing_image_ids", validId);
          formData.append("existing_descriptions", imageData.description);
        } else {
          console.warn(
            "Skipping invalid existing image ID:",
            imageData.existingId
          );
        }
      });
    }

    if (showcaseData.deletedImages && showcaseData.deletedImages.length > 0) {
      showcaseData.deletedImages.forEach((deletedId) => {
        const validId = parseInt(deletedId);
        if (!isNaN(validId) && validId > 0) {
          formData.append("deleted_image_ids", validId);
        } else {
          console.warn("Skipping invalid deleted image ID:", deletedId);
        }
      });
    }

    const response = await fetch(`${API_BASE_URL}/${currentEditPropertyId}`, {
      method: "PATCH",
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();

      await loadProperties();

      showInlineSuccessMessage("Property updated successfully!");

      setTimeout(() => {
        isEditingProperty = false;
        currentEditPropertyId = null;

        const editContainer = document.getElementById(
          "editPropertyFormContainer"
        );
        if (editContainer) {
          editContainer.style.display = "none";
        }

        showPropertiesGrid();
        updateBreadcrumb();
        resetEditInlineForm();

        const addPropertyBtn = document.querySelector(".new-ticket-btn");
        const propertyControls = document.getElementById("propertyControls");

        if (addPropertyBtn) addPropertyBtn.style.display = "flex";
        if (propertyControls) propertyControls.style.display = "flex";
      }, 1500);
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
  } catch (error) {
    console.error("Error updating property:", error);
    showInlineErrorMessage(
      error.message || "Failed to update property. Please try again."
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function setupInlineImageUpload() {
  const uploadContainer = document.getElementById("inlineImageUploadContainer");
  const fileInput = document.getElementById("inlineDisplayImageInput");
  const uploadPrompt = document.getElementById("inlineUploadPrompt");
  const imagePreview = document.getElementById("inlineImagePreview");
  const previewImage = document.getElementById("inlinePreviewImage");
  const removeImageBtn = document.getElementById("inlineRemoveImageBtn");
  const changeImageBtn = document.getElementById("inlineChangeImageBtn");

  let uploadedImage = null;

  uploadContainer.addEventListener("click", (e) => {
    if (
      e.target === uploadContainer ||
      e.target.closest("#inlineUploadPrompt")
    ) {
      fileInput.click();
    }
  });

  uploadContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadContainer.style.borderColor = "#3b82f6";
    uploadContainer.style.background = "#eff6ff";
  });

  uploadContainer.addEventListener("dragleave", (e) => {
    e.preventDefault();
    uploadContainer.style.borderColor = "#cbd5e0";
    uploadContainer.style.background = "#f9fafb";
  });

  uploadContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadContainer.style.borderColor = "#cbd5e0";
    uploadContainer.style.background = "#f9fafb";

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleInlineImageFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleInlineImageFile(e.target.files[0]);
    }
  });

  removeImageBtn.addEventListener("click", () => {
    uploadedImage = null;
    fileInput.value = "";
    uploadPrompt.style.display = "block";
    imagePreview.style.display = "none";
  });

  changeImageBtn.addEventListener("click", () => {
    fileInput.click();
  });

  function handleInlineImageFile(file) {
    if (validateImage(file)) {
      uploadedImage = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
        uploadPrompt.style.display = "none";
        imagePreview.style.display = "block";
      };
      reader.readAsDataURL(file);
    } else {
      fileInput.value = "";
      uploadedImage = null;
    }
  }

  uploadContainer.getUploadedImage = () => uploadedImage;
}

function setupInlineAddressHandlers() {}

function setNewAddressRequired() {}

function collectInlineAddressData() { return {}; }

function validateInlineAddress() { return false; }

function addInlineAddressToSelect() {}

function clearInlineAddressForm() {}

async function loadInlineAddresses() {
  const addressSelect = document.getElementById("inlineAddressSelect");
  if (!addressSelect) return;

  if (window.inlineAddressTomSelect) {
    window.inlineAddressTomSelect.destroy();
    window.inlineAddressTomSelect = null;
  }

  try {
    const response = await fetch(`api/v1/addresses`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();
      if (result.addresses && Array.isArray(result.addresses)) {
        addressSelect.innerHTML =
          '<option value="">Select an existing address</option>';

        result.addresses.forEach((address) => {
          const lines = formatAddress(address, true);
          const option = document.createElement("option");
          option.value = address.address_id;
          option.textContent = `${lines.line1} — ${lines.line2}`;
          addressSelect.appendChild(option);
        });

        window.inlineAddressTomSelect = new TomSelect(addressSelect, {
          create: false,
          sortField: {
            field: "text",
            direction: "asc",
          },
          render: {
            option: function (data, escape) {
              let [line1, line2] = (data.text || "").split(" — ");
              return `<div>
                <span style="font-weight:600;">${escape(line1 || "")}</span><br>
                <span style="font-size:0.92em;color:#64748b;">${escape(
                line2 || ""
              )}</span>
              </div>`;
            },
            item: function (data, escape) {
              let [line1, line2] = (data.text || "").split(" — ");
              return `<div>
                <span style="font-weight:600;">${escape(line1 || "")}</span>
                <span style="font-size:0.92em;color:#64748b;">${escape(
                line2 || ""
              )}</span>
              </div>`;
            },
          },
          placeholder: "Select an existing address",
        });

        return;
      }
      throw new Error("Invalid response format");
    } else {
      throw new Error(`Server error: ${response.status}`);
    }
  } catch (error) {
    console.error("Error fetching addresses for CREATE form:", error);
    populateAddressSelectFromCachedProperties(addressSelect, properties);
  }
}

async function handleInlineFormSubmit(event) {
  event.preventDefault();

  const descEditor = document.getElementById("addDescriptionEditor");
  const descTextarea = document.getElementById("addDescription");
  if (descEditor && descTextarea) {
    descTextarea.value = descEditor.innerHTML;
  }

  if (!validateForm(false)) {
    const submitBtn = document.getElementById("inlineSubmitBtn");
    submitBtn.style.animation = "shake 0.5s ease-in-out";
    setTimeout(() => {
      submitBtn.style.animation = "";
    }, 500);

    showInlineErrorMessage(
      "Please fix the validation errors before submitting."
    );
    return;
  }

  const submitBtn = document.getElementById("inlineSubmitBtn");
  const originalText = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i> Adding Property...';

    const formData = new FormData(event.target);

    const addressSelect = document.getElementById("inlineAddressSelect");
    if (addressSelect.value && addressSelect.value !== "") {
      if (addressSelect.value.startsWith("temp_")) {
        const selectedOption =
          addressSelect.options[addressSelect.selectedIndex];
        const addressData = JSON.parse(selectedOption.dataset.addressData);

        delete addressData.address_id;
        delete addressData.is_new;

        Object.entries(addressData).forEach(([key, value]) => {
          if (value && value.trim()) {
            formData.append(key, value);
          }
        });

        formData.delete("address_id");
      } else {
        formData.set("address_id", addressSelect.value);
      }
    } else {
      formData.delete("address_id");
    }

    const uploadContainer = document.getElementById(
      "inlineImageUploadContainer"
    );
    const uploadedImage = uploadContainer.getUploadedImage();
    if (uploadedImage) {
      formData.set("display_image", uploadedImage);
    }

    const response = await fetch(API_BASE_URL + "/create-property", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage;
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error ||
            errorData.message ||
            `Server error: ${response.status}`;
        } catch (jsonError) {
          console.error("Failed to parse error JSON:", jsonError);
          errorMessage = `Server error: ${response.status} - ${response.statusText}`;
        }
      } else {
        try {
          const errorText = await response.text();
          console.error("Server error response:", errorText);
          errorMessage =
            errorText ||
            `Server error: ${response.status} - ${response.statusText}`;
        } catch (textError) {
          console.error("Failed to get error text:", textError);
          errorMessage = `Server error: ${response.status} - ${response.statusText}`;
        }
      }

      throw new Error(errorMessage);
    }

    let result;
    try {
      const responseText = await response.text();

      if (!responseText.trim()) {
        throw new Error("Server returned empty response");
      }

      result = JSON.parse(responseText);
    } catch (jsonError) {
      console.error("Failed to parse success response:", jsonError);
      throw new Error("Server returned invalid response format");
    }

    await loadProperties();

    showInlineSuccessMessage("Property added successfully!");
    resetInlineFormSilently();

    setTimeout(() => {
      navigateToPropertiesListDirectly();
    }, 1500);
  } catch (error) {
    console.error("Error creating property:", error);
    showInlineErrorMessage(
      error.message || "Failed to add property. Please try again."
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function resetInlineFormSilently() {
  const form = document.getElementById("inlineAddPropertyForm");
  if (form) {
    form.reset();
  }

  clearAllErrors(false);

  const uploadContainer = document.getElementById("inlineImageUploadContainer");
  const uploadPrompt = document.getElementById("inlineUploadPrompt");
  const imagePreview = document.getElementById("inlineImagePreview");
  const fileInput = document.getElementById("inlineDisplayImageInput");

  if (fileInput) fileInput.value = "";
  if (uploadPrompt) uploadPrompt.style.display = "block";
  if (imagePreview) imagePreview.style.display = "none";

  // Clear address selection (no inline new address form anymore)
  const addressSelect = document.getElementById("inlineAddressSelect");
  if (addressSelect) {
    addressSelect.selectedIndex = 0;
    if (window.inlineAddressTomSelect) {
      window.inlineAddressTomSelect.clear(true);
    }
  }

  // Remove any remnants of inline new-address UI if present
  const newAddressForm = document.getElementById("inlineNewAddressForm");
  const addNewAddressBtn = document.getElementById("inlineAddNewAddressBtn");
  if (newAddressForm) newAddressForm.remove();
  if (addNewAddressBtn) addNewAddressBtn.remove();

  const descEditor = document.getElementById("addDescriptionEditor");
  if (descEditor) descEditor.innerHTML = "";
}

function setupInlineForm() {
  if (inlineFormHandler) return;
  // Initialize add form components (image upload, validation). Address creation removed.
  setupInlineImageUpload();
  setupRealTimeValidation(false);
  const formEl = document.getElementById("inlineAddPropertyForm");
  if (formEl) formEl.addEventListener("submit", handleInlineFormSubmit);
  // Load existing addresses into select (no inline creation capability now).
  loadInlineAddresses();
  inlineFormHandler = true;
}

function resetInlineForm() {
  const form = document.getElementById("inlineAddPropertyForm");
  if (form) {
    form.reset();
  }

  clearAllErrors(false);

  const uploadContainer = document.getElementById("inlineImageUploadContainer");
  const uploadPrompt = document.getElementById("inlineUploadPrompt");
  const imagePreview = document.getElementById("inlineImagePreview");
  const fileInput = document.getElementById("inlineDisplayImageInput");

  if (fileInput) fileInput.value = "";
  if (uploadPrompt) uploadPrompt.style.display = "block";
  if (imagePreview) imagePreview.style.display = "none";

  // Remove any inline new address elements if they still exist
  const lingeringNewAddressForm = document.getElementById("inlineNewAddressForm");
  const lingeringAddBtn = document.getElementById("inlineAddNewAddressBtn");
  if (lingeringNewAddressForm) lingeringNewAddressForm.remove();
  if (lingeringAddBtn) lingeringAddBtn.remove();

  if (window.inlineAddressTomSelect) {
    window.inlineAddressTomSelect.destroy();
    window.inlineAddressTomSelect = null;
  }
  if (window.editInlineAddressTomSelect) {
    window.editInlineAddressTomSelect.destroy();
    window.editInlineAddressTomSelect = null;
  }
}

function showInlineSuccessMessage(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    z-index: 1000000;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    animation: slideIn 0.3s ease;
  `;
  notification.innerHTML = `<i class="fas fa-check-circle me-2"></i>${message}`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showInlineErrorMessage(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    z-index: 1000000;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    animation: slideIn 0.3s ease;
  `;
  notification.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>${message}`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

const FIELD_VALIDATION_RULES = {
  propertyName: {
    required: true,
    message: "Property name is required",
  },
  floorArea: {
    required: true,
    min: 0.01,
    message: "Floor area must be greater than 0",
  },
  propertyStatus: {
    required: true,
    message: "Property status is required",
  },
  baseRent: {
    required: true,
    min: 0,
    message: "Monthly rent must be greater than or equal to 0",
  },
  advanceMonths: {
    required: true,
    min: 0,
    message: "Advance payment must be greater than or equal to 0",
  },
  securityDeposit: {
    required: true,
    min: 0,
    message: "Security deposit must be greater than or equal to 0",
  },
  leaseTerm: {
    required: true,
    min: 1,
    message: "Minimum lease term must be at least 1 month",
  },
};

function getFieldConfig(fieldName, isEditForm = false) {
  const baseConfig = FIELD_VALIDATION_RULES[fieldName];
  const prefix = isEditForm ? "edit" : "";
  const capitalizedFieldName =
    fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

  return {
    id: isEditForm ? `edit${capitalizedFieldName}` : fieldName,
    errorId: isEditForm
      ? `edit${capitalizedFieldName}Error`
      : `${fieldName}Error`,
    ...baseConfig,
  };
}

function validateField(fieldConfig) {
  const field = document.getElementById(fieldConfig.id);
  const errorElement = document.getElementById(fieldConfig.errorId);

  if (!field || !errorElement) {
    console.warn(`Field or error element not found: ${fieldConfig.id}`);
    return true;
  }

  const value = field.value.trim();

  clearFieldError(field, errorElement);

  if (fieldConfig.required && !value) {
    showFieldError(field, errorElement, fieldConfig.message);
    return false;
  }

  if (fieldConfig.min !== undefined && value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < fieldConfig.min) {
      showFieldError(field, errorElement, fieldConfig.message);
      return false;
    }
  }

  showFieldSuccess(field);
  return true;
}

function showFieldError(field, errorElement, message) {
  field.classList.add("error");
  field.classList.remove("success");
  errorElement.innerHTML = `<i class="fas fa-exclamation-circle"></i>${message}`;
  errorElement.classList.add("show");

  const label = field.closest(".form-group").querySelector("label");
  if (label) {
    label.classList.add("required-highlight");
    setTimeout(() => label.classList.remove("required-highlight"), 500);
  }
}

function showFieldSuccess(field) {
  field.classList.remove("error");
  field.classList.add("success");
}

function clearFieldError(field, errorElement) {
  field.classList.remove("error", "success");
  errorElement.classList.remove("show");
  errorElement.innerHTML = "";
}

function validateForm(isEditForm = false) {
  const formContainer = isEditForm
    ? "#editPropertyFormContainer"
    : "#addPropertyFormContainer";

  clearAllErrors(isEditForm);

  const errors = [];
  let isValid = true;

  Object.keys(FIELD_VALIDATION_RULES).forEach((fieldName) => {
    const fieldConfig = getFieldConfig(fieldName, isEditForm);
    if (!validateField(fieldConfig)) {
      errors.push(fieldConfig.message);
      isValid = false;
    }
  });

  if (errors.length > 0) {
    showValidationSummary(errors, isEditForm);

    const firstErrorField = document.querySelector(
      `${formContainer} .form-group input.error, ${formContainer} .form-group select.error`
    );
    if (firstErrorField) {
      firstErrorField.scrollIntoView({ behavior: "smooth", block: "center" });
      firstErrorField.focus();
    }
  }

  return isValid;
}

function clearAllErrors(isEditForm = false) {
  Object.keys(FIELD_VALIDATION_RULES).forEach((fieldName) => {
    const fieldConfig = getFieldConfig(fieldName, isEditForm);
    const field = document.getElementById(fieldConfig.id);
    const errorElement = document.getElementById(fieldConfig.errorId);
    if (field && errorElement) {
      clearFieldError(field, errorElement);
    }
  });

  const summaryId = isEditForm ? "editValidationSummary" : "validationSummary";
  const validationSummary = document.getElementById(summaryId);
  if (validationSummary) {
    validationSummary.classList.remove("show");
  }
}

function showValidationSummary(errors, isEditForm = false) {
  const summaryId = isEditForm ? "editValidationSummary" : "validationSummary";
  const formContainer = isEditForm
    ? "#editPropertyFormContainer"
    : "#addPropertyFormContainer";

  let validationSummary = document.getElementById(summaryId);
  if (!validationSummary) {
    validationSummary = document.createElement("div");
    validationSummary.id = summaryId;
    validationSummary.className = "validation-summary";

    const firstFormSection = document.querySelector(
      `${formContainer} .form-section`
    );
    if (firstFormSection) {
      firstFormSection.insertBefore(
        validationSummary,
        firstFormSection.firstChild
      );
    }
  }

  const errorList = errors.map((error) => `<li>${error}</li>`).join("");
  validationSummary.innerHTML = `
    <h5><i class="fas fa-exclamation-triangle me-2"></i>Please fix the following errors:</h5>
    <ul>${errorList}</ul>
  `;

  validationSummary.classList.add("show");
  validationSummary.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupRealTimeValidation(isEditForm = false) {
  const formContainer = isEditForm
    ? "#editPropertyFormContainer"
    : "#addPropertyFormContainer";

  Object.keys(FIELD_VALIDATION_RULES).forEach((fieldName) => {
    const fieldConfig = getFieldConfig(fieldName, isEditForm);
    const field = document.getElementById(fieldConfig.id);

    if (field) {
      field.removeEventListener("blur", field._validateOnBlur);
      field.removeEventListener("input", field._clearErrorOnInput);

      field._validateOnBlur = () => validateField(fieldConfig);
      field.addEventListener("blur", field._validateOnBlur);

      field._clearErrorOnInput = () => {
        if (field.classList.contains("error")) {
          const errorElement = document.getElementById(fieldConfig.errorId);
          clearFieldError(field, errorElement);

          const remainingErrors = document.querySelectorAll(
            `${formContainer} .error-message.show`
          );
          if (remainingErrors.length === 0) {
            const summaryId = isEditForm
              ? "editValidationSummary"
              : "validationSummary";
            const validationSummary = document.getElementById(summaryId);
            if (validationSummary) {
              validationSummary.classList.remove("show");
            }
          }
        }
      };
      field.addEventListener("input", field._clearErrorOnInput);
    }
  });
}

function resetEditInlineForm() {
  const form = document.getElementById("inlineEditPropertyForm");
  if (form) {
    form.reset();
  }

  clearAllErrors(true);

  const uploadContainer = document.getElementById(
    "editInlineImageUploadContainer"
  );
  const uploadPrompt = document.getElementById("editInlineUploadPrompt");
  const imagePreview = document.getElementById("editInlineImagePreview");
  const fileInput = document.getElementById("editInlineDisplayImageInput");

  if (fileInput) fileInput.value = "";
  if (uploadPrompt) uploadPrompt.style.display = "block";
  if (imagePreview) imagePreview.style.display = "none";

  editShowcaseImages = [];
  deletedShowcaseImages = [];
  renderEditShowcasePreview();

  // Inline new-address UI removed; nothing to reset here
}

function navigateToPropertiesListDirectly() {
  isAddingProperty = false;
  isEditingProperty = false;
  currentEditPropertyId = null;

  const addContainer = document.getElementById("addPropertyFormContainer");
  const editContainer = document.getElementById("editPropertyFormContainer");
  const detailsContainer = document.getElementById(
    "propertyDetailsViewContainer"
  );

  if (addContainer) addContainer.style.display = "none";
  if (editContainer) editContainer.style.display = "none";
  if (detailsContainer) detailsContainer.style.display = "none";

  showPropertiesGrid();
  updateBreadcrumb();
  resetInlineFormSilently();
  resetEditInlineForm();

  const addPropertyBtn = document.querySelector(".new-ticket-btn");
  const propertyControls = document.getElementById("propertyControls");

  if (addPropertyBtn) addPropertyBtn.style.display = "flex";
  if (propertyControls) propertyControls.style.display = "flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showPropertyDetails(propertyId) {
  document.getElementById("propertiesGrid").style.display = "none";
  const addContainer = document.getElementById("addPropertyFormContainer");
  const editContainer = document.getElementById("editPropertyFormContainer");
  const paginationContainer = document.getElementById("paginationContainer");

  if (paginationContainer) paginationContainer.style.display = "none";
  if (addContainer) addContainer.style.display = "none";
  if (editContainer) editContainer.style.display = "none";

  const detailsContainer = document.getElementById(
    "propertyDetailsViewContainer"
  );
  if (detailsContainer) detailsContainer.style.display = "block";

  const property = properties.find((p) => p.id === propertyId);
  updateBreadcrumb([
    {
      text: '<i class="fas fa-home me-2"></i>Properties',
      onclick: "navigateToPropertiesListDirectly()",
    },
    {
      text: `<i class="fas fa-eye me-2"></i>${property ? property.property_name : "Property Details"
        }`,
      active: true,
    },
  ]);

  if (property) {
    populatePropertyDetails(property);
  }
}

function hidePropertyDetails() {
  const detailsContainer = document.getElementById(
    "propertyDetailsViewContainer"
  );
  if (detailsContainer) detailsContainer.style.display = "none";

  const addressFilterDropdown = document.getElementById(
    "addressFilterDropdownContainer"
  );
  if (addressFilterDropdown) addressFilterDropdown.style.display = "none";
}

async function removeProperty(propertyId) {
  
  
  const confirmFn =
    typeof window !== "undefined" && typeof window.showConfirm === "function"
      ? ((msg, title) => window.showConfirm(msg, title))
      : (msg => Promise.resolve(confirm(String(msg))));

  const ok = !!(await confirmFn(
    "Are you sure you want to delete this property? This action cannot be undone.",
    "Delete Property"
  ));
  if (!ok) return;

  try {
    const response = await fetch(`${API_BASE_URL}/${propertyId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (response.ok) {
      const result = await response.json();
      showSuccessMessage(result.message || "Property deleted successfully!");
      
      await loadProperties(1, pageSize);
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = errorData.message || `Failed to delete property: ${response.status}`;
      console.warn("Delete property failed:", errMsg);
      showErrorMessage(errMsg);
    }
  } catch (error) {
    console.error("Error deleting property:", error);
    showErrorMessage(error.message || "Failed to delete property");
  }
}

function populatePropertyDetails(property) {
  const titleElement = document.getElementById("detailsTitle");
  if (titleElement) {
    titleElement.textContent = property.property_name || "Property Details";
  }

  const allImages = [];
  if (property.display_image) {
    allImages.push({
      url: property.display_image,
      description: "Main Display Image",
    });
  }
  if (property.property_pictures && property.property_pictures.length > 0) {
    property.property_pictures.forEach((picture, index) => {
      allImages.push({
        url: picture.image_url,
        description: picture.image_desc || `Showcase Image ${index + 1}`,
      });
    });
  }
  if (allImages.length === 0) {
    allImages.push({
      url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
      description: "No Image Available",
    });
  }

  let currentIndex = 0;

  const mainImg = document.getElementById("carouselMainImage");
  const desc = document.getElementById("carouselImageDescription");
  const prevBtn = document.getElementById("carouselPrevBtn");
  const nextBtn = document.getElementById("carouselNextBtn");
  const thumbs = document.getElementById("carouselThumbnails");
  const zoomBtn = document.getElementById("zoomImageBtn");

  function updateCarousel(idx) {
    currentIndex = idx;
    mainImg.src = allImages[idx].url;
    mainImg.alt = allImages[idx].description;
    desc.textContent = allImages[idx].description || "";
    thumbs.querySelectorAll(".carousel-thumbnail").forEach((thumb, i) => {
      thumb.classList.toggle("active", i === idx);
    });
    prevBtn.style.display = allImages.length > 1 ? "" : "none";
    nextBtn.style.display = allImages.length > 1 ? "" : "none";
    zoomBtn.style.display = "block";
  }

  thumbs.innerHTML = allImages
    .map(
      (img, i) =>
        `<img src="${img.url}" alt="Thumb ${i + 1}" class="carousel-thumbnail${i === 0 ? " active" : ""
        }" data-idx="${i}">`
    )
    .join("");
  thumbs.querySelectorAll(".carousel-thumbnail").forEach((thumb, i) => {
    thumb.onclick = () => updateCarousel(i);
  });

  prevBtn.onclick = () =>
    updateCarousel((currentIndex - 1 + allImages.length) % allImages.length);
  nextBtn.onclick = () => updateCarousel((currentIndex + 1) % allImages.length);

  zoomBtn.onclick = () => openZoomModal(allImages[currentIndex].url);

  updateCarousel(0);

  document.getElementById("detailPropertyName").textContent =
    property.property_name || "N/A";
  document.getElementById("detailFloorArea").textContent =
    property.floor_area_sqm ? `${property.floor_area_sqm} m²` : "N/A";
  document.getElementById("detailLocation").textContent =
    property.location || "N/A";
  document.getElementById("detailDescription").innerHTML =
    property.description || "<em>No description available</em>";
  document.getElementById("detailStatus").textContent =
    property.status.charAt(0).toUpperCase() + property.status.slice(1);
  document.getElementById("detailStatus").className =
    "details-value status " + property.status;

  document.getElementById(
    "detailPrice"
  ).textContent = `₱${property.base_rent.toLocaleString()}`;
  document.getElementById(
    "detailLeaseTerm"
  ).textContent = `${property.minimum_lease_term_months} months`;
  document.getElementById(
    "detailSecurityDeposit"
  ).textContent = `${property.security_deposit_months} months`;
  document.getElementById(
    "detailAdvanceMonths"
  ).textContent = `${property.advance_months} months`;
  document.getElementById("detailLastUpdated").textContent = formatDate(
    property.updated_at
  );
}

function openZoomModal(imgSrc) {
  const modal = document.getElementById("zoomImageModal");
  const img = document.getElementById("zoomedImage");
  if (modal && img) {
    img.src = imgSrc;
    modal.style.display = "flex";
    document.body.classList.add("modal-open");
  }
}

function closeZoomModal() {
  const modal = document.getElementById("zoomImageModal");
  if (modal) {
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
  }
}


function showSuccessMessage(message) {
  try {
    if (typeof showInlineSuccessMessage === "function") {
      showInlineSuccessMessage(message || "Success");
      return;
    }
  } catch (e) {
    /* fallback below */
  }
  
  alert(message || "Success");
}

function showErrorMessage(message) {
  try {
    if (typeof showInlineErrorMessage === "function") {
      showInlineErrorMessage(message || "An error occurred");
      return;
    }
  } catch (e) {
    /* fallback below */
  }
  
  alert(message || "An error occurred");
}

window.removeEditShowcaseImage = removeEditShowcaseImage;
window.openAddModal = openAddModal;
window.closeAddModal = closeAddModal;
window.openEditPropertyForm = openEditPropertyForm;
window.closeEditModal = closeEditModal;
window.closeDetailsModal = closeDetailsModal;
window.showPropertyDetails = showPropertyDetails;
window.toggleDropdown = toggleDropdown;
window.filterByStatus = filterByStatus;
window.closeZoomModal = closeZoomModal;
window.showAddPropertyForm = showAddPropertyForm;
window.hideAddPropertyForm = hideAddPropertyForm;
window.showEditPropertyForm = showEditPropertyForm;
window.hideEditPropertyForm = hideEditPropertyForm;
window.navigateToPropertiesListDirectly = navigateToPropertiesListDirectly;
window.removeProperty = removeProperty;
window.showErrorMessage = showErrorMessage;
window.showSuccessMessage = showSuccessMessage;

window.goToPage = function (page) {
  const totalPages = Math.ceil(totalProperties / pageSize);
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  if (page === currentPage) return;
  currentPage = page;
  loadProperties(page, pageSize);
  const grid = document.getElementById("propertiesGrid");
  if (grid) {
    grid.scrollIntoView({ behavior: "smooth" });
  }
};

const style = document.createElement("style");
style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
document.head.appendChild(style);
