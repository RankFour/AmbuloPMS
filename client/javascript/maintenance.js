import formatCurrency from "../utils/formatCurrency.js";
import formatStatus from "../utils/formatStatus.js";
import formatRequestType from "../utils/formatRequestType.js";
import formatPriority from "../utils/formatPriority.js";
import formatDate from "../utils/formatDate.js";
import formatAttachments from "../utils/formatAttachments.js";
import fetchCompanyDetails from "../api/loadCompanyInfo.js";

// Lightweight dialog adapter: prefers app modal helpers when available, falls back to native dialogs.
const showAlert = (msg, type = 'info') => {
  try {
    if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
      window.showAlert(String(msg), type);
      return;
    }
  } catch (e) {
    // ignore and fallback
  }
  // fallback (synchronous)
  alert(String(msg));
};

const showConfirm = async (msg, title = 'Confirm') => {
  try {
    if (typeof window !== 'undefined' && typeof window.showConfirm === 'function') {
      return !!(await window.showConfirm(String(msg), title));
    }
  } catch (e) {
    // ignore and fallback
  }
  return confirm(String(msg));
};

const showPrompt = async (msg, placeholder = '', title = 'Input', inputType = 'text') => {
  try {
    if (typeof window !== 'undefined' && typeof window.showPrompt === 'function') {
      return await window.showPrompt(String(msg), placeholder, title, inputType);
    }
  } catch (e) {
    // ignore and fallback
  }
  return prompt(String(msg), placeholder);
};

let allUsers = [];
let allProperties = [];
let userLeases = {};


let tickets = [];
let allTickets = [];
let currentlyExpandedTicket = null;

let minDate = null;
let maxDate = null;
let currentFromDate = null;
let currentToDate = null;

let tenantsList = [];
let filteredTenants = [];
let selectedTenantIndex = -1;



const _ticketsCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; 

function setCache(key, value) {
  const record = { value, ts: Date.now() };
  _ticketsCache.set(key, record);
}

function getCache(key) {
  const record = _ticketsCache.get(key);
  if (!record) return null;
  if (Date.now() - record.ts > CACHE_TTL_MS) {
    _ticketsCache.delete(key);
    return null;
  }
  return record.value;
}

function invalidateCacheByPrefix(prefix) {
  
  const keys = Array.from(_ticketsCache.keys());
  for (const k of keys) {
    if (k.startsWith(prefix)) {
      _ticketsCache.delete(k);
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const profileBtn = document.getElementById("profileBtn");
  const dropdownMenu = document.getElementById("profileMenu");

  if (profileBtn && dropdownMenu) {
    profileBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
    });

    document.addEventListener("click", function (event) {
      if (
        !profileBtn.contains(event.target) &&
        !dropdownMenu.contains(event.target)
      ) {
        dropdownMenu.classList.remove("show");
      }
    });
  }

  const logoutLink = document.querySelector('a[href="login.html"]');
  if (logoutLink) {
    logoutLink.addEventListener("click", function (e) {
      e.preventDefault();
      logout();
    });
  }

  initializeFilters();
  loadTickets();

  setInterval(checkAndUpdateTicketStatuses, 1 * 60 * 1000);
  setTimeout(checkAndUpdateTicketStatuses, 2000);

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", filterTickets);
  }


  const statusFilter = document.getElementById("statusFilter");
  const priorityFilter = document.getElementById("priorityFilter");
  const requestTypeFilter = document.getElementById("requestTypeFilter");

  if (statusFilter) {
    statusFilter.addEventListener("change", filterTickets);
  }
  if (priorityFilter) {
    priorityFilter.addEventListener("change", filterTickets);
  }
  if (requestTypeFilter) {
    requestTypeFilter.addEventListener("change", filterTickets);
  }

  initializeDatePickers();

  initializeFileUpload();
  initializeModal();
  initializeEditModal();

  const sidebarToggle =
    document.querySelector(".mobile-menu-btn") ||
    document.querySelector(".sidebar-toggle") ||
    document.querySelector("[data-sidebar-toggle]");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      const mainContent = document.getElementById("mainContent");
      const isExpanded = mainContent.classList.contains("expanded");

      if (isExpanded) {
        mainContent.classList.remove("expanded");
      } else {
        mainContent.classList.add("expanded");
      }
    });
  }

  const sidebar =
    document.querySelector(".sidebar") ||
    document.querySelector("#sidebar") ||
    document.querySelector("[data-sidebar]");

  if (sidebar) {
    const sidebarRect = sidebar.getBoundingClientRect();
    const isVisible =
      sidebarRect.width > 0 &&
      window.getComputedStyle(sidebar).visibility !== "hidden";

    const mainContent = document.getElementById("mainContent");
    if (!isVisible) {
      mainContent.classList.add("expanded");
    }
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
    ? `Maintenance - ${company.company_name}`
    : "Maintenance";
}

document.addEventListener("DOMContentLoaded", () => {
  setDynamicInfo();
});

function initializeFilters() {

  const statusFilter = document.getElementById("statusFilter");
  if (statusFilter) {
    Object.keys(AppConstants.STATUS_MAPPINGS).forEach(status => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = AppConstants.STATUS_MAPPINGS[status].label;
      statusFilter.appendChild(option);
    });
  }


  const priorityFilter = document.getElementById("priorityFilter");
  if (priorityFilter) {
    Object.keys(AppConstants.PRIORITY_MAPPINGS).forEach(priority => {
      const option = document.createElement("option");
      option.value = priority;
      option.textContent = AppConstants.PRIORITY_MAPPINGS[priority].label;
      priorityFilter.appendChild(option);
    });
  }


  const requestTypeFilter = document.getElementById("requestTypeFilter");
  if (requestTypeFilter) {
    AppConstants.TICKET_REQUEST_TYPES.forEach(type => {
      const option = document.createElement("option");
      option.value = type.value;
      option.textContent = type.label;
      requestTypeFilter.appendChild(option);
    });
  }
}


async function fetchAllUsersAndProperties() {

  let page = 1;
  let users = [];
  let hasMore = true;
  while (hasMore) {
    const usersRes = await fetch(`/api/v1/users?page=${page}`, { credentials: "include" });
    const usersData = await usersRes.json();
    const pageUsers = usersData.users || [];
    users = users.concat(pageUsers);
    hasMore = pageUsers.length === 6;
    page++;
  }
  allUsers = users;

  let props = [];
  let propPage = 1;
  let propHasMore = true;
  while (propHasMore) {
    const propsRes = await fetch(`/api/v1/properties?page=${propPage}`, { credentials: "include" });
    const propsData = await propsRes.json();
    const pageProps = propsData.properties || [];
    props = props.concat(pageProps);
    propHasMore = pageProps.length === 6;
    propPage++;
  }
  allProperties = props;

  const leasesRes = await fetch("/api/v1/leases", { credentials: "include" });
  const leasesData = await leasesRes.json();
  userLeases = {};
  (leasesData.leases || []).forEach(lease => {
    if (!userLeases[lease.user_id]) userLeases[lease.user_id] = [];
    userLeases[lease.user_id].push({ lease_id: lease.lease_id, property_id: lease.property_id });
  });
}

