import fetchCompanyDetails from "../api/loadCompanyInfo.js";
import { fetchFaqs, clearFaqsCache } from "../api/loadFaqs.js";

let faqIdCounter = 0;
let currentEditingId = null;
let latestFaqs = [];

let _modalIgnoreUntil = 0;
const API_BASE_URL = "/api/v1/faqs";

async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `Manage FAQs - ${company.company_name}`
    : "Manage FAQs";
}

document.addEventListener("DOMContentLoaded", () => {
  setDynamicInfo();
});

document.addEventListener("DOMContentLoaded", function () {
  fetchAndRenderFAQs();
  updateFAQCounter();

  document.documentElement.style.scrollBehavior = "smooth";
});

async function fetchAndRenderFAQs() {
  try {
    const res = await fetch(API_BASE_URL);
    const data = await res.json();
    const faqs = Array.isArray(data.message) ? data.message : [];
    latestFaqs = faqs;

    const faqList = document.getElementById("faq-list");
    faqList.innerHTML = "";

    faqs.forEach((faq) => {
      const isActive = String(faq.is_active) === "1";
      const activeBadge = isActive
        ? `<span class="faq-active-badge" style="background:#22c55e; color:#fff; font-size:12px; border-radius:6px; padding:2px 8px; margin-right:8px;">Active</span>`
        : `<span class="faq-active-badge" style="background:#64748b; color:#fff; font-size:12px; border-radius:6px; padding:2px 8px; margin-right:8px;">Inactive</span>`;

      const faqHtml = `
    <div class="faq-item" data-id="${faq.faq_id}" data-active="${
        faq.is_active
      }" data-sort-order="${faq.sort_order}">
      <div class="faq-question" onclick="toggleFAQ(this)">
        <h4 class="question-line" style="display: flex; align-items: center;">
          <span class="faq-sort-order" style="font-size: 0.95em; color: #64748b; margin-right: 10px;">
            <i class="fas fa-sort-numeric-down"></i> ${faq.sort_order}
          </span>
          ${activeBadge}
          ${escapeHtml(faq.question)}
        </h4>
        <span class="faq-icon">
          <i class="fas fa-chevron-down"></i>
        </span>
      </div>
      <div class="faq-answer">
        <p>${escapeHtml(faq.answer)}</p>
        <div class="action-buttons">
          <button class="btn btn-primary" onclick="editFAQ(${faq.faq_id})">
            <i class="fas fa-edit"></i>
            Edit
          </button>
          <button class="btn btn-danger" onclick="deleteFAQ(${
            faq.faq_id
          }, this)">
            <i class="fas fa-trash"></i>
            Delete
          </button>
        </div>
      </div>
    </div>
  `;
      faqList.insertAdjacentHTML("beforeend", faqHtml);
    });

    faqIdCounter =
      faqs.length > 0 ? Math.max(...faqs.map((f) => f.faq_id)) + 1 : 1;
    updateFAQCounter();
  } catch (err) {
    showNotification("Failed to load FAQs from server.", "error");
    try {
      const faqs = await fetchFaqs();
      latestFaqs = faqs;

      const faqList = document.getElementById("faq-list");
      faqList.innerHTML = "";

      faqs.forEach((faq) => {
        const isActive = String(faq.is_active) === "1";
        const activeBadge = isActive
          ? `<span class=\"faq-active-badge\" style=\"background:#22c55e; color:#fff; font-size:12px; border-radius:6px; padding:2px 8px; margin-right:8px;\">Active</span>`
          : `<span class=\"faq-active-badge\" style=\"background:#64748b; color:#fff; font-size:12px; border-radius:6px; padding:2px 8px; margin-right:8px;\">Inactive</span>`;

        const faqHtml = `
      <div class=\"faq-item\" data-id=\"${faq.faq_id}\" data-active=\"${
          faq.is_active
        }\" data-sort-order=\"${
          faq.sort_order
        }\">\n      <div class=\"faq-question\" onclick=\"toggleFAQ(this)\">\n        <h4 style=\"display: flex; align-items: center;\">\n          <span class=\"faq-sort-order\" style=\"font-size: 0.95em; color: #64748b; margin-right: 10px;\">\n            <i class=\"fas fa-sort-numeric-down\"></i> ${
          faq.sort_order
        }\n          </span>\n          ${activeBadge}\n          ${escapeHtml(
          faq.question
        )}\n        </h4>\n        <span class=\"faq-icon\">\n          <i class=\"fas fa-chevron-down\"></i>\n        </span>\n      </div>\n      <div class=\"faq-answer\">\n        <p>${escapeHtml(
          faq.answer
        )}</p>\n        <div class=\"action-buttons\">\n          <button class=\"btn btn-primary\" onclick=\"editFAQ(${
          faq.faq_id
        })\">\n            <i class=\"fas fa-edit\"></i>\n            Edit\n          </button>\n          <button class=\"btn btn-danger\" onclick=\"deleteFAQ(${
          faq.faq_id
        }, this)\">\n            <i class=\"fas fa-trash\"></i>\n            Delete\n          </button>\n        </div>\n      </div>\n    </div>\n  `;
        faqList.insertAdjacentHTML("beforeend", faqHtml);
      });

      faqIdCounter =
        faqs.length > 0 ? Math.max(...faqs.map((f) => f.faq_id)) + 1 : 1;
      updateFAQCounter();
    } catch (err) {
      showNotification("Failed to load FAQs from server.", "error");
      console.error(err);
    }
  }
}

