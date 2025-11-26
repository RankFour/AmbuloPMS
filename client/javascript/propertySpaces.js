const API_BASE_URL = "/api/v1/properties";

document.addEventListener("DOMContentLoaded", () => {
  fetch("/components/navbar.html")
    .then((res) => res.text())
    .then((data) => {
      document.getElementById("navbar-placeholder").innerHTML = data;
      setupNavbarFeatures();
    });

  function setupNavbarFeatures() {
    const navbar =
      document.querySelector("header") || document.getElementById("navbar");
    const revealElements = document.querySelectorAll(".reveal-element");

    const revealOnScroll = () => {
      revealElements.forEach((element) => {
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;

        if (elementTop < window.innerHeight - elementVisible) {
          element.classList.add("revealed");
        }
      });
    };

    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      if (navbar) {
        if (scrollTop > 50) {
          navbar.classList.add("scrolled");
        } else {
          navbar.classList.remove("scrolled");
        }
      }

      revealOnScroll();
    };

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
          const offsetTop = target.offsetTop - 80;
          window.scrollTo({
            top: offsetTop,
            behavior: "smooth",
          });
        }
      });
    });

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("load", revealOnScroll);
    revealOnScroll();
  }

  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -100px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
      }
    });
  }, observerOptions);

  document.querySelectorAll(".reveal-element").forEach((el) => {
    observer.observe(el);
  });

  const elementsInView = document.querySelectorAll(".reveal-element");
  elementsInView.forEach((el, index) => {
    setTimeout(() => {
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add("revealed");
      }
    }, index * 100);
  });
});

let activeFilters = {
  status: [],
  area: [],
  minPrice: null,
  maxPrice: null,
};

function toggleFilter(filterType, value, buttonElement) {
  const index = activeFilters[filterType].indexOf(value);

  if (index > -1) {
    activeFilters[filterType].splice(index, 1);
    buttonElement.classList.remove("active");
  } else {
    activeFilters[filterType].push(value);
    buttonElement.classList.add("active");
  }

  applyFilters();
}

function applyFilters() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const propertyCards = document.querySelectorAll(".property-card");
  let visibleCount = 0;

  propertyCards.forEach((card) => {
    const cardStatus = card.getAttribute("data-status");

    const cardPrice = parseInt(card.getAttribute("data-price"));
    const cardArea = parseInt(card.getAttribute("data-area"));
    const cardTitle = card
      .querySelector(".property-title")
      .textContent.toLowerCase();
    const cardLocation = card
      .querySelector(".property-desc")
      .textContent.toLowerCase();

    const matchesSearch =
      !searchTerm ||
      cardTitle.includes(searchTerm) ||
      cardLocation.includes(searchTerm);

    const matchesStatus =
      activeFilters.status.length === 0 ||
      activeFilters.status.includes(cardStatus);

    let matchesPrice = true;
    if (typeof activeFilters.minPrice === "number") {
      matchesPrice =
        matchesPrice &&
        (isNaN(cardPrice) ? true : cardPrice >= activeFilters.minPrice);
    }
    if (typeof activeFilters.maxPrice === "number") {
      matchesPrice =
        matchesPrice &&
        (isNaN(cardPrice) ? true : cardPrice <= activeFilters.maxPrice);
    }

    let matchesArea = true;
    if (activeFilters.area.length > 0) {
      matchesArea = activeFilters.area.some((areaRange) => {
        if (areaRange === "small") return cardArea < 1500;
        if (areaRange === "medium") return cardArea >= 1500 && cardArea <= 2500;
        if (areaRange === "large") return cardArea > 2500;
        return true;
      });
    }

    const shouldShow =
      matchesSearch && matchesStatus && matchesPrice && matchesArea;

    if (shouldShow) {
      card.style.display = "block";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });

  const resultsCount = document.getElementById("resultsCount");
  const noResults = document.getElementById("noResults");
  const totalCount = propertyCards.length;

  if (visibleCount === 0) {
    noResults.style.display = "block";
    resultsCount.textContent = "No properties found";
  } else {
    noResults.style.display = "none";
    resultsCount.textContent = `Showing ${visibleCount} of ${totalCount} properties`;
  }
}