function populateRequestedByDropdown() {
  const requestedBySelect = document.getElementById("requestedBy");
  if (!requestedBySelect) return;
  requestedBySelect.innerHTML = "";

  allUsers.forEach(user => {
    const hasActiveLease = userLeases[user.user_id] && userLeases[user.user_id].length > 0;
    if (hasActiveLease) {
      const option = document.createElement("option");
      option.value = user.user_id;
      let nameParts = [user.first_name, user.middle_name, user.last_name, user.suffix].filter(Boolean);
      let displayName = nameParts.join(" ");
      if (!displayName) displayName = user.full_name || user.name || user.username || "";
      option.textContent = displayName;
      option.setAttribute("data-userid", user.user_id);
      requestedBySelect.appendChild(option);
    }
  });

  const adminOptionExists = Array.from(requestedBySelect.options).some(opt => opt.value === "ADMIN");
  if (!adminOptionExists) {
    const adminOption = document.createElement("option");
    adminOption.value = "ADMIN";
    adminOption.textContent = "Admin";
    adminOption.setAttribute("data-userid", "ADMIN");
    requestedBySelect.appendChild(adminOption);
  }
}

function populateUnitNoDropdown(userId) {
  const unitNoSelect = document.getElementById("unitNo");
  if (!unitNoSelect) return;
  unitNoSelect.innerHTML = "";
  let options = [];
  if (!userId) return;

  if (userId === "ADMIN") {
    options = allProperties.map(prop => {
      const hasLease = Object.values(userLeases).some(leases => leases.some(l => l.property_id === prop.property_id));
      let label = prop.property_name;
      if (hasLease) {
        label = "\u{1F7E2} " + label;
      }
      return { value: prop.property_id, label, address: prop.building_address || "" };
    });
  } else {
    const user = allUsers.find(u => u.user_id === userId);
    if (user && user.role === "ADMIN") {
      options = allProperties.map(prop => ({ value: prop.property_id, label: prop.property_name, address: prop.building_address || "" }));
    } else if (userLeases[userId]) {
      options = userLeases[userId].map(lease => {
        const prop = allProperties.find(p => p.property_id === lease.property_id);
        return prop ? { value: lease.lease_id, label: prop.property_name, address: prop.building_address || "" } : null;
      }).filter(Boolean);
    }
  }
  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.innerHTML = `<span style='font-weight:500;'>${opt.label}</span>${opt.address ? `<br><span style='font-size:12px;color:#888;'>${opt.address}</span>` : ""}`;
    if (opt.address) {
      option.setAttribute("data-address", opt.address);
    }
    unitNoSelect.appendChild(option);
  });

  if (unitNoSelect.tomselect) {
    unitNoSelect.tomselect.clearOptions();
    options.forEach(opt => {
      unitNoSelect.tomselect.addOption({ value: opt.value, text: opt.label, address: opt.address });
    });
    unitNoSelect.tomselect.refreshOptions(false);
  }
}

function initializeTomSelectDropdowns() {
  new TomSelect("#requestedBy", {
    create: false,
    sortField: { field: "text", direction: "asc" },
    placeholder: "Select or search user...",
    pagination: false,
    maxOptions: 1000,
    onChange: function (value) {
      const unitNoSelect = document.getElementById("unitNo");
      if (unitNoSelect) {
        while (unitNoSelect.options.length > 0) {
          unitNoSelect.remove(0);
        }
        if (unitNoSelect.tomselect) {
          unitNoSelect.tomselect.clear();
          unitNoSelect.tomselect.clearOptions();
          unitNoSelect.tomselect.refreshOptions(false);
        }
      }
      populateUnitNoDropdown(value);
      if (unitNoSelect && unitNoSelect.options.length === 1) {
        unitNoSelect.selectedIndex = 0;
      }
    },
    render: {
      option: function (data, escape) {

        let userId = "";
        if (data.$option) {
          userId = data.$option.getAttribute("data-userid") || "";
        }
        return `<div>
          <div style='font-weight:500;'>${escape(data.text)}</div>
          <div style='font-size:12px;color:#888;'>${escape(userId)}</div>
        </div>`;
      },
      item: function (data, escape) {
        return `<div style='font-weight:500;'>${escape(data.text)}</div>`;
      }
    }
  });
  new TomSelect("#unitNo", {
    create: false,
    sortField: { field: "text", direction: "asc" },
    placeholder: "Select property...",
    render: {
      option: function (data, escape) {
        let address = data.address || "";
        return `<div>
          <div style='font-weight:500;'>${escape(data.text)}</div>
          ${address ? `<div style='font-size:12px;color:#888;'>${escape(address)}</div>` : ""}
        </div>`;
      },
      item: function (data, escape) {
        return `<div style='font-weight:500;'>${escape(data.text)}</div>`;
      }
    }
  });
}

async function setupNewTicketModalDropdowns() {
  await fetchAllUsersAndProperties();
  populateRequestedByDropdown();
  initializeTomSelectDropdowns();
}

document.addEventListener("DOMContentLoaded", () => {
  setupNewTicketModalDropdowns();
});

function initializeDatePickers() {
  const fromDateInput = document.getElementById("fromDate");
  const toDateInput = document.getElementById("toDate");

  if (fromDateInput && toDateInput) {
    fromDateInput.addEventListener("change", function () {
      currentFromDate = this.value;
      updateToDateRestrictions();
      filterTicketsByDateRange();
    });

    toDateInput.addEventListener("change", function () {
      currentToDate = this.value;
      updateFromDateRestrictions();
      filterTicketsByDateRange();
    });
  }
}

function updateDateRestrictions() {
  if (allTickets.length === 0) return;

  const createdDates = allTickets
    .map((ticket) => {
      const createdDate = new Date(ticket.created_at);
      return createdDate;
    })
    .filter((date) => !isNaN(date));

  const endDates = allTickets
    .map((ticket) => {
      if (ticket.end_date) {
        const endDate = new Date(ticket.end_date);
        return endDate;
      }
      return null;
    })
    .filter((date) => date !== null && !isNaN(date));
  if (createdDates.length === 0) return;

  minDate = new Date(Math.min(...createdDates));

  if (endDates.length > 0) {
    maxDate = new Date(Math.max(...endDates));
  } else {
    maxDate = new Date(Math.max(...createdDates));

  }

  const minDateStr = minDate.toISOString().split("T")[0];
  const maxDateStr = maxDate.toISOString().split("T")[0];

  const fromDateInput = document.getElementById("fromDate");
  const toDateInput = document.getElementById("toDate");

  if (fromDateInput && toDateInput) {
    fromDateInput.min = minDateStr;
    fromDateInput.max = maxDateStr;
    toDateInput.min = minDateStr;
    toDateInput.max = maxDateStr;

    if (!currentFromDate) {
      currentFromDate = minDateStr;
      fromDateInput.value = minDateStr;
    }

    if (!currentToDate) {
      currentToDate = maxDateStr;
      toDateInput.value = maxDateStr;
    }

  }
}

function updateToDateRestrictions() {
  const toDateInput = document.getElementById("toDate");
  if (toDateInput && currentFromDate) {
    toDateInput.min = currentFromDate;

    if (currentToDate && currentToDate < currentFromDate) {
      currentToDate = currentFromDate;
      toDateInput.value = currentFromDate;
    }
  }
}

function updateFromDateRestrictions() {
  const fromDateInput = document.getElementById("fromDate");
  if (fromDateInput && currentToDate) {
    fromDateInput.max = currentToDate;

    if (currentFromDate && currentFromDate > currentToDate) {
      currentFromDate = currentToDate;
      fromDateInput.value = currentToDate;
    }
  }
}

