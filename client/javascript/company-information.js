import fetchCompanyDetails from "../api/loadCompanyInfo.js";
import fetchAboutUsDetails from "../api/loadAboutUs.js";

let companyId = null;

const API_BASE_URL = "/api/v1/company-details";
const ABOUT_API_URL = "/api/v1/about-us";

let websiteData = {
  services: {
    title: "Our Services",
    description:
      "Comprehensive commercial real estate solutions tailored to your business needs",
    items: [
      {
        id: 1,
        title: "Commercial Leasing",
        description:
          "Premium commercial spaces designed to accommodate various business types with flexible lease terms and competitive rates.",
      },
      {
        id: 2,
        title: "Property Management",
        description:
          "Full-service property management ensuring optimal operations, maintenance, and tenant satisfaction.",
      },
      {
        id: 3,
        title: "Business Consultation",
        description:
          "Expert guidance to help businesses choose the right commercial space and optimize their operations for success.",
      },
      {
        id: 4,
        title: "Space Customization",
        description:
          "Tailored space modifications and improvements to meet specific business requirements and brand aesthetics.",
      },
      {
        id: 5,
        title: "Community Building",
        description:
          "Fostering a collaborative business environment that encourages networking and mutual growth among tenants.",
      },
      {
        id: 6,
        title: "Digital Solutions",
        description:
          "Modern technology solutions to streamline operations and enhance the commercial leasing experience.",
      },
    ],
  },
};

const availableIcons = [
  "fas fa-map-marker-alt",
  "fas fa-chart-line",
  "fas fa-building",
  "fas fa-shield-alt",
  "fas fa-dollar-sign",
  "fas fa-concierge-bell",
  "fas fa-rocket",
  "fas fa-star",
  "fas fa-trophy",
  "fas fa-handshake",
  "fas fa-users",
  "fas fa-tools",
  "fas fa-lightbulb",
  "fas fa-heart",
  "fas fa-medal",
  "fas fa-crown",
  "fas fa-gem",
  "fas fa-thumbs-up",
  "fas fa-check-circle",
  "fas fa-award",
];
let hasUnsavedChanges = false;

document.addEventListener("DOMContentLoaded", function () {
  loadCompanyInfo().then(() => {
    setupRealtimeValidation();
  });
  setupEventListeners();
  setupLogoHandling();
  setupAltLogoHandling();
  setupRealtimeValidation();
});

function setupEventListeners() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
    });
  });

  window.addEventListener("beforeunload", function (e) {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = "";
      return "You have unsaved changes. Are you sure you want to leave?";
    }
  });
}

async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `Manage Company Information`
    : "Manage Company Information";
}

document.addEventListener("DOMContentLoaded", () => {
  setDynamicInfo();
});

function setupLogoHandling() {
  const logoInput = document.getElementById("logo-input");
  const logoPreview = document.getElementById("logo-preview");

  logoInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      handleLogoFile(file);
    }
  });

  logoPreview.addEventListener("click", () => {
    if (!logoPreview.classList.contains("has-image")) {
      logoInput.click();
    }
  });

  logoPreview.addEventListener("dragover", (e) => {
    e.preventDefault();
    logoPreview.classList.add("drag-over");
  });

  logoPreview.addEventListener("dragleave", () => {
    logoPreview.classList.remove("drag-over");
  });

  logoPreview.addEventListener("drop", (e) => {
    e.preventDefault();
    logoPreview.classList.remove("drag-over");

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      handleLogoFile(files[0]);
    }
  });
}

function setupAltLogoHandling() {
  const altLogoInput = document.getElementById("alt-logo-input");
  const altLogoPreview = document.getElementById("alt-logo-preview");

  altLogoInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      handleAltLogoFile(file);
    }
  });
  altLogoPreview.addEventListener("click", () => {
    if (!altLogoPreview.classList.contains("has-image")) {
      altLogoInput.click();
    }
  });

  altLogoPreview.addEventListener("dragover", (e) => {
    e.preventDefault();
    altLogoPreview.classList.add("drag-over");
  });

  altLogoPreview.addEventListener("dragleave", () => {
    altLogoPreview.classList.remove("drag-over");
  });

  altLogoPreview.addEventListener("drop", (e) => {
    e.preventDefault();
    altLogoPreview.classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      handleAltLogoFile(files[0]);
    }
  });
}

function handleAltLogoFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showNotification("Alternate logo file size must be less than 5MB", "error");
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    showNotification(
      "Please upload a valid image file (JPEG, PNG, GIF, WebP)",
      "error"
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const altLogoData = e.target.result;
    displayAltLogo(altLogoData);
    hasUnsavedChanges = true;
    showNotification("Alternate logo uploaded successfully!", "success");
  };
  reader.readAsDataURL(file);
}