function toggleFAQ(element) {
  const faqItem = element.closest(".faq-item");
  const isOpen = faqItem.classList.contains("open");

  document.querySelectorAll(".faq-item").forEach((item) => {
    item.classList.remove("open");
  });

  if (!isOpen) {
    faqItem.classList.add("open");
  }
}
function addFAQ() {
  currentEditingId = null;
  const faqTitleEl = document.getElementById("faqModalTitle");
  if (faqTitleEl) faqTitleEl.textContent = "Add New FAQ";

  document.getElementById("faqQuestion").value = "";
  document.getElementById("faqAnswer").value = "";
  document.getElementById("editingFAQId").value = "";

  document
  
    .getElementById("faqQuestion")
    .parentElement.parentElement.classList.add("full-width");
  document
    .getElementById("faqAnswer")
    .parentElement.parentElement.classList.add("full-width");
  document.getElementById("editingFAQId").value = "";

  let combinedRow = document.getElementById("faqStatusSortRow");
  if (combinedRow) combinedRow.remove();

  combinedRow = document.createElement("div");
  combinedRow.className = "form-row";
  combinedRow.id = "faqStatusSortRow";
  combinedRow.innerHTML = `
    <div class="form-group" style="width: 48%; display: inline-block; margin-right: 4%;">
      <label class="form-label">Public Page Visibility:</label>
      <select class="form-input" id="faqIsActive">
        <option value="1">Active</option>
        <option value="0">Inactive</option>
      </select>
    </div>
    <div class="form-group" style="width: 48%; display: inline-block;">
      <label class="form-label">Sort Order:</label>
      <input type="number" class="form-input" id="faqSortOrder" min="1" value="${faqIdCounter}">
    </div>
  `;
  document.getElementById("faqForm").appendChild(combinedRow);

  document.getElementById("faqIsActive").value = "1";
  document.getElementById("faqSortOrder").value = faqIdCounter;

  document.getElementById("saveFAQBtn").innerHTML =
    '<i class="fas fa-save"></i> Save FAQ';

  showModal("faqModal");
}