function filterTicketsByDateRange() {
  
  loadTickets();
}

function updateFilterStatus() {
  const fromDateInput = document.getElementById("fromDate");
  const toDateInput = document.getElementById("toDate");

  if (fromDateInput && toDateInput && currentFromDate && currentToDate) {
    const fromDate = new Date(currentFromDate);
    const toDate = new Date(currentToDate);

    const fromFormatted = fromDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const toFormatted = toDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const activeTickets = tickets.filter(
      (t) => t.ticket_status !== "completed"
    ).length;
  }
}

function filterTickets() {
  loadTickets();
}

async function loadTickets() {
  try {
    
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const priorityFilter = document.getElementById("priorityFilter");
    const requestTypeFilter = document.getElementById("requestTypeFilter");
    const fromDateInput = document.getElementById("fromDate");
    const toDateInput = document.getElementById("toDate");

    const params = new URLSearchParams();
    
    params.append("page", 1);
    params.append("limit", 10);
    if (searchInput && searchInput.value.trim() !== "") params.append("search", searchInput.value.trim());
    if (statusFilter && statusFilter.value && statusFilter.value !== "all") params.append("status", statusFilter.value);
    if (priorityFilter && priorityFilter.value && priorityFilter.value !== "all") params.append("priority", priorityFilter.value);
    if (requestTypeFilter && requestTypeFilter.value && requestTypeFilter.value !== "all") params.append("request_type", requestTypeFilter.value);
    if (fromDateInput && fromDateInput.value) params.append("from_date", fromDateInput.value);
    if (toDateInput && toDateInput.value) params.append("to_date", toDateInput.value);

    const url = `/api/v1/tickets?${params.toString()}`;
    
    const cacheKey = url;
    const cached = getCache(cacheKey);
    if (cached) {
      const data = cached;
      allTickets = data.tickets || [];
      tickets = allTickets;
      updateDateRestrictions();
      renderTickets();
      return;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: 'no-store'
    });

    if (response.ok) {
      const data = await response.json();
        
  try { setCache(cacheKey, data); } catch (e) { }

        allTickets = data.tickets || [];
        tickets = allTickets;

      updateDateRestrictions();

      renderTickets();
    } else {
      console.error("Failed to load tickets:", response.statusText);
      renderTickets();
    }
  } catch (error) {
    console.error("Error loading tickets:", error);
    renderTickets();
  }
}

function clearFilters() {
  const searchInput = document.getElementById("searchInput");
  const fromDateInput = document.getElementById("fromDate");
  const toDateInput = document.getElementById("toDate");
  const statusFilter = document.getElementById("statusFilter");
  const priorityFilter = document.getElementById("priorityFilter");
  const requestTypeFilter = document.getElementById("requestTypeFilter");
  if (searchInput) searchInput.value = "";
  
  if (statusFilter) statusFilter.value = "";
  if (priorityFilter) priorityFilter.value = "";
  if (requestTypeFilter) requestTypeFilter.value = "";
  if (fromDateInput) fromDateInput.value = "";
  if (toDateInput) toDateInput.value = "";

  loadTickets();
}