function displayAltLogo(altLogoData) {
  const altLogoPreview = document.getElementById("alt-logo-preview");
  const removeAltLogoBtn = document.getElementById("remove-alt-logo-btn");

  altLogoPreview.innerHTML = `<img src="${altLogoData}" alt="Alternate Logo" class="logo-image">`;
  altLogoPreview.classList.add("has-image");
  removeAltLogoBtn.style.display = "inline-flex";
}

function removeAltLogo() {
  const confirmFn =
    typeof window !== "undefined" && typeof window.showConfirm === "function"
      ? (msg, title) => window.showConfirm(msg, title)
      : (msg) => Promise.resolve(confirm(String(msg)));
  confirmFn(
    "Are you sure you want to remove the alternate logo?",
    "Confirm remove"
  ).then((ok) => {
    if (!ok) return;
    const altLogoPreview = document.getElementById("alt-logo-preview");
    const removeAltLogoBtn = document.getElementById("remove-alt-logo-btn");

    altLogoPreview.innerHTML = `
            <div class="logo-placeholder">
                <i class="fas fa-image"></i>
                <p>No alternate logo uploaded</p>
                <small>Click to upload or drag & drop</small>
            </div>
        `;
    altLogoPreview.classList.remove("has-image");
    removeAltLogoBtn.style.display = "none";
    hasUnsavedChanges = true;
    showNotification("Alternate logo removed successfully!", "success");
  });
}

function triggerAltLogoUpload() {
  document.getElementById("alt-logo-input").click();
}

function switchTab(tabId) {
  document
    .querySelectorAll(".tab-button")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));

  document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");
  document.getElementById(tabId).classList.add("active");

  showNotification(`Switched to ${tabId} management`, "info");
}

function triggerLogoUpload() {
  document.getElementById("logo-input").click();
}

function handleLogoFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showNotification("Logo file size must be less than 5MB", "error");
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    showNotification(
      "Please upload a valid image file (JPEG, PNG, GIF, WebP)",
      "error"
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const logoData = e.target.result;
    displayLogo(logoData);
    hasUnsavedChanges = true;
    showNotification("Logo uploaded successfully!", "success");
  };
  reader.readAsDataURL(file);
}

function displayLogo(logoData) {
  const logoPreview = document.getElementById("logo-preview");
  const removeLogo = document.getElementById("remove-logo-btn");

  logoPreview.innerHTML = `<img src="${logoData}" alt="Company Logo" class="logo-image">`;
  logoPreview.classList.add("has-image");
  removeLogo.style.display = "inline-flex";
}

function removeLogo() {
  const confirmFn =
    typeof window !== "undefined" && typeof window.showConfirm === "function"
      ? (msg, title) => window.showConfirm(msg, title)
      : (msg) => Promise.resolve(confirm(String(msg)));
  confirmFn(
    "Are you sure you want to remove the company logo?",
    "Confirm remove"
  ).then((ok) => {
    if (!ok) return;
    const logoPreview = document.getElementById("logo-preview");
    const removeLogo = document.getElementById("remove-logo-btn");

    logoPreview.innerHTML = `
                    <div class="logo-placeholder">
                        <i class="fas fa-building"></i>
                        <p>No logo uploaded</p>
                        <small>Click to upload or drag & drop</small>
                    </div>
                `;
    logoPreview.classList.remove("has-image");
    removeLogo.style.display = "none";
    hasUnsavedChanges = true;
    showNotification("Logo removed successfully!", "success");
  });
}

//#region Company Information
async function loadCompanyInfo() {
  try {
    let cached = sessionStorage.getItem("companyDetails");
    let company;
    if (cached) {
      company = JSON.parse(cached);
    } else {
      company = await fetchCompanyDetails();
      sessionStorage.setItem("companyDetails", JSON.stringify(company));
    }

    const data = company[0] || company;
    if (data && typeof data === "object") {
      companyId = data.id;
      document.getElementById("company-name").value = data.company_name || "";
      document.getElementById("company-email").value = data.email || "";
      document.getElementById("company-phone").value = data.phone_number || "";
      document.getElementById("company-alt-phone").value =
        data.alt_phone_number || "";
      document.getElementById("company-description").value =
        data.business_desc || "";
      document.getElementById("company-business-hours").value =
        data.business_hours || "";
      document.getElementById("company-house-no").value = data.house_no || "";
      document.getElementById("company-street-address").value =
        data.street_address || "";
      document.getElementById("company-city").value = data.city || "";
      document.getElementById("company-province").value = data.province || "";
      document.getElementById("company-zip-code").value = data.zip_code || "";
      document.getElementById("company-country").value = data.country || "";
      if (data.icon_logo_url) displayLogo(data.icon_logo_url);
      if (data.alt_logo_url) displayAltLogo(data.alt_logo_url);
    }
  } catch (err) {
    showNotification("Failed to load company info.", "error");
  }
}

