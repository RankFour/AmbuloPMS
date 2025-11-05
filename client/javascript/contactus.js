import fetchCompanyDetails from "../api/loadCompanyInfo.js";
import { fetchFaqs } from "../api/loadFaqs.js";
const API_BASE_URL = "/api/v1";

document.addEventListener("DOMContentLoaded", () => {
  initializeAnimations();
  enhanceFormInteractions();
  addMicroAnimations();

  setDynamicContactInfo();
  fetchAndRenderContactFAQs();
});

const observerOptions = {
  threshold: 0.15,
  rootMargin: "0px 0px -80px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("revealed");

      const children = entry.target.querySelectorAll(
        ".form-group, .contact-item-box, .faq-item"
      );
      children.forEach((child, index) => {
        setTimeout(() => {
          child.style.animationDelay = `${index * 0.1}s`;
          child.classList.add("stagger-animate");
        }, index * 100);
      });
    }
  });
}, observerOptions);

function initializeAnimations() {
  document.querySelectorAll(".reveal-element").forEach((el) => {
    observer.observe(el);
  });

  window.addEventListener("scroll", () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector(".hero");
    if (hero) {
      hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
  });
}

function enhanceFormInteractions() {
  const form = document.getElementById("contactForm");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    Array.from(form.elements).forEach((field) => {});

    const originalText = submitBtn.textContent;
    const formData = new FormData(this);
    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const subject = formData.get("subject");
    const message = formData.get("message");

    if (!form.checkValidity()) {
      showNotification("Please fill in all required fields.", "error");
      form.reportValidity();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showNotification("Please enter a valid email address.", "error");
      return;
    }

    submitBtn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Sending Message...';
    submitBtn.disabled = true;
    submitBtn.style.background = "#6b7280";
    submitBtn.classList.add("pulse");

    form.style.opacity = "0.7";
    form.style.pointerEvents = "none";

    const payload = mapFormToPayload({
      firstName,
      lastName,
      email,
      phone,
      subject,
      message,
    });

    try {
      const res = await submitContactForm(payload);

      const selectedSubject = document.querySelector(
        "#subject option:checked"
      ).textContent;
      showNotification(
        `Thank you, ${firstName}! Your inquiry (${selectedSubject}) has been received. We'll contact you within 24 hours.`,
        "success"
      );

      this.reset();

      Array.from(this.querySelectorAll("input, textarea, select")).forEach(
        (f) => {
          f.classList.remove("valid", "invalid");
          if (f.parentElement) {
            f.parentElement.classList.remove("has-value", "focused");
          }
        }
      );

      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      submitBtn.style.background = "";
      submitBtn.classList.remove("pulse");

      form.style.opacity = "";
      form.style.pointerEvents = "";

    } catch (err) {
      console.error("Submit contact error:", err);
      showNotification(
        "Failed to send message. Please try again later.",
        "error"
      );
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      submitBtn.style.background = "";
      submitBtn.classList.remove("pulse");
      form.style.opacity = "";
      form.style.pointerEvents = "";
    }
  });

  document.querySelectorAll("input, textarea, select").forEach((field) => {
    field.addEventListener("focus", function () {
      if (this.tagName !== "SELECT") {
        this.parentElement.classList.add("focused");
      }
      this.parentElement.style.transform = "scale(1.01)";
    });

    field.addEventListener("blur", function () {
      if (this.tagName !== "SELECT") {
        this.parentElement.classList.remove("focused");
      }
      this.parentElement.style.transform = "scale(1)";
      updateLabelState(this);
      validateField(this);
    });

    field.addEventListener("input", function () {
      updateLabelState(this);
      validateField(this);
    });

    field.addEventListener("change", function () {
      updateLabelState(this);
      validateField(this);
    });

    updateLabelState(field);
  });
}

function updateLabelState(field) {
  if (field.tagName === "SELECT") {
    return;
  }

  const formGroup = field.parentElement;
  const hasValue = field.value && field.value.trim() !== "";

  if (hasValue) {
    formGroup.classList.add("has-value");
  } else {
    formGroup.classList.remove("has-value");
  }
}