function editFAQ(id) {
  const faq = latestFaqs.find((f) => String(f.faq_id) === String(id));
  if (!faq) return;

  currentEditingId = id;
  const faqTitleEl = document.getElementById("faqModalTitle");
  if (faqTitleEl) faqTitleEl.textContent = "Edit FAQ";
  document.getElementById("faqQuestion").value = faq.question || "";
  document.getElementById("faqAnswer").value = faq.answer || "";
  document.getElementById("editingFAQId").value = id;

  document
    .getElementById("faqQuestion")
    .parentElement.parentElement.classList.add("full-width");
  document
    .getElementById("faqAnswer")
    .parentElement.parentElement.classList.add("full-width");

  let combinedRow = document.getElementById("faqStatusSortRow");
  if (combinedRow) combinedRow.remove();

  combinedRow = document.createElement("div");
  combinedRow.className = "form-row";
  combinedRow.id = "faqStatusSortRow";
  combinedRow.innerHTML = `
    <div class="form-group" style="width: 48%; display: inline-block; margin-right: 4%;">
      <label class="form-label">Public Page Visibility:</label>
      <select class="form-input" id="faqIsActive">
        <option value="1">Active</option>
        <option value="0">Inactive</option>
      </select>
    </div>
    <div class="form-group" style="width: 48%; display: inline-block;">
      <label class="form-label">Sort Order:</label>
      <input type="number" class="form-input" id="faqSortOrder" min="1" value="${faq.sort_order}">
    </div>
  `;
  document.getElementById("faqForm").appendChild(combinedRow);

  document.getElementById("faqIsActive").value = faq.is_active;
  document.getElementById("faqSortOrder").value = faq.sort_order;

  document.getElementById("saveFAQBtn").innerHTML =
    '<i class="fas fa-save"></i> Update FAQ';

  showModal("faqModal");
}

function saveFAQ() {
  const question = document.getElementById("faqQuestion").value.trim();
  const answer = document.getElementById("faqAnswer").value.trim();
  const sortOrder =
    parseInt(document.getElementById("faqSortOrder").value, 10) || faqIdCounter;
  const isActive = document.getElementById("faqIsActive").value;

  if (!question || !answer) {
    showNotification(
      "Please fill in both question and answer fields.",
      "error"
    );
    return;
  }

  if (currentEditingId) {
    updateExistingFAQ(currentEditingId, question, answer, sortOrder, isActive);
    showNotification("FAQ updated successfully!", "success");
  } else {
    createNewFAQ(question, answer, sortOrder, isActive);
    showNotification("New FAQ added successfully!", "success");
    updateFAQCounter();
  }

  closeFAQModal();
}

async function updateExistingFAQ(id, question, answer, sortOrder, isActive) {
  const faqData = {
    question,
    answer,
    sort_order: sortOrder,
    is_active: isActive,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(faqData),
    });
    if (!res.ok) throw new Error("Failed to update FAQ");
    clearFaqsCache();
    await fetchAndRenderFAQs();
  } catch (err) {
    showNotification("Error updating FAQ: " + err.message, "error");
  }
}

async function createNewFAQ(question, answer, sortOrder, isActive) {
  const faqData = {
    question,
    answer,
    sort_order: sortOrder,
    is_active: isActive,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/create-faq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(faqData),
    });
    if (!res.ok) throw new Error("Failed to save FAQ");
    clearFaqsCache();
    await fetchAndRenderFAQs();
  } catch (err) {
    showNotification("Error saving FAQ: " + err.message, "error");
  }
}

async function deleteFAQ(id, element) {
  const confirmFn = (typeof window !== 'undefined' && typeof window.showConfirm === 'function')
    ? ((msg, title) => window.showConfirm(msg, title))
    : (msg => Promise.resolve(confirm(String(msg))));

  const ok = !!(await confirmFn(
    "Are you sure you want to delete this FAQ? This action cannot be undone.",
    "Delete FAQ"
  ));
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE_URL}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete FAQ");
    clearFaqsCache();
    const faqItem = element.closest(".faq-item");
    if (faqItem) {
      faqItem.style.transform = "translateX(-100%)";
      faqItem.style.opacity = "0";
      setTimeout(() => {
        faqItem.remove();
        updateFAQCounter();
        showNotification("FAQ deleted successfully!", "success");
        fetchAndRenderFAQs();
      }, 300);
    }
  } catch (err) {
    showNotification("Error deleting FAQ: " + err.message, "error");
  }
}

function updateFAQCounter() {
  const count = document.querySelectorAll(".faq-item").length;
  document.getElementById("faqCountBadge").textContent = count;
}