function renderTickets() {
  const container = document.getElementById("ticketsContainer");
  if (!container) return;

  

  const emptyRow = document.getElementById('emptyTicketsRow');
  if (tickets.length === 0) {
    
    if (emptyRow) {
      
      try {
        let html = emptyRow.outerHTML;
        
        if (/display\s*:\s*none/.test(html)) {
          html = html.replace(/display\s*:\s*none/g, 'display:table-row');
        } else {
          
          html = html.replace('<tr', '<tr style="display:table-row"');
        }
        container.innerHTML = html;
      } catch (e) {
        
        container.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px;">No maintenance tickets found</td></tr>`;
      }
    } else {
      container.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px;">No maintenance tickets found</td></tr>`;
    }
    return;
  }

  const ticketRows = tickets
    .map((ticket, index) => {
      const statusClass = ticket.ticket_status
        ? `status-${ticket.ticket_status.toLowerCase().replace(/[^a-z_]/g, "")}`
        : "status-pending";
      const priorityClass = ticket.priority
        ? `priority-${ticket.priority.toLowerCase()}`
        : "priority-medium";
      const isPending =
        ticket.ticket_status &&
        ticket.ticket_status.toUpperCase() ===
        AppConstants.TICKET_STATUSES.PENDING;


      const statusMapping = AppConstants.STATUS_MAPPINGS[ticket.ticket_status] || AppConstants.STATUS_MAPPINGS[AppConstants.TICKET_STATUSES.PENDING];
      const priorityMapping = AppConstants.PRIORITY_MAPPINGS[ticket.priority] || AppConstants.PRIORITY_MAPPINGS[AppConstants.PRIORITY_LEVELS.MEDIUM];

      let startDateDisplay = "Not set";
      let endDateDisplay = "Not set";
      if (ticket.start_datetime) {
        const dt = new Date(ticket.start_datetime);
        if (!isNaN(dt.getTime())) {
          startDateDisplay = formatDate(dt.toISOString(), false) +
            " " + dt.toTimeString().slice(0, 5);
        }
      }
      if (ticket.end_datetime) {
        const dt = new Date(ticket.end_datetime);
        if (!isNaN(dt.getTime())) {
          endDateDisplay = formatDate(dt.toISOString(), false) +
            " " + dt.toTimeString().slice(0, 5);
        }
      }

      return `
        <tr class="ticket-row" data-ticket-id="${ticket.ticket_id}" onclick="viewTicketDetails('${ticket.ticket_id}')" style="cursor: pointer;">
            <td class="row-number">${index + 1}</td>
            <td>
                <span class="status-badge ${statusClass}" style="background-color: ${statusMapping.color};">${statusMapping.label}</span>
            </td>
            <td class="ticket-title">${ticket.ticket_title || "N/A"}</td>
            <td>${ticket.requested_by_name || ticket.user_id || "Unknown"}</td>
            <td>${ticket.property_name || "N/A"}</td>
            <td>
                <span class="priority-badge ${priorityClass}" style="background-color: ${priorityMapping.color};">${priorityMapping.label}</span>
            </td>
            <td>${formatRequestType(ticket.request_type)}</td>
            <td>${startDateDisplay}</td>
            <td>${endDateDisplay}</td>
            <td class="row-actions">
                <button class="action-btn action-btn-edit" onclick="editTicket('${ticket.ticket_id}'); event.stopPropagation();" title="Update">
                    <i class="fas fa-edit"></i>
                </button>
                ${isPending ? `
                <button class="action-btn action-btn-assign" onclick="assignTicket('${ticket.ticket_id}'); event.stopPropagation();" title="Assign">
                    <i class="fas fa-user-plus"></i>
                </button>
                ` : ""}
                <button class="action-btn action-btn-delete" onclick="deleteTicket('${ticket.ticket_id}'); event.stopPropagation();" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
    })
    .join("");
  
  container.innerHTML = ticketRows;
  currentlyExpandedTicket = null;
}

function toggleTicketDetails(ticketId) {
  const details = document.getElementById(`details-${ticketId}`);
  const ticketItem = document.querySelector(`[data-ticket-id="${ticketId}"]`);
  const expandIcon = ticketItem ? ticketItem.querySelector(".expand-icon") : null;

  if (!details || !ticketItem || !expandIcon) return;

  if (currentlyExpandedTicket && currentlyExpandedTicket !== ticketId) {
    const currentDetails = document.getElementById(`details-${currentlyExpandedTicket}`);
    const currentTicketItem = document.querySelector(`[data-ticket-id="${currentlyExpandedTicket}"]`);
    const currentExpandIcon = currentTicketItem ? currentTicketItem.querySelector(".expand-icon") : null;
    if (currentDetails && currentExpandIcon && currentTicketItem) {
      currentDetails.classList.remove("expanded");
      currentExpandIcon.textContent = "▼";
      currentTicketItem.classList.remove("expanded");
    }
    setTimeout(() => {
      expandTicket(ticketId, details, ticketItem, expandIcon);
    }, 100);
  } else {
    if (details.classList.contains("expanded")) {
      details.classList.remove("expanded");
      expandIcon.textContent = "▼";
      ticketItem.classList.remove("expanded");
      currentlyExpandedTicket = null;
    } else {
      expandTicket(ticketId, details, ticketItem, expandIcon);
    }
  }
}

async function checkAndUpdateTicketStatuses() {
  try {
    const response = await fetch("/api/v1/tickets/update-ticket-statuses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (response.ok) {

      try { invalidateCacheByPrefix('/api/v1/tickets'); } catch (e) {}
      await loadTickets();
    }
  } catch (error) {
    console.error("Error updating ticket statuses:", error);
  }
}


async function editTicket(ticketId) {
  if (typeof event !== 'undefined' && event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }

  try {


    const response = await fetch(`/api/v1/tickets/${ticketId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch ticket details");
    }

    const result = await response.json();
    const ticket = result.ticket;

    const isCompleted =
      ticket.ticket_status &&
      ticket.ticket_status.toUpperCase() ===
      AppConstants.TICKET_STATUSES.COMPLETED;
    const isCancelled =
      ticket.ticket_status &&
      ticket.ticket_status.toUpperCase() ===
      AppConstants.TICKET_STATUSES.CANCELLED;

    if (isCompleted || isCancelled) {
      const statusText = isCompleted ? "completed" : "cancelled";
      const proceedMessage = `This ticket is ${statusText} and cannot be edited.\n\nWould you like to view its details anyway?`;
      const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
        ? ((msg, title) => window.showConfirm(msg, title))
        : (msg => Promise.resolve(confirm(String(msg))));
      const proceed = !!(await confirmFn(proceedMessage, 'Notice'));
      if (!proceed) {
        return;
      }
    }

    populateEditForm(ticket);

    const modal = document.getElementById("editTicketModal");
    modal.classList.add("active");
  } catch (error) {
    console.error("Error opening edit modal:", error);
    showAlert("Failed to load ticket details. Please try again.", 'error');
  }
}

function populateEditForm(ticket) {
  const editTicketId = document.getElementById("editTicketId");
  if (editTicketId) editTicketId.value = ticket.ticket_id;
  const editTicketIdDisplay = document.getElementById("editTicketIdDisplay");
  if (editTicketIdDisplay) editTicketIdDisplay.value = ticket.ticket_id;
  const editUnitNoLabel = document.querySelector('label[for="editUnitNo"]');
  if (editUnitNoLabel) editUnitNoLabel.textContent = "Unit/Property";
  const editUnitNo = document.getElementById("editUnitNo");
  if (editUnitNo) {
    let unitOrProperty = "";
    if (ticket.property_name) {
      unitOrProperty = ticket.property_name;
      if (ticket.unit_number) {
        unitOrProperty += ` (${ticket.unit_number})`;
      }
    } else if (ticket.unit_number) {
      unitOrProperty = ticket.unit_number;
    } else if (ticket.lease_id) {
      unitOrProperty = ticket.lease_id;
    }
    editUnitNo.value = unitOrProperty;
  }
  const editStatus = document.getElementById("editStatus");
  if (editStatus) editStatus.value = formatStatus(ticket.ticket_status);
  const editRequestedBy = document.getElementById("editRequestedBy");
  if (editRequestedBy) editRequestedBy.value = ticket.requested_by_name || "Unknown";
  const editCreatedAt = document.getElementById("editCreatedAt");
  if (editCreatedAt) editCreatedAt.value = formatDate(ticket.created_at, true);

  const isCompleted =
    ticket.ticket_status &&
    ticket.ticket_status.toUpperCase() ===
    AppConstants.TICKET_STATUSES.COMPLETED;
  const isCancelled =
    ticket.ticket_status &&
    ticket.ticket_status.toUpperCase() ===
    AppConstants.TICKET_STATUSES.CANCELLED;
  const isNotEditable = isCompleted || isCancelled;
  const isPendingOrAssigned =
    ticket.ticket_status &&
    (ticket.ticket_status.toUpperCase() ===
      AppConstants.TICKET_STATUSES.PENDING ||
      ticket.ticket_status.toUpperCase() ===
      AppConstants.TICKET_STATUSES.ASSIGNED);

  const editableFields = [
    "editTicketTitle",
    "editRequestType",
    "editPriority",
    "editStartDate",
    "editStartTime",
    "editEndDate",
    "editEndTime",
    "editMaintenanceCosts",
    "editDescription",
    "editNotes",
  ];

  editableFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.disabled = isNotEditable;
      if (isNotEditable) {
        field.classList.add("readonly-field");
      } else {
        field.classList.remove("readonly-field");
      }
    }
  });

  document.getElementById("editTicketTitle").value = ticket.ticket_title || "";
  document.getElementById("editRequestType").value = ticket.request_type || "";
  document.getElementById("editPriority").value = ticket.priority || "";
  document.getElementById("editMaintenanceCosts").value =
    ticket.maintenance_costs || "";
  document.getElementById("editDescription").value = ticket.description || "";
  document.getElementById("editNotes").value = ticket.notes || "";

  const startDateField = document.getElementById("editStartDate");
  const startTimeField = document.getElementById("editStartTime");
  if (startDateField && startTimeField) {
    let startDate = "";
    let startTime = "";
    if (ticket.start_datetime) {
      const dt = new Date(ticket.start_datetime);
      if (!isNaN(dt.getTime())) {
        startDate = dt.toISOString().split("T")[0];
        startTime = dt.toTimeString().slice(0, 5);
      }
    }
    startDateField.value = startDate;
    startTimeField.value = startTime;

    if (isNotEditable) {
      startDateField.disabled = true;
      startDateField.classList.add("readonly-field");
      startTimeField.disabled = true;
      startTimeField.classList.add("readonly-field");
    } else {
      startDateField.disabled = false;
      startDateField.classList.remove("readonly-field");
      startTimeField.disabled = false;
      startTimeField.classList.remove("readonly-field");
      startDateField.removeAttribute("min");
    }
  }

  const endDateField = document.getElementById("editEndDate");
  const endTimeField = document.getElementById("editEndTime");
  if (endDateField && endTimeField) {
    let endDate = "";
    let endTime = "";
    if (ticket.end_datetime) {
      const dt = new Date(ticket.end_datetime);
      if (!isNaN(dt.getTime())) {
        endDate = dt.toISOString().split("T")[0];
        endTime = dt.toTimeString().slice(0, 5);
      }
    }
    endDateField.value = endDate;
    endTimeField.value = endTime;

    if (isNotEditable) {
      endDateField.disabled = true;
      endDateField.classList.add("readonly-field");
      endTimeField.disabled = true;
      endTimeField.classList.add("readonly-field");
    } else {
      endDateField.disabled = false;
      endDateField.classList.remove("readonly-field");
      endTimeField.disabled = false;
      endTimeField.classList.remove("readonly-field");
    }
  }

  handleStatusFieldEditing(ticket, isPendingOrAssigned, isNotEditable);

  const assignedToGroup = document.getElementById("editAssignedToGroup");
  const assignedToInput = document.getElementById("editAssignedTo");

  if (ticket.assigned_to && ticket.assigned_to.trim() !== "") {
    assignedToGroup.style.display = "flex";
    assignedToInput.value = ticket.assigned_to;
    assignedToInput.disabled = true;
    assignedToInput.classList.add("readonly-field");
  } else {
    assignedToGroup.style.display = "none";
    assignedToInput.value = "";
  }

  const fileInput = document.getElementById("editFileInput");
  const attachmentsArea = document.querySelector(
    "#editTicketModal .attachments-area"
  );

  if (fileInput && attachmentsArea) {
    fileInput.disabled = isNotEditable;
    if (isNotEditable) {
      attachmentsArea.style.opacity = "0.5";
      attachmentsArea.style.pointerEvents = "none";
      const uploadText = attachmentsArea.querySelector(".upload-main");
      if (uploadText) {
        uploadText.textContent = "File upload disabled for this ticket status";
      }
    } else {
      attachmentsArea.style.opacity = "1";
      attachmentsArea.style.pointerEvents = "auto";
      initializeEditFileUpload(ticket);
    }
  }

  displayCurrentAttachments(Array.isArray(ticket.attachments) ? ticket.attachments.join(",") : ticket.attachments);

  if (!isNotEditable) {
    document.getElementById("editFileInput").value = "";
    resetEditFileUploadDisplay();
  }
  const submitBtn = document.querySelector("#editTicketModal .btn-submit");
  if (submitBtn) {
    submitBtn.disabled = isNotEditable;
    if (isNotEditable) {
      submitBtn.textContent = isCompleted
        ? "Cannot Edit Completed Ticket"
        : "Cannot Edit Cancelled Ticket";
      submitBtn.style.opacity = "0.5";
    } else {
      submitBtn.textContent = "Update Ticket";
      submitBtn.style.opacity = "1";
    }
  }
}

