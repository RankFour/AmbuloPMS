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

    // Sticky navbar
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

    // Smooth scrolling
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

    // Event listeners
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("load", revealOnScroll);
    revealOnScroll(); // Initial reveal
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
  // type: [],
  price: [],
  area: [],
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
    // const cardType = card.getAttribute("data-type");
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
      cardLocation.includes(searchTerm)
      // cardType.toLowerCase().includes(searchTerm);

    const matchesStatus =
      activeFilters.status.length === 0 ||
      activeFilters.status.includes(cardStatus);

    // const matchesType =
    //   activeFilters.type.length === 0 || activeFilters.type.includes(cardType);

    let matchesPrice = true;
    if (activeFilters.price.length > 0) {
      matchesPrice = activeFilters.price.some((priceRange) => {
        if (priceRange === "low") return cardPrice < 40000;
        if (priceRange === "mid")
          return cardPrice >= 40000 && cardPrice <= 70000;
        if (priceRange === "high") return cardPrice > 70000;
        return true;
      });
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
      matchesSearch &&
      matchesStatus &&
      // matchesType &&
      matchesPrice &&
      matchesArea;

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
    // type: [],
    price: [],
    area: [],
  };

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

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

  try {
    const res = await fetch(`${API_BASE_URL}?limit=50`, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch properties");
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching properties:", err);
    return { properties: [] };
  }
}

function formatPrice(price) {
  return price ? `₱ ${Number(price).toLocaleString()}/mo` : "N/A";
}

function formatArea(area) {
  return area ? `${area.toLocaleString()} sqm` : "N/A";
}

function getStatusBadge(status) {
  if (status === "Available")
    return `<div class="status-badge status-available">Available</div>`;
  if (status === "Occupied")
    return `<div class="status-badge status-occupied">Occupied</div>`;
  if (status === "Maintenance")
    return `<div class="status-badge status-maintenance">Maintenance</div>`;
  return "";
}
function renderPropertyCard(property) {
  const imageUrl =
    property.display_image ||
    (property.property_pictures && property.property_pictures[0]?.image_url) ||
    "/assets/default-property.jpg";
  const address = property.street
    ? `${property.street}, ${property.city}, ${property.province}`
    : property.city || "";

  return `
    <div class="property-card reveal-element scale-up" data-status="${property.property_status?.toLowerCase()}" data-type="${
    property.property_type || ""
  }" data-price="${property.base_rent || 0}" data-area="${
    property.floor_area_sqm || 0
  }">
      <div class="property-image" style="background-image:url('${imageUrl}');">
        ${getStatusBadge(property.property_status)}
      </div>
      <div class="property-info">
        <div class="property-header">
          <div>
            <div class="property-title">${
              property.property_name || "Unit"
            }</div>
            <div class="property-desc">${address}</div>
            <div class="property-price">${formatPrice(property.base_rent)}</div>
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
          <button class="btn btn-primary" onclick="window.location.href='spacesDetails.html?id=${
            property.property_id
          }'">View Details</button>
        </div>
      </div>
    </div>
  `;
}

function revealCards() {
  document.querySelectorAll('.property-card').forEach(card => {
    card.classList.add('revealed');
  });
  document.querySelectorAll('.reveal-element').forEach(el => {
    el.classList.add('revealed');
  });
}

async function populatePropertyGrid() {
  const grid = document.getElementById("propertyGrid");
  grid.innerHTML = `<div class="loading">Loading properties...</div>`;
  try {
    const response = await fetchProperties();
    const properties = response?.properties || [];
    console.log("Fetched properties:", properties.length, properties); // Debug
    if (properties.length === 0) {
      grid.innerHTML = `<div class="no-results">No properties found.</div>`;
      return;
    }
    grid.innerHTML = properties.map(renderPropertyCard).join("");
    revealCards();
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