async function saveCompanyInfo() {
  const saveBtn = document.getElementById("save-company-btn");
  if (!validateCompanyInfoForm()) return;

  const adminEmailInput = document.getElementById("admin-email-input");
  const userDetails = JSON.parse(localStorage.getItem("user") || "{}");
  const adminEmail = userDetails.email || "";

  if (adminEmailInput) {
    adminEmailInput.value = adminEmail;
  }

  const promptFn =
    typeof window !== "undefined" && typeof window.showPrompt === "function"
      ? (msg, placeholder, title, inputType) =>
        window.showPrompt(msg, placeholder, title, inputType)
      : (msg, placeholder, title, inputType) => {
        if (inputType === "password") {
          return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.style.position = "fixed";
            overlay.style.inset = "0";
            overlay.style.background = "rgba(0,0,0,0.45)";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.style.zIndex = 12000;

            const box = document.createElement("div");
            box.style.background = "#fff";
            box.style.padding = "18px";
            box.style.borderRadius = "10px";
            box.style.minWidth = "320px";
            box.style.maxWidth = "90%";
            box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";

            const label = document.createElement("div");
            label.style.marginBottom = "8px";
            label.style.fontWeight = "600";
            label.textContent = String(msg);

            const input = document.createElement("input");
            input.type = "password";
            input.name = `company-pw-fallback-${Date.now()}`;
            input.autocomplete = "new-password";
            input.autocorrect = "off";
            input.autocapitalize = "off";
            input.spellcheck = false;
            input.placeholder = String(placeholder || "");
            input.style.width = "100%";
            input.style.padding = "8px";
            input.style.border = "1px solid #e5e7eb";
            input.style.borderRadius = "6px";
            input.style.marginBottom = "12px";

            const actions = document.createElement("div");
            actions.style.display = "flex";
            actions.style.gap = "8px";
            actions.style.justifyContent = "flex-end";

            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.className = "btn-cancel";
            cancelBtn.onclick = () => {
              if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
              resolve(null);
            };

            const okBtn = document.createElement("button");
            okBtn.textContent = "OK";
            okBtn.className = "btn-confirm";
            okBtn.onclick = () => {
              const v = input.value;
              if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
              resolve(String(v));
            };

            actions.appendChild(cancelBtn);
            actions.appendChild(okBtn);

            box.appendChild(label);
            box.appendChild(input);
            box.appendChild(actions);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            setTimeout(() => {
              try {
                input.focus();
              } catch (e) { }
            }, 20);
          });
        }

        return Promise.resolve(prompt(String(msg)));
      };

  return new Promise((resolve) => {
    const adminEmailValue =
      document.getElementById("admin-email-input")?.value || adminEmail;
    const promptMessage = "Enter admin password to confirm saving changes";

    promptFn(promptMessage, "", "Admin Password", "password")
      .then(async (adminPassword) => {
        if (
          adminPassword === null ||
          adminPassword === undefined ||
          String(adminPassword).trim() === ""
        ) {
          showNotification(
            "Admin email and password are required to save changes.",
            "error"
          );
          saveBtn.classList.remove("btn-loading");
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<i class="fas fa-save"></i> Save Company Info`;
          resolve();
          return;
        }

        await continueSaveCompanyInfo(adminEmailValue, String(adminPassword));
        resolve();
      })
      .catch((err) => {
        saveBtn.classList.remove("btn-loading");
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fas fa-save"></i> Save Company Info`;
        resolve();
      });
  });
}