function handleStatusFieldEditing(ticket, isPendingOrAssigned, isNotEditable) {
  const statusGroup = document.getElementById("editStatus").parentElement;
  const currentStatus = ticket.ticket_status;

  const existingSelect = document.getElementById("editStatusSelect");
  if (existingSelect) {
    existingSelect.remove();
  }

  if (isPendingOrAssigned && !isNotEditable) {
    const statusSelect = document.createElement("select");
    statusSelect.id = "editStatusSelect";
    statusSelect.name = "ticket_status";
    statusSelect.className = "form-control";
    const currentOption = document.createElement("option");
    currentOption.value = "";
    currentOption.textContent = `Keep as ${formatStatus(
      currentStatus
    )}`;
    statusSelect.appendChild(currentOption);

    const cancelledOption = document.createElement("option");
    cancelledOption.value = AppConstants.TICKET_STATUSES.CANCELLED;
    cancelledOption.textContent = "Cancel Ticket";
    statusSelect.appendChild(cancelledOption);

    document.getElementById("editStatus").style.display = "none";
    statusGroup.appendChild(statusSelect);

    const label = statusGroup.querySelector("label");
    label.innerHTML =
      'Current Status <span style="color: #059669; font-size: 12px;">(Can be cancelled)</span>';
  } else {
    document.getElementById("editStatus").style.display = "block";

    const label = statusGroup.querySelector("label");
    label.innerHTML = "Current Status";
  }
}

function displayCurrentAttachments(attachments) {
  const currentAttachmentsGroup = document.getElementById(
    "currentAttachmentsGroup"
  );
  const currentAttachmentsList = document.getElementById(
    "currentAttachmentsList"
  );

  if (attachments && attachments.trim() !== "") {
    currentAttachmentsGroup.style.display = "block";
    currentAttachmentsList.innerHTML = formatAttachments(attachments);
  } else {
    currentAttachmentsGroup.style.display = "none";
  }
}

function closeEditTicketModal() {
  const modal = document.getElementById("editTicketModal");
  modal.classList.remove("active");

  document.getElementById("editTicketForm").reset();
  editSelectedFiles = [];
  currentTicketAttachments = [];
  resetEditFileUploadDisplay();
}

function resetEditFileUploadDisplay() {
  const uploadMain = document.querySelector("#editTicketModal .upload-main");
  const uploadSub = document.querySelector("#editTicketModal .upload-sub");
  const selectedFilesContainer = document.getElementById("editSelectedFiles");

  if (uploadMain) {
    uploadMain.textContent = "Click to upload files or drag and drop";
  }
  if (uploadSub) {
    uploadSub.textContent = "Maximum 5 files total (including existing)";
  }
  if (selectedFilesContainer) {
    selectedFilesContainer.innerHTML = "";
  }
}

let editSelectedFiles = [];
let currentTicketAttachments = [];

function initializeEditFileUpload(ticket) {
  editSelectedFiles = [];
  currentTicketAttachments = ticket.attachments ?
    (Array.isArray(ticket.attachments) ? ticket.attachments : ticket.attachments.split(',').filter(a => a.trim())) : [];

  const fileInput = document.getElementById("editFileInput");
  const attachmentsArea = document.querySelector("#editTicketModal .attachments-area");


  const newFileInput = fileInput.cloneNode(true);
  fileInput.parentNode.replaceChild(newFileInput, fileInput);


  newFileInput.addEventListener("change", handleEditFileSelection);


  attachmentsArea.addEventListener("dragover", handleEditDragOver);
  attachmentsArea.addEventListener("dragleave", handleEditDragLeave);
  attachmentsArea.addEventListener("drop", handleEditDrop);

  updateEditFileUploadDisplay();
}

function handleEditFileSelection(e) {
  const files = Array.from(e.target.files);
  addFilesToEditSelection(files);
}

function handleEditDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = "#3b82f6";
  e.currentTarget.style.backgroundColor = "#eff6ff";
}

function handleEditDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = "#cbd5e0";
  e.currentTarget.style.backgroundColor = "";
}

function handleEditDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = "#cbd5e0";
  e.currentTarget.style.backgroundColor = "";

  const files = Array.from(e.dataTransfer.files);
  addFilesToEditSelection(files);
}

function addFilesToEditSelection(files) {
  const totalExistingFiles = currentTicketAttachments.length + editSelectedFiles.length;
  const maxNewFiles = AppConstants.FILE_UPLOAD.MAX_FILES - totalExistingFiles;

  if (maxNewFiles <= 0) {
    showAlert(`Maximum ${AppConstants.FILE_UPLOAD.MAX_FILES} files allowed total (including existing attachments).`, 'warning');
    return;
  }

  if (files.length > maxNewFiles) {
    showAlert(`Can only add ${maxNewFiles} more file(s). You have ${totalExistingFiles} files already.`, 'warning');
    files = files.slice(0, maxNewFiles);
  }

  for (const file of files) {

    if (!AppConstants.FILE_UPLOAD.ALLOWED_TYPES.includes(file.type)) {
        showAlert(`File type not supported: ${file.name}\nAllowed types: Images, Videos, PDF, Word documents, Text files`, 'error');
      continue;
    }


    if (file.size > AppConstants.FILE_UPLOAD.MAX_SIZE) {
        showAlert(`File too large: ${file.name}\nMaximum size: ${AppConstants.FILE_UPLOAD.MAX_SIZE / (1024 * 1024)}MB`, 'error');
      continue;
    }


    if (editSelectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      continue;
    }

    editSelectedFiles.push(file);
  }

  updateEditFileUploadDisplay();


  document.getElementById("editFileInput").value = "";
}