function clearAllFilters() {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.value = "";
  }

  activeFilters = {
    status: [],
    area: [],
    minPrice: null,
    maxPrice: null,
  };

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const minSelect = document.getElementById("priceMinSelect");
  const maxSelect = document.getElementById("priceMaxSelect");
  if (minSelect) minSelect.value = "";
  if (maxSelect) maxSelect.value = "";

  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.value = "default";
  }

  applyFilters();
}

function sortProperties() {
  const sortValue = document.getElementById("sortSelect").value;
  const propertyGrid = document.querySelector(".property-grid");
  const propertyCards = Array.from(document.querySelectorAll(".property-card"));

  propertyCards.sort((a, b) => {
    const priceA = parseInt(a.getAttribute("data-price"));
    const priceB = parseInt(b.getAttribute("data-price"));
    const areaA = parseInt(a.getAttribute("data-area"));
    const areaB = parseInt(b.getAttribute("data-area"));
    const titleA = a.querySelector(".property-title").textContent;
    const titleB = b.querySelector(".property-title").textContent;

    switch (sortValue) {
      case "price-low":
        return priceA - priceB;
      case "price-high":
        return priceB - priceA;
      case "area-small":
        return areaA - areaB;
      case "area-large":
        return areaB - areaA;
      case "name":
        return titleA.localeCompare(titleB);
      case "default":
      default:
        return 0;
    }
  });

  propertyCards.forEach((card) => {
    propertyGrid.appendChild(card);
  });
}

function toggleFilters() {
  const filterContent = document.getElementById("filterContent");
  if (filterContent) {
    filterContent.classList.toggle("active");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const filterType = this.getAttribute("data-filter");
      const filterValue = this.getAttribute("data-value");
      toggleFilter(filterType, filterValue, this);
    });
  });

  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", sortProperties);
  }

  document.addEventListener("mouseover", function (e) {
    if (e.target.closest(".property-card")) {
      const card = e.target.closest(".property-card");
      card.style.transform = "translateY(-12px) scale(1.02)";
    }
  });

  document.addEventListener("mouseout", function (e) {
    if (e.target.closest(".property-card")) {
      const card = e.target.closest(".property-card");
      card.style.transform = "translateY(0) scale(1)";
    }
  });

  applyFilters();
});

async function fetchProperties() {
  const cacheKey = "propertySpacesAll";
  let properties = null;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      properties = JSON.parse(cached);
    } catch {
      sessionStorage.removeItem(cacheKey);
    }
  }
  if (!properties) {
    try {
      const res = await fetch(`${API_BASE_URL}?limit=50`, { method: "GET" });
      if (!res.ok) throw new Error("Failed to fetch properties");
      const data = await res.json();
      properties = data;
      sessionStorage.setItem(cacheKey, JSON.stringify(properties));
    } catch (err) {
      console.error("Error fetching properties:", err);
      return { properties: [] };
    }
  }
  return properties;
}

function formatPrice(price) {
  return price ? `₱ ${Number(price).toLocaleString()}` : "N/A";
}

function formatArea(area) {
  return area ? `${area.toLocaleString()} sqm` : "N/A";
}

function getStatusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s === "available")
    return `<div class="status-badge status-available">Available</div>`;
  if (s === "occupied")
    return `<div class="status-badge status-occupied">Occupied</div>`;
  if (s === "reserved")
    return `<div class="status-badge status-reserved">Reserved</div>`;
  if (s === "maintenance")
    return `<div class="status-badge status-maintenance">Maintenance</div>`;
  return "";
}