async function continueSaveCompanyInfo(adminEmail, adminPassword) {
  const saveBtn = document.getElementById("save-company-btn");
  if (!validateCompanyInfoForm()) return;

  saveBtn.classList.add("btn-loading");
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner"></span>Saving...`;

  const formData = new FormData();
  formData.append(
    "company_name",
    document.getElementById("company-name").value.trim()
  );
  formData.append(
    "email",
    document.getElementById("company-email").value.trim()
  );
  formData.append(
    "phone_number",
    document.getElementById("company-phone").value.trim()
  );
  formData.append(
    "alt_phone_number",
    document.getElementById("company-alt-phone").value.trim()
  );
  formData.append(
    "business_desc",
    document.getElementById("company-description").value.trim()
  );
  formData.append(
    "business_hours",
    document.getElementById("company-business-hours").value.trim()
  );
  formData.append(
    "house_no",
    document.getElementById("company-house-no").value.trim()
  );
  formData.append(
    "street_address",
    document.getElementById("company-street-address").value.trim()
  );
  formData.append("city", document.getElementById("company-city").value.trim());
  formData.append(
    "province",
    document.getElementById("company-province").value.trim()
  );
  formData.append(
    "zip_code",
    document.getElementById("company-zip-code").value.trim()
  );
  formData.append(
    "country",
    document.getElementById("company-country").value.trim()
  );

  formData.append("admin_email", adminEmail);
  formData.append("admin_password", adminPassword);

  const logoInput = document.getElementById("logo-input");
  const altLogoInput = document.getElementById("alt-logo-input");

  const currentLogoUrl =
    document.getElementById("logo-preview").querySelector("img")?.src || "";
  const currentAltLogoUrl =
    document.getElementById("alt-logo-preview").querySelector("img")?.src || "";

  if (logoInput.files[0]) {
    formData.append("icon_logo_url", logoInput.files[0]);
  } else if (currentLogoUrl) {
    formData.append("icon_logo_url", currentLogoUrl);
  }

  if (altLogoInput.files[0]) {
    formData.append("alt_logo_url", altLogoInput.files[0]);
  } else if (currentAltLogoUrl) {
    formData.append("alt_logo_url", currentAltLogoUrl);
  }

  try {
    let res;
    if (companyId) {
      res = await fetch(`${API_BASE_URL}/${companyId}`, {
        method: "PATCH",
        body: formData,
      });
    } else {
      res = await fetch(`${API_BASE_URL}/create`, {
        method: "POST",
        body: formData,
      });
    }
    if (res.ok) {
      sessionStorage.removeItem("companyDetails");
      sessionStorage.setItem("companyDetailsForceRefresh", "true");
      showNotification("Company information saved successfully!", "success");
      hasUnsavedChanges = false;
      await loadCompanyInfo();
      if (!companyId) {
        const data = await res.json();
        companyId = data.id;
        await loadCompanyInfo();
      }
    } else {
      showNotification("Failed to save company info.", "error");
    }
  } catch (err) {
    showNotification("Error saving company info.", "error");
  } finally {
    saveBtn.classList.remove("btn-loading");
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fas fa-save"></i> Save Company Info`;
  }
}

function previewCompanyInfo() {
  const name = document.getElementById("company-name").value.trim();
  const email = document.getElementById("company-email").value.trim();
  const phone = document.getElementById("company-phone").value.trim();
  const description = document
    .getElementById("company-description")
    .value.trim();
  const businessHours = document
    .getElementById("company-business-hours")
    .value.trim();
  const logo = document
    .getElementById("logo-preview")
    .querySelector("img")?.src;
  const altLogo = document
    .getElementById("alt-logo-preview")
    .querySelector("img")?.src;

  const houseNo = document.getElementById("company-house-no").value.trim();
  const streetAddress = document
    .getElementById("company-street-address")
    .value.trim();
  const city = document.getElementById("company-city").value.trim();
  const province = document.getElementById("company-province").value.trim();
  const zipCode = document.getElementById("company-zip-code").value.trim();
  const country = document.getElementById("company-country").value.trim();

  const addressHtml = `
    <div style="margin-bottom: 18px;">
      <h4>Company Address</h4>
      <p>
        ${houseNo ? houseNo + ", " : ""}
        ${streetAddress ? streetAddress + ", " : ""}
        ${city ? city + ", " : ""}
        ${province ? province + ", " : ""}
        ${zipCode ? zipCode + ", " : ""}
        ${country}
      </p>
    </div>
  `;

  const previewContent = `
    <div class="company-profile-card">
      <div class="company-header">
        <div class="company-logo-display">
          ${logo
      ? `<img src="${logo}" alt="Company Logo">`
      : `<i class="fas fa-building"></i>`
    }
        </div>
        <div class="company-details">
          <h2>${name}</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
        </div>
      </div>
      ${addressHtml}
      <p>${description}</p>
      <h4>Business Hours</h4>
      <p>${businessHours}</p>
      <div>
        <h4>Alternate Logo</h4>
        ${altLogo
      ? `<img src="${altLogo}" alt="Alternate Logo">`
      : `<i class="fas fa-image"></i>`
    }
      </div>
    </div>
  `;
  showPreview("Company Profile Preview", previewContent);
}