async function setDynamicContactInfo() {
  try {
    const company = await fetchCompanyDetails();

    if (!company) {
      console.warn("No company details returned");
      return;
    }

    const phoneBoxes = document.querySelectorAll(
      ".contact-item-box .contact-item-content h4"
    );
    phoneBoxes.forEach((h4) => {
      if (h4.textContent.includes("Phone Number")) {
        const icon =
          h4.parentElement.parentElement.querySelector(".contact-icon");
        if (icon) icon.innerHTML = `<i class="fa-solid fa-phone"></i>`;
        const pList = h4.parentElement.querySelectorAll("p");
        if (pList[0]) {
          let phoneText = company.phone_number || "";
          if (company.alt_phone_number) {
            phoneText += ` <span style="color:#888;font-size:0.95em;">| ${company.alt_phone_number}</span>`;
          }
          pList[0].innerHTML = phoneText;
        }
        if (pList[1]) {
          pList[1].innerHTML = `<span>Available during business hours</span>`;
        }
        h4.style.marginBottom = "0.25em";
        if (pList[0]) pList[0].style.marginTop = "0.25em";
        if (pList[1]) pList[1].style.marginTop = "0.1em";
      }
    });

    phoneBoxes.forEach((h4) => {
      if (h4.textContent.includes("Email Address")) {
        const icon =
          h4.parentElement.parentElement.querySelector(".contact-icon");
        if (icon) icon.innerHTML = `<i class="fa-solid fa-envelope"></i>`;
        const pList = h4.parentElement.querySelectorAll("p");
        if (pList[0])
          pList[0].innerHTML = `<strong>${company.email || ""}</strong>`;
        if (pList[1])
          pList[1].innerHTML = `<span>We respond within 24 hours</span>`;
        h4.style.marginBottom = "0.25em";
        if (pList[0]) pList[0].style.marginTop = "0.25em";
        if (pList[1]) pList[1].style.marginTop = "0.1em";
      }
    });

    phoneBoxes.forEach((h4) => {
      if (h4.textContent.includes("Office Location")) {
        const icon =
          h4.parentElement.parentElement.querySelector(".contact-icon");
        if (icon) icon.innerHTML = `<i class="fa-solid fa-location-dot"></i>`;
        const pList = h4.parentElement.querySelectorAll("p");
        if (pList[0])
          pList[0].innerHTML = `<strong>${
            company.street_address || ""
          }</strong>`;
        if (pList[1])
          pList[1].innerHTML = `<span>${company.city || ""}, ${
            company.province || ""
          }, ${company.country || ""}</span>`;
        h4.style.marginBottom = "0.25em";
        if (pList[0]) pList[0].style.marginTop = "0.25em";
        if (pList[1]) pList[1].style.marginTop = "0.1em";
      }
    });

    phoneBoxes.forEach((h4) => {
      if (h4.textContent.includes("Business Hours")) {
        const icon =
          h4.parentElement.parentElement.querySelector(".contact-icon");
        if (icon) icon.innerHTML = `<i class="fa-solid fa-clock"></i>`;
        const pList = h4.parentElement.querySelectorAll("p");
        if (company.business_hours) {
          const hours = company.business_hours.split("\n");
          pList.forEach((p, idx) => {
            p.innerHTML = `<span>${hours[idx] || ""}</span>`;
            p.style.marginTop = idx === 0 ? "0.25em" : "0.1em";
          });
        }
        h4.style.marginBottom = "0.25em";
      }
    });

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && company.icon_logo_url) {
      favicon.href = company.icon_logo_url;
    }

    document.title = company.company_name
      ? `Contact Us`
      : "Ambulo Properties - Contact Us";

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content =
        company.meta_description ||
        "Contact Ambulo Properties for your commercial space needs.";
    }
  } catch (error) {
    console.error("Error setting dynamic contact info:", error);

    setFallbackContactInfo();
  }
}

function setFallbackContactInfo() {
  const phoneBoxes = document.querySelectorAll(
    ".contact-item-box .contact-item-content h4"
  );

  phoneBoxes.forEach((h4) => {
    if (h4.textContent.includes("Phone Number")) {
      const icon =
        h4.parentElement.parentElement.querySelector(".contact-icon");
      if (icon) icon.innerHTML = `<i class="fa-solid fa-phone"></i>`;
      const pList = h4.parentElement.querySelectorAll("p");
      if (pList[0]) pList[0].innerHTML = `<strong>+63 xxx xxx xxxx</strong>`;
      if (pList[1])
        pList[1].innerHTML = `<span>Available during business hours</span>`;
    }

    if (h4.textContent.includes("Email Address")) {
      const icon =
        h4.parentElement.parentElement.querySelector(".contact-icon");
      if (icon) icon.innerHTML = `<i class="fa-solid fa-envelope"></i>`;
      const pList = h4.parentElement.querySelectorAll("p");
      if (pList[0])
        pList[0].innerHTML = `<strong>info@ambuloproperties.com</strong>`;
      if (pList[1])
        pList[1].innerHTML = `<span>We respond within 24 hours</span>`;
    }

    if (h4.textContent.includes("Office Location")) {
      const icon =
        h4.parentElement.parentElement.querySelector(".contact-icon");
      if (icon) icon.innerHTML = `<i class="fa-solid fa-location-dot"></i>`;
      const pList = h4.parentElement.querySelectorAll("p");
      if (pList[0]) pList[0].innerHTML = `<strong>Kapt. Sayas Street</strong>`;
      if (pList[1])
        pList[1].innerHTML = `<span>Silang, Cavite, Philippines</span>`;
    }

    if (h4.textContent.includes("Business Hours")) {
      const icon =
        h4.parentElement.parentElement.querySelector(".contact-icon");
      if (icon) icon.innerHTML = `<i class="fa-solid fa-clock"></i>`;
      const pList = h4.parentElement.querySelectorAll("p");
      if (pList[0])
        pList[0].innerHTML = `<span>Monday - Friday: 9:00 AM - 6:00 PM</span>`;
      if (pList[1])
        pList[1].innerHTML = `<span>Saturday: 9:00 AM - 4:00 PM</span>`;
      if (pList[2]) pList[2].innerHTML = `<span>Sunday: Closed</span>`;
    }
  });
}