function renderPropertyCard(property) {
  const role = getUserRole();
  const isTenant = role === "TENANT";
  const wished = isWishlisted(property.property_id);
  const imageUrl =
    property.display_image ||
    (property.property_pictures && property.property_pictures[0]?.image_url) ||
    "/assets/default-property.jpg";
  const address = property.street
    ? `${property.street}, ${property.city}, ${property.province}`
    : property.city || "";

  const statusLower = String(property.property_status || "").toLowerCase();

  return `
    <div class="property-card reveal-element scale-up" data-status="${statusLower}" data-type="${property.property_type || ""
    }" data-price="${property.base_rent || 0}" data-area="${property.floor_area_sqm || 0
    }" data-id="${property.property_id}">
      <div class="property-image" style="background-image:url('${imageUrl}');">
        ${getStatusBadge(property.property_status)}
        ${isTenant
      ? `<button class="wishlist-btn" aria-label="Add to wishlist" data-id="${property.property_id
      }">${wishlistIconSvg(wished)}</button>`
      : ""
    }
      </div>
      <div class="property-info">
        <div class="property-header">
          <div>
            <div class="property-title">${property.property_name || "Unit"
    }</div>
            <div class="property-desc">${address}</div>
            <div class="property-price"><span class="price-amount">${formatPrice(
      property.base_rent
    )}</span><span class="price-term">/mo</span></div>
          </div>
        </div>
        <div class="property-details">
          <div class="detail-item">
            <div class="detail-icon"><i class="fa-solid fa-ruler-combined"></i></div>
            <span>${formatArea(property.floor_area_sqm)}</span>
          </div>
          <div class="detail-item">
            <div class="detail-icon"><i class="fa-solid fa-building"></i></div>
            <span>${property.building_name || ""}</span>
          </div>
          <div class="detail-item">
            <div class="detail-icon"><i class="fa-solid fa-map-marker-alt"></i></div>
            <span>${property.barangay || ""}</span>
          </div>
        </div>
        <div class="property-actions">
          <button class="btn btn-primary" onclick="window.location.href='spacesDetails.html?id=${property.property_id
    }'">View Details</button>
        </div>
      </div>
    </div>
  `;
}

function revealCards() {
  document.querySelectorAll(".property-card").forEach((card) => {
    card.classList.add("revealed");
  });
  document.querySelectorAll(".reveal-element").forEach((el) => {
    el.classList.add("revealed");
  });
}

async function populatePropertyGrid() {
  const grid = document.getElementById("propertyGrid");
  grid.innerHTML = `<div class="loading">Loading properties...</div>`;
  try {
    const response = await fetchProperties();
    const properties = response?.properties || [];
    if (properties.length === 0) {
      grid.innerHTML = `<div class="no-results">No properties found.</div>`;
      return;
    }
    grid.innerHTML = properties.map(renderPropertyCard).join("");

    initializePriceDropdowns(properties);
    revealCards();
    initWishlistButtons();
  } catch (err) {
    grid.innerHTML = `<div class="error">Failed to load properties.</div>`;
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  populatePropertyGrid().then(() => {
    applyFilters();
    sortProperties();
  });
});

window.clearAllFilters = clearAllFilters;

function formatPeso(n) {
  return `₱ ${Number(n).toLocaleString()}`;
}

function computePriceSteps(min, max) {
  if (!isFinite(min) || !isFinite(max) || min >= max) {
    return [];
  }

  const span = max - min;
  let step = 5000;
  if (span > 200000) step = 20000;
  else if (span > 120000) step = 10000;
  else if (span < 40000) step = 2000;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const values = [];
  for (let v = start; v <= end; v += step) values.push(v);
  return values;
}

function initializePriceDropdowns(properties) {
  const minSelect = document.getElementById("priceMinSelect");
  const maxSelect = document.getElementById("priceMaxSelect");
  if (!minSelect || !maxSelect) return;

  const rents = (properties || [])
    .map((p) => Number(p.base_rent))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (rents.length === 0) {
    minSelect.disabled = true;
    maxSelect.disabled = true;
    activeFilters.minPrice = null;
    activeFilters.maxPrice = null;
    return;
  }

  const min = rents[0];
  const max = rents[rents.length - 1];
  const steps = computePriceSteps(min, max);

  const buildOptions = (select, isMin) => {
    const current = select.value;
    select.innerHTML = "";
    const anyOpt = document.createElement("option");
    anyOpt.value = "";
    anyOpt.textContent = isMin ? "Min (Any)" : "Max (Any)";
    select.appendChild(anyOpt);
    steps.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = formatPeso(v);
      select.appendChild(opt);
    });

    if ([...select.options].some((o) => o.value === current)) {
      select.value = current;
    }
  };

  buildOptions(minSelect, true);
  buildOptions(maxSelect, false);

  const applyRange = () => {
    const minVal = minSelect.value === "" ? null : Number(minSelect.value);
    const maxVal = maxSelect.value === "" ? null : Number(maxSelect.value);

    if (minVal != null && maxVal != null && minVal > maxVal) {
      maxSelect.value = String(minVal);
      activeFilters.minPrice = minVal;
      activeFilters.maxPrice = minVal;
    } else {
      activeFilters.minPrice = minVal;
      activeFilters.maxPrice = maxVal;
    }
    applyFilters();
  };

  minSelect.addEventListener("change", applyRange);
  maxSelect.addEventListener("change", applyRange);
}

window.toggleFilters = toggleFilters;

function getTokenFromCookie() {
  try {
    return (document.cookie.match(/(?:^|; )token=([^;]+)/) || [])[1] || null;
  } catch {
    return null;
  }
}
function decodeJwtPayload(t) {
  try {
    const parts = String(t || "").split(".");
    if (parts.length < 2) return null;
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const json = decodeURIComponent(
      atob(payload)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function getUserRole() {
  let role = null;
  try {
    const token = getTokenFromCookie() || localStorage.getItem("token");
    const p = decodeJwtPayload(token);
    role = p && (p.role || p.userRole || p.user_role);
    if (!role) {
      const uStr = localStorage.getItem("user");
      if (uStr) {
        const u = JSON.parse(uStr);
        role = u.role;
      }
    }
  } catch { }
  return String(role || "").toUpperCase();
}
function wishlistIconSvg(active) {
  return active
    ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="#e11d48"><path d="M11.645 20.91l-.007-.007C5.4 15.43 2 12.36 2 8.5 2 6.015 4.014 4 6.5 4c1.74 0 3.41 1.01 4.145 2.57C12.09 5.01 13.76 4 15.5 4 18.486 4 20.5 6.015 20.5 8.5c0 3.86-3.4 6.93-9.138 12.403l-.007.007a1 1 0 01-1.41 0z"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.5 2.09C12.09 5.01 13.76 4 15.5 4 17.99 4 20 6.01 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
}
function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem("wishlist") || "[]");
  } catch {
    return [];
  }
}
function setWishlist(list) {
  try {
    localStorage.setItem("wishlist", JSON.stringify(Array.from(new Set(list))));
  } catch { }
}
function isWishlisted(id) {
  const list = getWishlist();
  return list.includes(String(id));
}
function toggleWishlist(id) {
  const list = getWishlist();
  const sid = String(id);
  const idx = list.indexOf(sid);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(sid);
  setWishlist(list);
}
function initWishlistButtons() {
  const role = getUserRole();
  if (role !== "TENANT") return;
  document.querySelectorAll(".wishlist-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      toggleWishlist(id);
      const active = isWishlisted(id);
      btn.innerHTML = wishlistIconSvg(active);
      btn.classList.toggle("active", active);
      try {
        showToast(
          active ? "Added to wishlist" : "Removed from wishlist",
          active ? "success" : "info"
        );
      } catch { }
    });

    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    const svg = btn.querySelector("svg");
    if (svg) svg.style.display = "block";
  });
}

function showToast(message, type = "info") {
  try {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.position = "fixed";
      container.style.top = "20px";
      container.style.right = "20px";
      container.style.zIndex = 10000;
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "10px";
    toast.style.color = "#fff";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 8px 30px rgba(0,0,0,0.12)";
    toast.style.maxWidth = "320px";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(12px)";
    toast.style.transition = "transform 220ms ease, opacity 220ms ease";
    if (type === "success")
      toast.style.background = "linear-gradient(135deg,#10b981,#059669)";
    else if (type === "error")
      toast.style.background = "linear-gradient(135deg,#ef4444,#dc2626)";
    else toast.style.background = "linear-gradient(135deg,#3b82f6,#1d4ed8)";
    toast.textContent = String(message || "");
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    });
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(12px)";
      setTimeout(() => {
        try {
          toast.remove();
        } catch { }
      }, 280);
    }, 2000);
  } catch { }
}