function validateCompanyInfoForm() {
  const name = document.getElementById("company-name").value.trim();
  const email = document.getElementById("company-email").value.trim();
  const phone = document.getElementById("company-phone").value.trim();
  const description = document
    .getElementById("company-description")
    .value.trim();
  const businessHours = document
    .getElementById("company-business-hours")
    .value.trim();
  const logo = document.getElementById("logo-preview").querySelector("img");
  const altLogo = document
    .getElementById("alt-logo-preview")
    .querySelector("img");

  const streetAddress = document
    .getElementById("company-street-address")
    .value.trim();
  const city = document.getElementById("company-city").value.trim();
  const province = document.getElementById("company-province").value.trim();
  const zipCode = document.getElementById("company-zip-code").value.trim();
  const country = document.getElementById("company-country").value.trim();

  if (
    !name ||
    !email ||
    !phone ||
    !businessHours ||
    !description ||
    !logo ||
    !altLogo ||
    !streetAddress ||
    !city ||
    !province ||
    !zipCode ||
    !country
  ) {
    showNotification(
      "All fields except House No. are required, including both logos and address.",
      "error"
    );
    return false;
  }
  return true;
}

function setupRealtimeValidation() {
  const requiredFields = [
    { id: "company-name", warning: "Company name is required." },
    { id: "company-email", warning: "Email is required." },
    { id: "company-phone", warning: "Phone number is required." },
    { id: "company-description", warning: "Business description is required." },
    { id: "company-business-hours", warning: "Business hours are required." },
    { id: "company-street-address", warning: "Street address is required." },
    { id: "company-city", warning: "City is required." },
    { id: "company-province", warning: "Province is required." },
    { id: "company-zip-code", warning: "Zip code is required." },
    { id: "company-country", warning: "Country is required." },
  ];

  requiredFields.forEach((field) => {
    const input = document.getElementById(field.id);
    const warningSpan = document.getElementById(`${field.id}-warning`);
    if (!input) return;
    if (!warningSpan) return;
    input.addEventListener("input", () => {
      if (!input.value.trim()) {
        warningSpan.textContent = field.warning;
        warningSpan.style.display = "inline";
      } else {
        warningSpan.textContent = "";
        warningSpan.style.display = "none";
      }
    });

    if (!input.value.trim()) {
      warningSpan.textContent = field.warning;
      warningSpan.style.display = "inline";
    } else {
      warningSpan.textContent = "";
      warningSpan.style.display = "none";
    }
  });

  function validateLogoPreview() {
    const logoImg = document
      .getElementById("logo-preview")
      .querySelector("img");
    const logoWarning = document.getElementById("logo-preview-warning");
    if (!logoWarning) return;
    if (!logoImg) {
      logoWarning.textContent = "Company logo is required.";
      logoWarning.style.display = "inline";
    } else {
      logoWarning.textContent = "";
      logoWarning.style.display = "none";
    }
  }

  function validateAltLogoPreview() {
    const altLogoImg = document
      .getElementById("alt-logo-preview")
      .querySelector("img");
    const altLogoWarning = document.getElementById("alt-logo-preview-warning");
    if (!altLogoWarning) return;
    if (!altLogoImg) {
      altLogoWarning.textContent = "Alternate logo is required.";
      altLogoWarning.style.display = "inline";
    } else {
      altLogoWarning.textContent = "";
      altLogoWarning.style.display = "none";
    }
  }

  document
    .getElementById("logo-input")
    .addEventListener("change", validateLogoPreview);
  document
    .getElementById("alt-logo-input")
    .addEventListener("change", validateAltLogoPreview);

  const origDisplayLogo = window.displayLogo;
  window.displayLogo = function (...args) {
    origDisplayLogo.apply(this, args);
    validateLogoPreview();
  };
  const origDisplayAltLogo = window.displayAltLogo;
  window.displayAltLogo = function (...args) {
    origDisplayAltLogo.apply(this, args);
    validateAltLogoPreview();
  };

  requiredFields.forEach((field) => {
    const input = document.getElementById(field.id);
    input.dispatchEvent(new Event("input"));
  });
  validateLogoPreview();
  validateAltLogoPreview();
}

function renderServices() {
  const servicesList = document.getElementById("services-list");
  servicesList.innerHTML = "";

  websiteData.services.items.forEach((service) => {
    const serviceElement = createServiceElement(service);
    servicesList.appendChild(serviceElement);
  });
}

function createServiceElement(service) {
  const div = document.createElement("div");
  div.className = "service-item";
  div.innerHTML = `
                <h4>${service.title}</h4>
                <p>${service.description}</p>
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="editService(${service.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-danger" onclick="deleteService(${service.id})">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            `;
  return div;
}

//#endregion