window.removeEditFile = function (index) {
  editSelectedFiles.splice(index, 1);
  updateEditFileUploadDisplay();
};

function updateEditFileUploadDisplay() {
  const selectedFilesContainer = document.getElementById("editSelectedFiles");
  const uploadSub = document.querySelector("#editTicketModal .upload-sub");

  const totalFiles = currentTicketAttachments.length + editSelectedFiles.length;
  const remaining = AppConstants.FILE_UPLOAD.MAX_FILES - totalFiles;

  if (uploadSub) {
    uploadSub.textContent = `${remaining} of ${AppConstants.FILE_UPLOAD.MAX_FILES} slots available`;
  }

  if (selectedFilesContainer) {
    selectedFilesContainer.innerHTML = editSelectedFiles.map((file, index) => {
      const fileType = getFileType(file.type);
      const fileSize = formatFileSize(file.size);

      return `
        <div class="file-item">
          <div class="file-info-left">
            <div class="file-type-icon file-type-${fileType}">
              <i class="fas ${getFileIcon(file.type)}"></i>
            </div>
            <div class="file-details">
              <div class="file-name">${file.name}</div>
              <div class="file-size">${fileSize}</div>
            </div>
          </div>
          <button type="button" class="file-remove" onclick="removeEditFile(${index})" title="Remove file">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }).join('');
  }
}

function getFileType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  return 'other';
}

function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return 'fa-image';
  if (mimeType.startsWith('video/')) return 'fa-video';
  if (mimeType === 'application/pdf') return 'fa-file-pdf';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'fa-file-word';
  return 'fa-file';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function submitEditTicket(event) {
  event.preventDefault();

  const form = document.getElementById("editTicketForm");
  const submitBtn = document.querySelector("#editTicketModal .btn-submit");
  const ticketId = document.getElementById("editTicketId").value;

  if (submitBtn.disabled) {
    showAlert("This ticket cannot be edited due to its current status.", 'warning');
    return;
  }

  const formData = new FormData(form);

  let start_date = formData.get("start_date") || null;
  let start_time = formData.get("start_time") || null;
  let start_datetime = null;
  if (start_date && start_time) {
    start_datetime = `${start_date}T${start_time}:00`;
  } else if (start_date) {
    start_datetime = `${start_date}T00:00:00`;
  }

  let end_date = formData.get("end_date") || null;
  let end_time = formData.get("end_time") || null;
  let end_datetime = null;
  if (end_date && end_time) {
    end_datetime = `${end_date}T${end_time}:00`;
  } else if (end_date) {
    end_datetime = `${end_date}T00:00:00`;
  }

  const ticketData = {
    ticket_title: formData.get("ticket_title").trim(),
    request_type: formData.get("request_type"),
    description: formData.get("description").trim(),
    priority: formData.get("priority"),
    start_datetime: start_datetime,
    end_datetime: end_datetime,
    maintenance_costs: formData.get("maintenance_costs") || null,
    notes: formData.get("notes")?.trim() || null,
  };

  const statusSelect = document.getElementById("editStatusSelect");
  if (
    statusSelect &&
    statusSelect.value === AppConstants.TICKET_STATUSES.CANCELLED
  ) {
    ticketData.ticket_status = AppConstants.TICKET_STATUSES.CANCELLED;
  }

  const validationErrors = validateEditTicketForm(ticketData);
  if (validationErrors.length > 0) {
    showAlert("Please fix the following errors:\n\n" + validationErrors.join("\n"), 'warning');
    return;
  }

  let confirmMessage;
  if (ticketData.ticket_status === AppConstants.TICKET_STATUSES.CANCELLED) {
    confirmMessage = `⚠️ CANCEL TICKET CONFIRMATION ⚠️\n\nAre you sure you want to CANCEL this ticket?\n\nTicket: ${ticketData.ticket_title}\n\n⚠️ Once cancelled, this ticket cannot be edited or reactivated!`;
  } else {
    confirmMessage = `Are you sure you want to update this ticket?\n\nTicket: ${ticketData.ticket_title}\nType: ${ticketData.request_type}\nPriority: ${ticketData.priority}`;
  }

  const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
    ? ((msg, title) => window.showConfirm(msg, title))
    : (msg => Promise.resolve(confirm(String(msg))));
  const doSubmit = !!(await confirmFn(confirmMessage, 'Confirm'));
  if (!doSubmit) {
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent =
    ticketData.ticket_status === AppConstants.TICKET_STATUSES.CANCELLED
      ? "Cancelling..."
      : "Updating...";

  try {
    const submitData = new FormData();

    Object.keys(ticketData).forEach((key) => {
      if (ticketData[key] !== null && ticketData[key] !== undefined) {
        submitData.append(key, ticketData[key]);

      }
    });



    if (editSelectedFiles && editSelectedFiles.length > 0) {

      for (const file of editSelectedFiles) {
        if (file.size > AppConstants.FILE_UPLOAD.MAX_SIZE) {
          showAlert(`File "${file.name}" is too large. Maximum size is 10MB.`, 'error');
          return;
        }

        let normalizedFile = file;
        if (file.type === "image/svg+xml") {

          normalizedFile = new File([file], file.name, { type: "image/svg" });
        }
        submitData.append("attachments", normalizedFile);

      }
    }



    const response = await fetch(`/api/v1/tickets/${ticketId}`, {
      method: "PATCH",
      body: submitData,
      credentials: "include",
    });

    const result = await response.json();


    if (response.ok) {
      const statusMessage =
        ticketData.ticket_status === AppConstants.TICKET_STATUSES.CANCELLED
          ? `❌ Ticket cancelled successfully!\n\nTicket "${ticketData.ticket_title}" has been cancelled.`
          : `✅ Ticket updated successfully!\n\nTicket "${ticketData.ticket_title}" has been updated.`;

      // choose success for positive messages
      showAlert(statusMessage, 'success');
      closeEditTicketModal();

      try { invalidateCacheByPrefix('/api/v1/tickets'); } catch (e) {}
      await loadTickets();
    } else {
      throw new Error(result.message || "Failed to update ticket");
    }
    } catch (error) {
      console.error("Error updating ticket:", error);
      showAlert(`❌ Error updating ticket: ${error.message}\n\nPlease try again or contact support if the problem persists.`, 'error');
    } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Update Ticket";
  }
}

function validateEditTicketForm(data) {
  const errors = [];

  if (!data.ticket_title) errors.push("• Ticket Title is required");
  if (!data.request_type) errors.push("• Request Type is required");
  if (!data.description) errors.push("• Description is required");
  if (!data.priority) errors.push("• Priority is required");

  if (data.start_date && data.end_date) {
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    if (startDate > endDate) {
      errors.push("• Start Date must be earlier than End Date");
    }
  }

  return errors;
}

function openNewTicketModal() {
  const modal = document.getElementById("newTicketModal");
  if (modal) modal.classList.add("active");

  const requestedBySelect = document.getElementById("requestedBy");
  if (requestedBySelect) {
    requestedBySelect.value = "";
    if (requestedBySelect.tomselect) {
      requestedBySelect.tomselect.clear();
    }
  }
}

function initializeFileUpload() {
  const fileInput = document.getElementById("fileInput");
  const attachmentsArea = document.querySelector(".attachments-area");
  if (!fileInput || !attachmentsArea) return;

  fileInput.addEventListener("change", function (e) {
    const files = e.target.files;
    const span = attachmentsArea.querySelector("span");
    if (span) {
      if (files.length > 0) {
        span.textContent = Array.from(files).map(f => f.name).join(", ");
        span.style.color = "#374151";
      } else {
        span.textContent = "📎 Click here to upload files or drag and drop";
        span.style.color = "#6b7280";
      }
    }
  });

  attachmentsArea.addEventListener("dragover", function (e) {
    e.preventDefault();
    attachmentsArea.style.borderColor = "#3b82f6";
    attachmentsArea.style.backgroundColor = "#f0f9ff";
  });
  attachmentsArea.addEventListener("dragleave", function (e) {
    e.preventDefault();
    attachmentsArea.style.borderColor = "#d1d5db";
    attachmentsArea.style.backgroundColor = "#fafafa";
  });
  attachmentsArea.addEventListener("drop", function (e) {
    e.preventDefault();
    attachmentsArea.style.borderColor = "#d1d5db";
    attachmentsArea.style.backgroundColor = "#fafafa";
    const files = e.dataTransfer.files;
    fileInput.files = files;
    const span = attachmentsArea.querySelector("span");
    if (span) {
      if (files.length > 0) {
        span.textContent = Array.from(files).map(f => f.name).join(", ");
        span.style.color = "#374151";
      } else {
        span.textContent = "📎 Click here to upload files or drag and drop";
        span.style.color = "#6b7280";
      }
    }
  });
}

async function deleteTicket(ticketId) {
  const ticket = allTickets.find(t => t.ticket_id === ticketId);
  if (!ticket) {
    showAlert("Ticket not found", 'warning');
    return;
  }

  const proceed = await showConfirm(`Are you sure you want to delete ticket '${ticket.ticket_title}'? This action cannot be undone.`, 'Delete Ticket');
  if (!proceed) return;

  try {
    const response = await fetch(`/api/v1/tickets/${ticketId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    });
    const result = await response.json();

    if (response.ok) {
      if (result && result.message) showAlert(result.message, 'success');
      allTickets = allTickets.filter(t => t.ticket_id !== ticketId);
      tickets = tickets.filter(t => t.ticket_id !== ticketId);
      try { invalidateCacheByPrefix('/api/v1/tickets'); } catch (e) {}
      renderTickets();
    } else {
      const msg = (result && result.message) ? result.message : 'Failed to delete ticket';
      showAlert(msg, 'error');
    }
  } catch (err) {
    console.error(err);
    showAlert("Failed to delete ticket: " + (err && err.message ? err.message : String(err)), 'error');
  }
}

function initializeModal() {
  const modal = document.getElementById("newTicketModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        modal.classList.remove("active");
        document.getElementById("newTicketForm").reset();
      }
    });
  }
  const newTicketForm = document.getElementById("newTicketForm");
  if (newTicketForm) {
    newTicketForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const formData = new FormData(newTicketForm);
      const unitNo = formData.get("unit_no");
      if (unitNo) {
        formData.set("lease_id", unitNo);
        formData.delete("unit_no");
      }
      const requestedBy = formData.get("requested_by");
      if (requestedBy) {
        formData.set("user_id", requestedBy);
      }
      const startDate = formData.get("start_date") || null;
      const startTime = formData.get("start_time") || null;
      let start_datetime = null;
      if (startDate && startTime) {
        start_datetime = `${startDate}T${startTime}:00`;
      } else if (startDate) {
        start_datetime = `${startDate}T00:00:00`;
      }
      if (start_datetime) {
        formData.set("start_datetime", start_datetime);
      }
      formData.delete("start_date");
      formData.delete("start_time");
      const submitBtn = document.querySelector(".btn-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating...";
      try {
        const response = await fetch("/api/v1/tickets/create-ticket", {
          method: "POST",
          body: formData,
          credentials: "include"
        });
        const result = await response.json();
        if (response.ok) {
          showAlert(`✅ Ticket created successfully!\n\nTicket ID: ${result.ticket_id}`, 'success');
          modal.classList.remove("active");
          newTicketForm.reset();
          try { invalidateCacheByPrefix('/api/v1/tickets'); } catch (e) {}
          await loadTickets();
        } else {
          throw new Error(result.message || "Failed to create ticket");
        }
      } catch (error) {
        showAlert(`❌ Error creating ticket: ${error.message}`, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Ticket";
      }
    });
  }
}