async function fetchAndRenderContactFAQs() {
  try {
    const faqs = await fetchFaqs();

    if (!faqs || !faqs.length) {
      console.warn("No FAQs returned");
      document.getElementById("faq-container").innerHTML =
        "<div style='color: #e53e3e; padding: 16px;'>Unable to load FAQs at this time.</div>";
      return;
    }
    const faqContainer = document.getElementById("faq-container");
    faqContainer.innerHTML = "";
    faqs
      .filter((faq) => String(faq.is_active) === "1")
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((faq, idx) => {
        const faqHtml = `
        <div class=\"faq-item reveal-element\" style=\"transition-delay: ${
          0.1 + idx * 0.1
        }s;\">\n          <div class=\"faq-question\">\n            <h4>${escapeHtml(
          faq.question
        )}</h4>\n            <span class=\"faq-icon\">▼</span>\n          </div>\n          <div class=\"faq-answer\">\n            <p></br>${escapeHtml(
          faq.answer
        )}</p>\n          </div>\n        </div>\n      `;
        faqContainer.insertAdjacentHTML("beforeend", faqHtml);
      });
    attachFAQListeners();
  } catch (error) {
    console.error("Error fetching/rendering FAQs:", error);

    setFallbackFAQs();
  }
}

function setFallbackFAQs() {
  const fallbackFAQs = [
    {
      question: "What types of commercial spaces do you offer?",
      answer:
        "We offer a variety of commercial spaces including retail stores, office spaces, restaurant locations, and service business premises. Our properties range from small boutique spaces to larger commercial units.",
    },
    {
      question: "What is the typical lease term for commercial properties?",
      answer:
        "Our standard lease terms are typically 2-5 years for commercial properties. We also offer flexible terms depending on your business needs and the specific property.",
    },
    {
      question: "Do you provide parking facilities?",
      answer:
        "Yes, most of our commercial properties include dedicated parking spaces. The number of parking spaces varies by property and will be specified in the lease agreement.",
    },
    {
      question: "How do I schedule a property viewing?",
      answer:
        "You can schedule a viewing by filling out our contact form, calling our office, or sending us an email. We'll arrange a convenient time for you to visit the property with one of our leasing specialists.",
    },
  ];

  const faqContainer = document.getElementById("faq-container");
  faqContainer.innerHTML = "";

  fallbackFAQs.forEach((faq, idx) => {
    const faqHtml = `
      <div class="faq-item reveal-element" style="transition-delay: ${
        0.1 + idx * 0.1
      }s;">
        <div class="faq-question">
          <h4>${escapeHtml(faq.question)}</h4>
          <span class="faq-icon">▼</span>
        </div>
        <div class="faq-answer">
          <p>${escapeHtml(faq.answer)}</p>
        </div>
      </div>
    `;
    faqContainer.insertAdjacentHTML("beforeend", faqHtml);
  });

  attachFAQListeners();
}