//#region ABOUT US
document.addEventListener("DOMContentLoaded", function () {
  generateAboutImageUploads();

  if (document.getElementById("story-content-editor")) {
    window.storyQuill = new Quill("#story-content-editor", {
      theme: "snow",
      placeholder: "Write your story here...",
      modules: {
        toolbar: [
          [{ header: [1, 2, false] }],
          ["bold", "italic", "underline"],
          ["link", "blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["clean"],
        ],
      },
    });
  }

  if (document.getElementById("homepage-about-content-editor")) {
    window.homepageAboutQuill = new Quill("#homepage-about-content-editor", {
      theme: "snow",
      placeholder: "Enter About Us content...",
      modules: {
        toolbar: [
          [{ header: [1, 2, false] }],
          ["bold", "italic", "underline"],
          ["link", "blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["clean"],
        ],
      },
    });
  }

  loadAboutUsContent();
});

function setAboutUsSession(data) {
  sessionStorage.setItem("aboutUsData", JSON.stringify(data));
}

function getAboutUsSession() {
  const data = sessionStorage.getItem("aboutUsData");
  return data ? JSON.parse(data) : null;
}

async function loadAboutUsContent(forceRefresh = false) {
  const about = await fetchAboutUsDetails(forceRefresh);
  if (!about) {
    showNotification("Failed to load About Us content.", "error");
    return;
  }
  setAboutUsSession(about);

  if (!about) return;

  document.getElementById("story-title").value =
    about.story_section_title || "";

  if (window.storyQuill && about.story_content) {
    window.storyQuill.root.innerHTML = about.story_content;
  }

  document.getElementById("mission-text").value = about.mission || "";
  document.getElementById("vision-text").value = about.vision || "";
  document.getElementById("values-text").value = about.core_values || "";
  document.getElementById("homepage-about-subtitle").value =
    about.homepage_about_subtitle || "";

  if (window.homepageAboutQuill && about.homepage_about_content) {
    window.homepageAboutQuill.root.innerHTML = about.homepage_about_content;
  }

  for (let i = 1; i <= 4; i++) {
    const imgUrl = about[`about_img${i}`];
    const img = document.getElementById(`aboutImage${i}Current`);
    const placeholder = document.getElementById(`aboutImagePlaceholder${i}`);
    const removeBtn = document.getElementById(`removeAboutImageBtn${i}`);
    if (imgUrl) {
      img.src = imgUrl;
      img.style.display = "block";
      placeholder.style.display = "none";
      removeBtn.style.display = "inline-flex";
    } else {
      img.src = "";
      img.style.display = "none";
      placeholder.style.display = "block";
      removeBtn.style.display = "none";
    }
  }
}

async function saveAboutContent() {
  const saveBtn = document.querySelector("#about .btn-success");
  saveBtn.classList.add("btn-loading");
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner"></span>Saving...`;

  const formData = new FormData();
  formData.append(
    "story_section_title",
    document.getElementById("story-title").value.trim()
  );
  formData.append(
    "story_content",
    window.storyQuill ? window.storyQuill.root.innerHTML : ""
  );
  formData.append(
    "mission",
    document.getElementById("mission-text").value.trim()
  );
  formData.append(
    "vision",
    document.getElementById("vision-text").value.trim()
  );
  formData.append(
    "core_values",
    document.getElementById("values-text").value.trim()
  );
  formData.append(
    "homepage_about_subtitle",
    document.getElementById("homepage-about-subtitle").value.trim()
  );
  formData.append(
    "homepage_about_content",
    window.homepageAboutQuill ? window.homepageAboutQuill.root.innerHTML : ""
  );

  for (let i = 1; i <= 4; i++) {
    const fileInput = document.getElementById(`aboutImage${i}`);
    if (fileInput && fileInput.files[0]) {
      formData.append(`about_img${i}`, fileInput.files[0]);
    }
  }

  try {
    const res = await fetch(ABOUT_API_URL);
    const result = await res.json();
    const exists = result.data && result.data.length > 0;

    let saveRes;
    if (!exists) {
      saveRes = await fetch(`${ABOUT_API_URL}/create-about-us`, {
        method: "POST",
        body: formData,
      });
    } else {
      saveRes = await fetch(`${ABOUT_API_URL}`, {
        method: "PATCH",
        body: formData,
      });
    }

    if (saveRes.ok) {
      sessionStorage.removeItem("aboutUsData");

      showNotification("About Us content saved successfully!", "success");
      hasUnsavedChanges = false;
      await loadAboutUsContent(true);
    } else {
      showNotification("Failed to save About Us content.", "error");
    }
  } catch (err) {
    showNotification("Error saving About Us content.", "error");
  } finally {
    saveBtn.classList.remove("btn-loading");
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fas fa-save"></i> Save About Content`;
  }
}

function previewAbout() {
  const storyTitle = document.getElementById("story-title")?.value.trim() || "";
  const storyContent = window.storyQuill
    ? window.storyQuill.root.innerHTML
    : "";
  const mission = document.getElementById("mission-text")?.value.trim() || "";
  const vision = document.getElementById("vision-text")?.value.trim() || "";
  const values = document.getElementById("values-text")?.value.trim() || "";

  const previewContent = `
    <div style="font-family: 'Poppins', sans-serif; line-height: 1.6;">
      <h2 style="color: #2c3e50; margin-bottom: 20px;">${escapeHtml(
    storyTitle
  )}</h2>
      <div style="margin-top: 10px;">${storyContent}</div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 30px;">
        <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">Mission</h4>
          <p style="color: #64748b; font-size: 14px;">${escapeHtml(mission)}</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">Vision</h4>
          <p style="color: #64748b; font-size: 14px;">${escapeHtml(vision)}</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">Values</h4>
          <p style="color: #64748b; font-size: 14px;">${escapeHtml(values)}</p>
        </div>
      </div>
    </div>
  `;

  showPreview("About Page Preview", previewContent);
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function generateAboutImageUploads() {
  const grid = document.getElementById("aboutImagesGrid");
  grid.innerHTML = "";

  for (let i = 1; i <= 4; i++) {
    const imageContainer = document.createElement("div");
    imageContainer.className = "image-upload-container";
    imageContainer.innerHTML = `
      <div class="form-group">
        <label class="form-label">About Image ${i}</label>
        <div class="image-upload" id="aboutImageUpload${i}" onclick="document.getElementById('aboutImage${i}').click()" style="position: relative;">
          <div class="upload-placeholder" id="aboutImagePlaceholder${i}">
            <i class="fas fa-image"></i>
            <p>Upload image ${i}</p>
            <small>Recommended size: 800x600px</small>
          </div>
          <img id="aboutImage${i}Current" class="current-image" alt="About Image ${i}" style="display:none; max-width:100%; max-height:160px; position:absolute; top:0; left:0; right:0; bottom:0; margin:auto;">
          <button type="button" class="btn btn-danger" id="removeAboutImageBtn${i}" style="display:none; position:absolute; top:8px; right:8px; z-index:2;" onclick="removeAboutImage(${i})">
            <i class="fas fa-trash"></i>
            Remove
          </button>
        </div>
        <input type="file" id="aboutImage${i}" accept="image/*" style="display: none;">
      </div>
    `;
    grid.appendChild(imageContainer);

    setTimeout(() => {
      const fileInput = document.getElementById(`aboutImage${i}`);
      const img = document.getElementById(`aboutImage${i}Current`);
      const placeholder = document.getElementById(`aboutImagePlaceholder${i}`);
      const removeBtn = document.getElementById(`removeAboutImageBtn${i}`);

      fileInput.addEventListener("change", function () {
        const file = this.files[0];
        if (file && file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = function (e) {
            img.src = e.target.result;
            img.style.display = "block";
            placeholder.style.display = "none";
            removeBtn.style.display = "inline-flex";
          };
          reader.readAsDataURL(file);
        }
      });
    }, 0);
  }
}

window.removeAboutImage = function (i) {
  const fileInput = document.getElementById(`aboutImage${i}`);
  const img = document.getElementById(`aboutImage${i}Current`);
  const placeholder = document.getElementById(`aboutImagePlaceholder${i}`);
  const removeBtn = document.getElementById(`removeAboutImageBtn${i}`);
  fileInput.value = "";
  img.src = "";
  img.style.display = "none";
  placeholder.style.display = "block";
  removeBtn.style.display = "none";
};

//#endregion

function previewWebsite() {
  const company = company.company_name;
  const logoDisplay = company.logo
    ? `<img src="${company.logo}" alt="${company.name} Logo" style="height: 60px; width: auto; margin-right: 15px;">`
    : `<i class="fas fa-building" style="font-size: 3rem; color: #3b82f6; margin-right: 15px;"></i>`;

  const fullPreviewContent = `
                <div style="font-family: 'Poppins', sans-serif;">
                    <div style="text-align: center; margin-bottom: 50px; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 20px;">
                        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                            ${logoDisplay}
                            <div>
                                <h1 style="color: white; font-size: 3em; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">${company.name
    }</h1>
                                <p style="color: rgba(255,255,255,0.9); font-size: 1.3em; margin: 5px 0 0 0;">${company.tagline
    }</p>
                            </div>
                        </div>
                        <p style="font-size: 1.1em; line-height: 1.6; max-width: 800px; margin: 0 auto; opacity: 0.95;">Founded in ${company.founded
    }, delivering commercial real estate excellence</p>
                    </div>
                    
                    <section style="margin-bottom: 60px;">
                        <h2 style="color: #2c3e50; margin-bottom: 30px; text-align: center; font-size: 2.5em;">${about.story.title
    }</h2>
                    </section>
                    
                    <section style="margin-bottom: 60px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto;">
                            <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #3b82f6, #60a5fa); color: white; border-radius: 20px;">
                                <h3 style="margin-bottom: 20px; font-size: 1.8em;">Mission</h3>
                                <p style="line-height: 1.7; font-size: 1.05em;">${about.mvv.mission
    }</p>
                            </div>
                            <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #10b981, #34d399); color: white; border-radius: 20px;">
                                <h3 style="margin-bottom: 20px; font-size: 1.8em;">Vision</h3>
                                <p style="line-height: 1.7; font-size: 1.05em;">${about.mvv.vision
    }</p>
                            </div>
                            <div style="text-align: center; padding: 40px; background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; border-radius: 20px;">
                                <h3 style="margin-bottom: 20px; font-size: 1.8em;">Values</h3>
                                <p style="line-height: 1.7; font-size: 1.05em;">${about.mvv.values
    }</p>
                            </div>
                        </div>
                    </section>
                    
                    <section style="margin-bottom: 60px;">
                        <h2 style="color: #2c3e50; margin-bottom: 15px; text-align: center; font-size: 2.5em;">${websiteData.services.title
    }</h2>
                        <p style="color: #64748b; margin-bottom: 50px; text-align: center; font-size: 1.2em; max-width: 600px; margin-left: auto; margin-right: auto;">${websiteData.services.description
    }</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 30px; max-width: 1400px; margin: 0 auto;">
                            ${websiteData.services.items
      .map(
        (service) => `
                                <div style="background: white; border: 2px solid #e5e7eb; border-radius: 20px; padding: 30px; transition: all 0.3s ease; box-shadow: 0 8px 25px rgba(0,0,0,0.1); position: relative; overflow: hidden;">
                                    <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: linear-gradient(45deg, #10b981, #34d399); border-radius: 50%; opacity: 0.1;"></div>
                                    <h4 style="color: #1e293b; margin-bottom: 18px; font-size: 1.4em; font-weight: 600; position: relative; z-index: 1;">${service.title}</h4>
                                    <p style="color: #64748b; line-height: 1.7; font-size: 1.05em; position: relative; z-index: 1;">${service.description}</p>
                                </div>
                            `
      )
      .join("")}
                        </div>
                    </section>
                </div>
            `;

  showPreview("Complete Website Preview", fullPreviewContent);
}

function showPreview(title, content) {
  try {
    if (
      typeof Modal !== "undefined" &&
      Modal &&
      typeof Modal.open === "function"
    ) {
      Modal.open({
        title,
        body: String(content),
        showFooter: true,
        showCancel: false,
        confirmText: "Close",
        onConfirm: () => { },
        variant: "default",
      });
      return;
    }
  } catch (e) {
    console.warn(
      "Modal.open preview failed, falling back to inline preview",
      e
    );
  }

  const titleEl = document.querySelector("#preview-modal .modal-title");
  const contentEl = document.getElementById("preview-content");
  const modalEl = document.getElementById("preview-modal");
  if (titleEl && contentEl && modalEl) {
    titleEl.textContent = title;
    contentEl.innerHTML = content;
    modalEl.classList.add("show");
    return;
  }

  try {
    const text = String(content).replace(/<[^>]+>/g, "");
    if (typeof showAlert === "function") showAlert(text, "info");
    else alert(text);
  } catch (e) {
    try {
      alert(String(title) + "\n\n" + String(content));
    } catch (err) { }
  }
}

function closePreviewModal() {
  try {
    if (
      typeof Modal !== "undefined" &&
      Modal &&
      typeof Modal.close === "function"
    ) {
      Modal.close();
      return;
    }
  } catch (e) { }

  const modalEl = document.getElementById("preview-modal");
  if (modalEl) modalEl.classList.remove("show");
}

function showNotification(message, type = "info") {
  const existingNotifications = document.querySelectorAll(".notification");
  existingNotifications.forEach((notification) => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
                <i class="fas fa-${type === "success"
      ? "check-circle"
      : type === "error"
        ? "exclamation-triangle"
        : "info-circle"
    }"></i>
                ${message}
            `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 100);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveAllContent();
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
    previewWebsite();
  }

  if (e.key === "Escape") {
    closeServiceModal();
    closeAdvantageModal();
    closePreviewModal();
  }
});

window.closePreviewModal = closePreviewModal;
window.previewCompanyInfo = previewCompanyInfo;
window.saveCompanyInfo = saveCompanyInfo;
window.previewAbout = previewAbout;
window.saveAboutContent = saveAboutContent;
window.removeAltLogo = removeAltLogo;
