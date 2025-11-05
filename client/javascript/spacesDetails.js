let currentImageIndex = 0;
let images = [];
let currentProperty = null;

document.addEventListener("DOMContentLoaded", () => {
  fetch("/components/navbar.html")
    .then((res) => res.text())
    .then((data) => {
      document.getElementById("navbar-placeholder").innerHTML = data;
      setupNavbarFeatures();
    });

  setupPropertyDetails();
  setupScheduleField();
});

function setupScheduleField() {
  const subjectSelect = document.getElementById('subject');
  const scheduleContainer = document.getElementById('scheduleContainer');
  const scheduleInput = document.getElementById('preferredSchedule');
  const scheduleError = document.getElementById('scheduleError');

  if (!subjectSelect || !scheduleContainer || !scheduleInput) return;

  function getLocalDatetimeMin() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function setMinNow() {
    try {
      scheduleInput.min = getLocalDatetimeMin();
    } catch (e) {
      
    }
  }

  
  setMinNow();

  
  subjectSelect.addEventListener('change', () => {
    if (subjectSelect.value === 'Schedule a Viewing') {
      scheduleContainer.style.display = '';
      scheduleInput.required = true;
      setMinNow();
      if (scheduleError) scheduleError.style.display = 'none';
    } else {
      
      scheduleContainer.style.display = 'none';
      scheduleInput.required = false;
      scheduleInput.value = '';
      if (scheduleError) scheduleError.style.display = 'none';
    }
  });

  
  scheduleInput.addEventListener('focus', setMinNow);

  
  scheduleInput.addEventListener('input', () => {
    if (!scheduleError) return;
    const val = scheduleInput.value;
    if (!val) {
      scheduleError.style.display = 'none';
      return;
    }
    if (!isFutureDate(val)) {
      scheduleError.textContent = 'Please choose a future date and time.';
      scheduleError.style.display = '';
    } else {
      scheduleError.style.display = 'none';
    }
  });
}

function formatPreferredSchedule(value) {
  
  if (!value) return '';
  
  const [datePart, timePart] = value.split('T');
  if (!datePart) return '';
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart || '').split(':').map(Number);

  
  const dt = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const monthName = monthNames[dt.getMonth()] || '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const weekday = weekdayNames[dt.getDay()] || '';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');

  
  return `${monthName}, ${dd}, ${yyyy} ${weekday} - ${hh}:${mm}`;
}

function isFutureDate(value) {
  if (!value) return false;
  
  const [datePart, timePart] = value.split('T');
  if (!datePart) return false;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart || '').split(':').map(Number);
  const dt = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
  return dt.getTime() > Date.now();
}

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
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
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