function attachFAQListeners() {
  document.querySelectorAll(".faq-question").forEach((question) => {
    question.addEventListener("click", () => {
      const faqItem = question.parentElement;
      const isActive = faqItem.classList.contains("active");

      document.querySelectorAll(".faq-item").forEach((item) => {
        item.classList.remove("active");
      });

      if (!isActive) {
        faqItem.classList.add("active");
      }
    });
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validateField(field) {
  const value = field.value.trim();
  const isRequired = field.hasAttribute("required");

  field.classList.remove("valid", "invalid");

  if (isRequired && !value) {
    field.classList.add("invalid");
    return false;
  }

  if (field.type === "email" && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      field.classList.add("invalid");
      return false;
    }
  }

  if (field.tagName === "SELECT") {
    if (isRequired && (!value || value === "")) {
      field.classList.add("invalid");
      return false;
    } else if (value && value !== "") {
      field.classList.add("valid");
      return true;
    }
  }

  if (value) {
    field.classList.add("valid");
  }

  return true;
}

function showNotification(message, type = "info") {
  let container = document.getElementById("notification-stack");
  if (!container) {
    container = document.createElement("div");
    container.id = "notification-stack";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "10000";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";
    document.body.appendChild(container);
  }

  while (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fa-solid ${getNotificationIcon(type)}"></i>
      <span>${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
  `;

  if (!document.getElementById("notification-styles")) {
    const styles = document.createElement("style");
    styles.id = "notification-styles";
    styles.textContent = `
      .notification {
        position: relative;
        padding: 16px 20px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        transform: translateX(400px);
        transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        max-width: 400px;
        backdrop-filter: blur(10px);
        margin-bottom: 0;
      }
      .notification.show {
        transform: translateX(0);
      }
      .notification-success {
        background: linear-gradient(135deg, #10b981, #059669);
      }
      .notification-error {
        background: linear-gradient(135deg, #ef4444, #dc2626);
      }
      .notification-info {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      }
      .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        margin-left: auto;
        opacity: 0.8;
        transition: opacity 0.3s ease;
      }
      .notification-close:hover {
        opacity: 1;
      }
    `;
    document.head.appendChild(styles);
  }

  container.appendChild(notification);

  setTimeout(() => notification.classList.add("show"), 100);

  setTimeout(() => {
    notification.style.transform = "translateX(400px)";
    setTimeout(() => notification.remove(), 400);
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    info: "fa-info-circle",
  };
  return icons[type] || icons.info;
}

function resetFloatingLabels() {}

function addMicroAnimations() {
  document.querySelectorAll(".contact-item-box").forEach((item, index) => {
    item.addEventListener("mouseenter", function () {
      this.style.transform = "translateX(15px) translateY(-5px) scale(1.02)";
      this.style.background = "rgba(255, 255, 255, 0.15)";
    });

    item.addEventListener("mouseleave", function () {
      this.style.transform = "";
      this.style.background = "";
    });
  });

  const messageTextarea = document.getElementById("message");
  let typingTimer;

  messageTextarea.addEventListener("input", function () {
    clearTimeout(typingTimer);
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";

    this.style.borderColor = "#3b82f6";

    typingTimer = setTimeout(() => {
      this.style.borderColor = "";
    }, 1000);
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".navbar");
    if (navbar) {
      const scrolled = window.pageYOffset;
      if (scrolled > 100) {
        navbar.style.background = "rgba(255, 255, 255, 0.98)";
        navbar.style.backdropFilter = "blur(20px)";
        navbar.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.1)";
      } else {
        navbar.style.background = "rgba(255, 255, 255, 0.95)";
        navbar.style.backdropFilter = "blur(15px)";
        navbar.style.boxShadow = "";
      }
    }
  });
}

const enhancedStyles = document.createElement("style");
enhancedStyles.textContent = `
  .form-group input.valid, 
  .form-group textarea.valid, 
  .form-group select.valid {
    border-color: #10b981 !important;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1) !important;
  }
  
  .form-group input.invalid, 
  .form-group textarea.invalid, 
  .form-group select.invalid {
    border-color: #ef4444 !important;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    animation: shake 0.5s ease-in-out;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }

  .form-group.focused input,
  .form-group.focused textarea,
  .form-group.focused select {
    transform: translateY(-2px);
  }

  .stagger-animate {
    animation: slideInUp 0.6s ease both;
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Additional label positioning fixes */
  .form-group select:focus + label,
  .form-group.has-value select + label {
    top: -8px !important;
    left: 16px !important;
    font-size: 12px !important;
    color: #3b82f6 !important;
    font-weight: 700 !important;
    background: white !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
  }

  .form-group input:not(:placeholder-shown) + label,
  .form-group textarea:not(:placeholder-shown) + label {
    top: -8px !important;
    left: 16px !important;
    font-size: 12px !important;
    color: #3b82f6 !important;
    font-weight: 700 !important;
    background: white !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
  }
`;
document.head.appendChild(enhancedStyles);

/**
 * Map frontend form fields to backend column names expected by the API
 * @param {Object} fields
 * @returns {Object} payload
 */
function mapFormToPayload(fields = {}) {
  return {
    first_name: fields.firstName || "",
    last_name: fields.lastName || "",
    email: fields.email || "",
    phone_number: fields.phone || "",
    subject: fields.subject || "",
    business_type: fields.businessType || "",
    preferred_space_size: fields.spaceSize || "",
    monthly_budget_range: fields.budget || "",
    message: fields.message || "",
  };
}

/**
 * Submit mapped contact payload to backend API.
 * Throws on non-2xx responses.
 * @param {Object} payload
 */
async function submitContactForm(payload = {}) {
  const url = `${API_BASE_URL}/contact-us/create-contact`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`Invalid JSON response from server (status ${res.status})`);
  }

  if (!res.ok) {
    const msg =
      data && data.message ? data.message : `Server error (${res.status})`;
    throw new Error(msg);
  }

  return data;
}