function filterFAQs() {
  const searchTerm = document
    .getElementById("faqSearchInput")
    .value.toLowerCase();

  const filteredFaqs = latestFaqs
    .filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchTerm) ||
        faq.answer.toLowerCase().includes(searchTerm)
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  const faqList = document.getElementById("faq-list");
  faqList.innerHTML = "";

  filteredFaqs.forEach((faq) => {
    const faqHtml = `
      <div class="faq-item" data-id="${faq.faq_id}" data-active="${
      faq.is_active
    }" data-sort-order="${faq.sort_order}">
        <div class="faq-question" onclick="toggleFAQ(this)">
          <h4>${escapeHtml(faq.question)}</h4>
          <span class="faq-icon">
            <i class="fas fa-chevron-down"></i>
          </span>
        </div>
        <div class="faq-answer">
          <p>${escapeHtml(faq.answer)}</p>
          <div class="action-buttons">
            <button class="btn btn-primary" onclick="editFAQ(${faq.faq_id})">
              <i class="fas fa-edit"></i>
              Edit
            </button>
            <button class="btn btn-danger" onclick="deleteFAQ(${
              faq.faq_id
            }, this)">
              <i class="fas fa-trash"></i>
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
    faqList.insertAdjacentHTML("beforeend", faqHtml);
  });

  updateFAQCounter();
}













































function exportFAQ() {
  const faqData = {
    title: document.getElementById("faq-title")?.value || "",
    description: document.getElementById("faq-desc")?.value || "",
    faqs: [],
    exportDate: new Date().toISOString(),
  };

  latestFaqs.forEach((faq) => {
    faqData.faqs.push({
      id: faq.faq_id,
      question: faq.question,
      answer: faq.answer,
      is_active: faq.is_active,
      sort_order: faq.sort_order,
    });
  });

  const dataStr = JSON.stringify(faqData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "faq-content.json";
  link.click();

  showNotification("FAQ content exported successfully!", "success");
}

function importFAQ(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const imported = JSON.parse(event.target.result);
      if (!Array.isArray(imported.faqs)) {
        showNotification("Invalid FAQ file format.", "error");
        return;
      }
      let importedCount = 0;
      let failedCount = 0;
      const promises = imported.faqs.map((faq) =>
        fetch(`${API_BASE_URL}/create-faq`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: faq.question,
            answer: faq.answer,
            sort_order: faq.sort_order,
            is_active: faq.is_active,
          }),
        })
          .then((res) => {
            if (res.ok) importedCount++;
            else failedCount++;
          })
          .catch(() => {
            failedCount++;
          })
      );
      Promise.all(promises).then(() => {
        fetchAndRenderFAQs();
        showNotification(
          `Import complete: ${importedCount} added, ${failedCount} failed.`,
          failedCount === 0 ? "success" : "error"
        );
      });
    } catch (err) {
      showNotification("Failed to import FAQs: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}

document
  .getElementById("faqImportInput")
  .addEventListener("change", function (e) {
    importFAQ(e.target.files[0]);
  });

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.error(`[Modal Debug] Modal with id '${modalId}' not found.`);
    return;
  }
  
  _modalIgnoreUntil = Date.now() + 150;
  
  setTimeout(() => {
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
  }, 0);
}









function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.error(`[Modal Debug] Modal with id '${modalId}' not found.`);
    return;
  }
  modal.classList.remove("show");
  document.body.style.overflow = "auto";
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
                <i class="fas fa-${
                  type === "success"
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
    }, 400);
  }, 4500);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}


document.addEventListener("click", function (e) {
  
  if (Date.now() < _modalIgnoreUntil) return;
  if (e.target.classList.contains("modal-overlay")) {
    const modalId = e.target.id;
    hideModal(modalId);
  }
});

window.toggleFAQ = toggleFAQ;
window.addFAQ = addFAQ;
window.editFAQ = editFAQ;
window.deleteFAQ = deleteFAQ;
window.closeFAQModal = closeFAQModal;

window.saveFAQ = saveFAQ;
window.updateExistingFAQ = updateExistingFAQ;
window.createNewFAQ = createNewFAQ;
window.exportFAQ = exportFAQ;
window.filterFAQs = filterFAQs;