async function setupPropertyDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const propertyId = urlParams.get("property_id") || urlParams.get("id");
  if (!propertyId) return;

  try {
    const res = await fetch(`/api/v1/properties/${propertyId}`);
    const result = await res.json();
  const property = result.property;
    if (!property) return;

  
  currentProperty = property;

    const nameSection = document.getElementById("propertyNameSection");
    if (nameSection) {
      nameSection.innerHTML = `
        <h1 class="property-name-emphasized">${
          property.property_name || "Property Space"
        }</h1>
      `;
    }

    const descCard = document.getElementById("propertyDescCard");
    if (descCard) {
      descCard.innerHTML = `
        <div class="property-desc-card">
          ${property.description || "<em>No description available.</em>"}
        </div>
      `;
    }

    images =
      property.property_pictures && property.property_pictures.length
        ? property.property_pictures.map((pic) => pic.image_url)
        : [property.display_image].filter(Boolean);

    const mainImage = document.getElementById("mainImage");
    if (mainImage && images[0]) mainImage.src = images[0];

    const thumbnailRow = document.querySelector(".thumbnail-row");
    if (thumbnailRow) {
      thumbnailRow.innerHTML = images
        .map(
          (img, idx) => `
        <img class="thumbnail${
          idx === 0 ? " active" : ""
        }" src="${img}" alt="Property Image ${
            idx + 1
          }" onclick="setMainImage(this, ${idx})">
      `
        )
        .join("");
    }

    const specs = [
      {
        label: "Address",
        value: property.address
          ? [
              property.address.street,
              property.address.city,
              property.address.province,
              property.address.country,
            ]
              .filter(Boolean)
              .join(", ")
          : "",
      },
      {
        label: "Floor Area",
        value: property.floor_area_sqm
          ? `${property.floor_area_sqm} sqm`
          : "N/A",
      },
      {
        label: "Minimum Lease Term",
        value: property.minimum_lease_term_months
          ? `${property.minimum_lease_term_months} Months`
          : "N/A",
      },
      {
        label: "Rent",
        value: property.base_rent
          ? `₱${Number(property.base_rent).toLocaleString()}/mo`
          : "N/A",
      },
    ];

    const specsHtml = specs
      .map(
        (spec) => `
      <div class="spec-row">
        <span class="spec-label">${spec.label}:</span>
        <span class="spec-value">${spec.value}</span>
      </div>
    `
      )
      .join("");

    const specsSection = document.querySelector(
      ".property-details .details-left .section-content"
    );
    if (specsSection) specsSection.innerHTML = specsHtml;

    const priceMain = document.querySelector(".price-main");
    if (priceMain)
      priceMain.textContent = property.base_rent
        ? `₱${Number(property.base_rent).toLocaleString()}`
        : "N/A";

    const depositInfo = document.querySelector(".deposit-info");
    if (depositInfo) {
      depositInfo.innerHTML = property.security_deposit_months
        ? `<strong>Security Deposit:</strong> ₱ ${Number(
            property.base_rent * property.security_deposit_months
          ).toLocaleString()}<br>
           <small>Refundable upon lease termination, subject to property condition assessment.</small>`
        : "";
    }

    const statusSection = document.querySelector(
      ".details-right .section-content"
    );
    if (statusSection) {
      statusSection.innerHTML = `
        <div class="spec-row">
          <span class="spec-label">Occupancy:</span>
          <span class="spec-value"><span class="availability-status ${
            property.property_status === "Available" ? "available" : "occupied"
          }">${property.property_status}</span></span>
        </div>
      `;
    }
  } catch (err) {
    console.error("Failed to load property details:", err);
  }
}