function assignTicket(ticketId) {
  let ticket = tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) {
    ticket = allTickets.find(t => t.ticket_id === ticketId);
  }
  if (!ticket) {
    showAlert("Ticket not found", 'warning');
    return;
  }
  document.getElementById("assignTicketId").value = ticket.ticket_id;
  document.getElementById("assignTicketIdDisplay").value = ticket.ticket_id;
  document.getElementById("assignTicketTitle").value = ticket.ticket_title || "";
  document.getElementById("assignUnitNo").value = ticket.lease_id || "";
  document.getElementById("assignPriority").value = ticket.priority || "";
  document.getElementById("assignedToInput").value = ticket.assigned_to || "";
  document.getElementById("assignmentNotes").value = "";

  const modal = document.getElementById("assignTicketModal");
  if (modal) {
    modal.classList.add("active");
  }

  const assignTicketForm = document.getElementById("assignTicketForm");
  if (assignTicketForm) {
    assignTicketForm.onsubmit = async function (event) {
      event.preventDefault();
      const assignedTo = document.getElementById("assignedToInput").value.trim();
      const assignmentNotes = document.getElementById("assignmentNotes").value.trim();
      if (!assignedTo) {
          showAlert("Please specify who to assign this ticket to.", 'warning');
          document.getElementById("assignedToInput").focus();
        return;
      }
      const submitBtn = assignTicketForm.querySelector(".btn-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "Assigning...";
      try {
        const ticketData = { assigned_to: assignedTo };
        if (assignmentNotes) {
          ticketData.assignment_notes = assignmentNotes;
        }
        const response = await fetch(`/api/v1/tickets/${ticketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ticketData),
          credentials: "include"
        });
        const result = await response.json();
        if (response.ok) {
          showAlert("✅ Ticket assigned successfully!", 'success');
          modal.classList.remove("active");
          assignTicketForm.reset();
          try { invalidateCacheByPrefix('/api/v1/tickets'); } catch (e) {}
          await loadTickets();
        } else {
          throw new Error(result.message || "Failed to assign ticket");
        }
      } catch (error) {
        showAlert(`❌ Error assigning ticket: ${error.message}`, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Assign Ticket";
      }
    };
  }
}

function initializeEditModal() {
  const modal = document.getElementById("editTicketModal");
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        modal.classList.remove("active");
        document.getElementById("editTicketForm").reset();
      }
    });
  }
  const editTicketForm = document.getElementById("editTicketForm");
  if (editTicketForm) {
    editTicketForm.addEventListener("submit", submitEditTicket);
  }
}

function expandTicket(ticketId, details, ticketItem, expandIcon) {
  if (!details || !ticketItem || !expandIcon) return;
  details.classList.add("expanded");
  expandIcon.textContent = "▲";
  ticketItem.classList.add("expanded");
  currentlyExpandedTicket = ticketId;
  setTimeout(() => {
    details.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, 200);
}



let currentTicketId = null;

window.editCurrentTicket = function () {
  if (!currentTicketId || currentTicketId === 'null' || currentTicketId === null) {
    showAlert('No valid ticket selected for editing.', 'warning');
    return;
  }
  closeTicketDetailsModal();
  setTimeout(function () {
    editTicket(currentTicketId);
  }, 150);
};
window.assignCurrentTicket = function () {
  if (!currentTicketId || currentTicketId === 'null' || currentTicketId === null) {
    showAlert('No valid ticket selected for assignment.', 'warning');
    return;
  }
  closeTicketDetailsModal();
  setTimeout(function () {
    assignTicket(currentTicketId);
  }, 150);
};


function viewTicketDetails(ticketId) {
  const ticket = tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) return;
  currentTicketId = ticketId;



  const statusMapping = AppConstants.STATUS_MAPPINGS[ticket.ticket_status] || AppConstants.STATUS_MAPPINGS[AppConstants.TICKET_STATUSES.PENDING];
  const priorityMapping = AppConstants.PRIORITY_MAPPINGS[ticket.priority] || AppConstants.PRIORITY_MAPPINGS[AppConstants.PRIORITY_LEVELS.MEDIUM];


  document.getElementById('detailTicketId').textContent = ticket.ticket_id;
  document.getElementById('detailsModalTitle').textContent = `Ticket #${ticket.ticket_id} Details`;

  const statusClass = ticket.ticket_status ? `status-${ticket.ticket_status.toLowerCase().replace(/[^a-z_]/g, "")}` : "status-pending";
  const priorityClass = ticket.priority ? `priority-${ticket.priority.toLowerCase()}` : "priority-medium";

  const statusElement = document.getElementById('detailStatus');
  statusElement.textContent = statusMapping.label;
  statusElement.className = `status-badge ${statusClass}`;
  statusElement.style.backgroundColor = statusMapping.color;

  const priorityElement = document.getElementById('detailPriority');
  priorityElement.textContent = priorityMapping.label;
  priorityElement.className = `priority-badge ${priorityClass}`;
  priorityElement.style.backgroundColor = priorityMapping.color;

  document.getElementById('detailRequestType').textContent = formatRequestType(ticket.request_type);
  document.getElementById('detailRequestedBy').textContent = ticket.requested_by_name || ticket.user_id || "Unknown";
  document.getElementById('detailProperty').textContent = ticket.property_name || "N/A";


  document.getElementById('detailDescription').textContent = ticket.description || "No description provided";


  document.getElementById('detailCreatedAt').textContent = formatDate(ticket.created_at, true);

  let startDateDisplay = "Not set";
  let endDateDisplay = "Not set";
  if (ticket.start_datetime) {
    const dt = new Date(ticket.start_datetime);
    if (!isNaN(dt.getTime())) {
      startDateDisplay = formatDate(dt.toISOString(), false) + " " + dt.toTimeString().slice(0, 5);
    }
  }
  if (ticket.end_datetime) {
    const dt = new Date(ticket.end_datetime);
    if (!isNaN(dt.getTime())) {
      endDateDisplay = formatDate(dt.toISOString(), false) + " " + dt.toTimeString().slice(0, 5);
    }
  }

  document.getElementById('detailStartDateTime').textContent = startDateDisplay;
  document.getElementById('detailEndDateTime').textContent = endDateDisplay;
  document.getElementById('detailUpdatedAt').textContent = formatDate(ticket.updated_at, true);


  document.getElementById('detailAssignedTo').textContent = ticket.assigned_to || "Unassigned";
  document.getElementById('detailPhone').textContent = ticket.phone_number || "N/A";
  document.getElementById('detailMaintenanceCost').textContent = formatCurrency(ticket.maintenance_costs) || "Not estimated";

    
    const assignBtn = document.getElementById('assignCurrentTicketBtn');
    const editBtn = document.getElementById('editCurrentTicketBtn');
    const isCompleted = ticket.ticket_status && ticket.ticket_status.toUpperCase() === AppConstants.TICKET_STATUSES.COMPLETED;
    if (assignBtn) {
      assignBtn.style.display = isCompleted ? 'none' : '';
    }
    if (editBtn) {
      editBtn.style.display = isCompleted ? 'none' : '';
    }

  const notesSection = document.getElementById('notesSection');
  if (ticket.notes && ticket.notes.trim()) {
    document.getElementById('detailNotes').textContent = ticket.notes;
    notesSection.style.display = 'block';
  } else {
    notesSection.style.display = 'none';
  }


  const attachmentsSection = document.getElementById('attachmentsSection');
  if (ticket.attachments) {
    let attachmentsForDisplay = ticket.attachments;
    if (Array.isArray(attachmentsForDisplay)) {
      attachmentsForDisplay = attachmentsForDisplay.join(",");
    } else if (attachmentsForDisplay && typeof attachmentsForDisplay !== "string") {
      attachmentsForDisplay = String(attachmentsForDisplay);
    }

    if (attachmentsForDisplay && attachmentsForDisplay.trim()) {
      document.getElementById('detailAttachments').innerHTML = formatAttachments(attachmentsForDisplay, true);
      attachmentsSection.style.display = 'block';
    } else {
      attachmentsSection.style.display = 'none';
    }
  } else {
    attachmentsSection.style.display = 'none';
  }


  document.getElementById('ticketDetailsModal').style.display = 'flex';
}


function closeTicketDetailsModal() {
  document.getElementById('ticketDetailsModal').style.display = 'none';

}

function closeAssignTicketModal() {
  const modal = document.getElementById("assignTicketModal");
  if (modal) {
    modal.classList.remove("active");
  }
  const assignTicketForm = document.getElementById("assignTicketForm");
  if (assignTicketForm) {
    assignTicketForm.reset();
  }
}

function closeNewTicketModal() {
  const modal = document.getElementById("newTicketModal");
  if (modal) {
    modal.classList.remove("active");
  }
  const newTicketForm = document.getElementById("newTicketForm");
  if (newTicketForm) {
    newTicketForm.reset();
  }
}


window.expandTicket = expandTicket;
window.clearFilters = clearFilters;
window.editTicket = editTicket;
window.assignTicket = assignTicket;
window.closeEditTicketModal = closeEditTicketModal;
window.initializeEditModal = initializeEditModal;
window.initializeModal = initializeModal;
window.openNewTicketModal = openNewTicketModal;
window.deleteTicket = deleteTicket;
window.initializeFileUpload = initializeFileUpload;
window.closeAssignTicketModal = closeAssignTicketModal;
window.closeNewTicketModal = closeNewTicketModal;
window.toggleTicketDetails = toggleTicketDetails;
window.submitEditTicket = submitEditTicket;
window.viewTicketDetails = viewTicketDetails;
window.closeTicketDetailsModal = closeTicketDetailsModal;