window.handleContactSubmit = async function handleContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('.contact-submit-btn');

  const firstName = form.querySelector('#contactFirstName')?.value?.trim() || '';
  const lastName = form.querySelector('#contactLastName')?.value?.trim() || '';
  const email = form.querySelector('#contactEmail')?.value?.trim() || '';
  const phone = form.querySelector('#contactPhone')?.value?.trim() || '';
  const subjectField = form.querySelector('#subject');
  const subject = subjectField?.value || '';
  let message = form.querySelector('#contactMessage')?.value?.trim() || '';
    
    
    if (subject === 'Schedule a Viewing') {
      const scheduleVal = form.querySelector('#preferredSchedule')?.value || '';
      const scheduleError = document.getElementById('scheduleError');
      if (!scheduleVal) {
        if (scheduleError) {
          scheduleError.textContent = 'Please select a preferred date and time.';
          scheduleError.style.display = '';
        }
        const sched = document.getElementById('preferredSchedule');
        if (sched) sched.focus();
        return;
      }
      if (!isFutureDate(scheduleVal)) {
        if (scheduleError) {
          scheduleError.textContent = 'Please choose a future date and time.';
          scheduleError.style.display = '';
        }
        const sched = document.getElementById('preferredSchedule');
        if (sched) sched.focus();
        return;
      }
      try {
        const formatted = formatPreferredSchedule(scheduleVal);
        if (formatted) message += `\n\nPreferred Schedule: ${formatted}`;
        if (scheduleError) scheduleError.style.display = 'none';
      } catch (err) {
        console.warn('Failed to parse preferred schedule:', err);
      }

  
  form.querySelectorAll('input, select, textarea').forEach(f => {
    f.classList.remove('error', 'success');
  });

  const missing = [];
  if (!firstName) missing.push({ el: form.querySelector('#contactFirstName'), name: 'First name' });
  if (!lastName) missing.push({ el: form.querySelector('#contactLastName'), name: 'Last name' });
  if (!email) missing.push({ el: form.querySelector('#contactEmail'), name: 'Email' });
  if (!subject) missing.push({ el: subjectField, name: 'Subject' });
  if (!message) missing.push({ el: form.querySelector('#contactMessage'), name: 'Message' });

  if (missing.length > 0) {
    missing.forEach(m => { if (m.el) m.el.classList.add('error'); });
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  
  const payload = {
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone_number: phone || null,
    subject: '',
    business_type: subject || 'other',
    preferred_space_size: null,
    monthly_budget_range: null,
    message: message
  };

  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('property_id') || urlParams.get('id') || (currentProperty && currentProperty.property_id);
    if (currentProperty && (!payload.preferred_space_size || !payload.monthly_budget_range)) {
      
      payload.subject = `${currentProperty.property_name || 'Property'} - ${currentProperty.property_id || propertyId}`;
      
      if (currentProperty.floor_area_sqm) payload.preferred_space_size = String(currentProperty.floor_area_sqm) + ' sqm';
      
      if (currentProperty.base_rent) payload.monthly_budget_range = String(currentProperty.base_rent);
    } else if (propertyId) {
      
      const res = await fetch(`/api/v1/properties/${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        const prop = data.property;
        if (prop) {
          payload.subject = `${prop.property_name || 'Property'} - ${prop.property_id || propertyId}`;
          if (prop.floor_area_sqm) payload.preferred_space_size = String(prop.floor_area_sqm) + ' sqm';
          if (prop.base_rent) payload.monthly_budget_range = String(prop.base_rent);
        }
      }
    }

    
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    const resp = await fetch('/api/v1/contact-us/create-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `Server responded with ${resp.status}`);
    }

    
    showToast('Thank you! Your inquiry has been sent.', 'success');
    form.reset();
    
    form.querySelectorAll('input, select, textarea').forEach(f => f.classList.remove('error', 'success'));
  } catch (err) {
    console.error('Contact submit error:', err);
    showToast('Failed to send message. Please try again later.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  }
};


function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = 10000;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.padding = '12px 16px';
  toast.style.borderRadius = '10px';
  toast.style.color = 'white';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
  toast.style.maxWidth = '360px';
  toast.style.opacity = '0';

  if (type === 'success') toast.style.background = 'linear-gradient(135deg,#10b981,#059669)';
  else if (type === 'error') toast.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
  else toast.style.background = 'linear-gradient(135deg,#3b82f6,#1d4ed8)';

  toast.textContent = message;
  container.appendChild(toast);

  
  requestAnimationFrame(() => { toast.style.transition = 'transform 260ms ease, opacity 260ms ease'; toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}
}

function setMainImage(thumbnail, index) {
  const mainImageElement = document.getElementById("mainImage");
  if (mainImageElement && images[index]) {
    mainImageElement.src = images[index];

    document.querySelectorAll(".thumbnail").forEach((thumb) => {
      thumb.classList.remove("active");
    });
    thumbnail.classList.add("active");

    currentImageIndex = index;
  }
}

function changeImage(direction) {
  currentImageIndex += direction;

  if (currentImageIndex >= images.length) {
    currentImageIndex = 0;
  }
  if (currentImageIndex < 0) {
    currentImageIndex = images.length - 1;
  }

  const mainImageElement = document.getElementById("mainImage");
  if (mainImageElement && images[currentImageIndex]) {
    mainImageElement.src = images[currentImageIndex];

    document.querySelectorAll(".thumbnail").forEach((thumb, index) => {
      thumb.classList.toggle("active", index === currentImageIndex);
    });
  }
}

function revealOnScroll() {
  const reveals = document.querySelectorAll(".reveal-element");
  const windowHeight = window.innerHeight;
  const elementVisible = 150;

  reveals.forEach((element) => {
    const elementTop = element.getBoundingClientRect().top;

    if (elementTop < windowHeight - elementVisible) {
      element.classList.add("revealed");
    }
  });
}

function updateImageGallery(newImages) {
  images.length = 0;
  images.push(...newImages);

  const thumbnails = document.querySelectorAll(".thumbnail");
  thumbnails.forEach((thumbnail, index) => {
    if (newImages[index]) {
      thumbnail.src = newImages[index].replace("w=1000", "w=200");
      thumbnail.onclick = () => setMainImage(thumbnail, index);
    }
  });

  currentImageIndex = 0;
  const mainImage = document.getElementById("mainImage");
  if (mainImage && newImages[0]) {
    mainImage.src = newImages[0];
  }
}


window.changeImage = changeImage;
window.setMainImage = setMainImage;
window.revealOnScroll = revealOnScroll;
window.updateImageGallery = updateImageGallery;
