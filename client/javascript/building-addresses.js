import fetchCompanyDetails from "../api/loadCompanyInfo.js";

const API_BASE_URL = "/api/v1";
const contactData = {
  buildings: [],
};

async function setDynamicInfo() {
  const company = await fetchCompanyDetails();
  if (!company) return;

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && company.icon_logo_url) {
    favicon.href = company.icon_logo_url;
  }

  document.title = company.company_name
    ? `Manage Building Addresses - ${company.company_name}`
    : "Manage Building Addresses";
}

document.addEventListener("DOMContentLoaded", () => {
  setDynamicInfo();
});

async function fetchAddresses() {
  try {
    const response = await fetch(`${API_BASE_URL}/addresses`);
    if (!response.ok) throw new Error("Failed to fetch addresses");
    const data = await response.json();

    const addresses = Array.isArray(data.addresses) ? data.addresses : [];

    if (!Array.isArray(addresses)) throw new Error("Addresses is not an array");

    contactData.buildings = addresses.map((addr) => ({
      id: `building-${addr.address_id}`,
      address_id: addr.address_id,
      building_name: addr.building_name || "",
      street: addr.street || "",
      barangay: addr.barangay || "",
      city: addr.city || "",
      province: addr.province || "",
      postal_code: addr.postal_code || "",
      country: addr.country || "Philippines",
      latitude: addr.latitude || "",
      longitude: addr.longitude || "",
      status: "active",
      collapsed: true,
      editMode: false,
    }));

    renderBuildings();
  } catch (error) {
    showNotification("Could not load addresses from database.", "error");
    console.error(error);
  }
}
document.addEventListener("DOMContentLoaded", function () {
  fetchAddresses();

  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));
  document.querySelector('[data-tab="buildings"]').classList.add("active");
  document.getElementById("buildings-tab").classList.add("active");

  document
    .getElementById("preview-modal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        closeModal();
      }
    });
});

function renderBuildings() {
  const container = document.getElementById("buildings-container");
  container.innerHTML = "";

  contactData.buildings.forEach((building, index) => {
    if (typeof building.editMode === "undefined") building.editMode = false;
    if (typeof building.collapsed === "undefined") building.collapsed = true;

    const collapsed = building.collapsed ? "collapsed" : "";
    const cardId = `building-card-${building.id}`;
    const detailsId = `building-details-${building.id}`;
    const toggleIcon = building.collapsed ? "fa-chevron-down" : "fa-chevron-up";
    const isEditable = building.editMode ? "" : "readonly";

    let actionButtons = "";
    if (building.isNew) {
      actionButtons = `
        <button class="btn btn-success btn-small" style="margin-right: 8px;" onclick="saveBuilding('${building.id}')">
          <i class="fas fa-save"></i> Save
        </button>
      `;
    } else if (building.editMode) {
      actionButtons = `
        <button class="btn btn-success btn-small" style="margin-right: 8px;" onclick="saveBuilding('${building.id}')">
          <i class="fas fa-save"></i> Save
        </button>
        <button class="btn btn-secondary btn-small" onclick="cancelEditBuilding('${building.id}')">
          <i class="fas fa-times"></i> Cancel
        </button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-primary btn-small" onclick="editBuilding('${building.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
      `;
    }

    const buildingHTML = `
      <div class="building-card ${collapsed}" id="${cardId}" data-building-id="${building.id
      }" style="margin-bottom: 18px;">
        <div class="building-header" style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center;">
            <button class="btn btn-danger btn-small" style="margin-right: 12px;" onclick="removeBuilding('${building.id
      }')">
              <i class="fas fa-trash"></i>
            </button>
            <div class="building-title" style="display: flex; align-items: center;">
              <i class="fas fa-building" style="color: #3b82f6; margin-right: 8px;"></i>
              <span>${building.building_name || "New Address"}</span>
              <span class="status-badge ${building.status
      }" style="margin-left: 12px;">
                ${building.status.charAt(0).toUpperCase() +
      building.status.slice(1)
      }
              </span>
            </div>
          </div>
          <div>
            <button class="btn btn-light btn-small" onclick="toggleBuildingDetails('${building.id
      }')">
              <i class="fas ${toggleIcon}"></i>
            </button>
          </div>
        </div>
        <div class="building-details" id="${detailsId}" style="padding-top: 10px; ${building.collapsed ? "display:none;" : ""
      }">
          <div class="form-row" style="display: flex; gap: 2%;">
            <div class="form-group" style="flex: 2;">
              <label class="form-label">Building Name</label>
              <input type="text" class="form-input" value="${building.building_name
      }" 
                ${isEditable}
                maxlength="100">
            </div>
            <div class="form-group" style="flex: 3;">
              <label class="form-label">Street</label>
              <input type="text" class="form-input" value="${building.street}" 
                ${isEditable}
                maxlength="255">
            </div>
          </div>
          <div class="form-row" style="display: flex; gap: 2%;">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Barangay</label>
              <input type="text" class="form-input" value="${building.barangay
      }" 
                ${isEditable}
                maxlength="100">
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">City</label>
              <input type="text" class="form-input" value="${building.city}" 
                ${isEditable}
                maxlength="100">
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Province</label>
              <input type="text" class="form-input" value="${building.province
      }" 
                ${isEditable}
                maxlength="100">
            </div>
          </div>
          <div class="form-row" style="display: flex; gap: 2%;">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Postal Code</label>
              <input type="text" class="form-input" value="${building.postal_code
      }" 
                ${isEditable}
                maxlength="20" pattern="^[0-9\\-]+$">
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Country</label>
              <input type="text" class="form-input" value="${building.country}" 
                ${isEditable}
                maxlength="100">
            </div>
          </div>
          <div class="form-row" style="display: flex; gap: 2%;">
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Latitude</label>
              <input type="number" class="form-input" value="${building.latitude
      }" 
                ${isEditable}
                step="0.000001" min="-90" max="90">
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Longitude</label>
              <input type="number" class="form-input" value="${building.longitude
      }" 
                ${isEditable}
                step="0.000001" min="-180" max="180">
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 18px;">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
    container.innerHTML += buildingHTML;

    if (building.editMode) {
      setTimeout(() => {
        const card = document.getElementById(cardId);
        if (!card) return;
        const fields = [
          "building_name",
          "street",
          "barangay",
          "city",
          "province",
          "postal_code",
          "country",
          "latitude",
          "longitude",
        ];
        fields.forEach((field, idx) => {
          const input = card.querySelectorAll("input")[idx];
          if (input) {
            let errorEl = input.nextElementSibling;
            if (!errorEl || !errorEl.classList.contains("field-error")) {
              errorEl = document.createElement("div");
              errorEl.className = "field-error";
              errorEl.style.color = "#ef4444";
              errorEl.style.fontSize = "12px";
              errorEl.style.marginTop = "2px";
              input.parentNode.appendChild(errorEl);
            }

            input.oninput = (e) => {
              building[field] = e.target.value;

              const errors = validateBuildingFields(building);
              errorEl.textContent = errors[field] || "";
            };

            const errors = validateBuildingFields(building);
            errorEl.textContent = errors[field] || "";
          }
        });
      }, 0);
    }
  });
}

async function saveBuilding(buildingId) {
  const building = contactData.buildings.find((b) => b.id === buildingId);
  if (!building) return;

  const errors = validateBuildingFields(building);
  if (Object.keys(errors).length > 0) {
    showNotification("Please fix the errors before saving.", "error");
    renderBuildings();
    return;
  }

  const payload = {
    building_name: building.building_name,
    street: building.street,
    barangay: building.barangay,
    city: building.city,
    province: building.province,
    postal_code: building.postal_code,
    country: building.country,
    latitude:
      building.latitude === "" ||
        building.latitude === null ||
        building.latitude === undefined
        ? null
        : Number(building.latitude),
    longitude:
      building.longitude === "" ||
        building.longitude === null ||
        building.longitude === undefined
        ? null
        : Number(building.longitude),
  };

  try {
    if (building.isNew) {
      const response = await fetch(`${API_BASE_URL}/addresses/create-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to create address");
      const result = await response.json();

      building.address_id = result.address_id;
      building.id = `building-${result.address_id}`;
      delete building.isNew;
      showNotification("Address created!", "success");
    } else {
      if (!building.address_id || isNaN(Number(building.address_id))) {
        showNotification("Invalid address_id. Cannot update.", "error");
        return;
      }
      const response = await fetch(
        `${API_BASE_URL}/addresses/${building.address_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error("Failed to update address");
      showNotification("Address updated!", "success");
    }
    building.editMode = false;
    delete building._backup;
    renderBuildings();
  } catch (error) {
    showNotification(error.message || "Failed to save address", "error");
    console.error(error);
  }
}

function editBuilding(buildingId) {
  const building = contactData.buildings.find((b) => b.id === buildingId);
  if (building) {
    building._backup = { ...building };
    building.editMode = true;
    renderBuildings();
  }
}

function cancelEditBuilding(buildingId) {
  const building = contactData.buildings.find((b) => b.id === buildingId);
  if (building && building._backup) {
    Object.assign(building, building._backup);
    delete building._backup;
    building.editMode = false;
    renderBuildings();
  }
}

function toggleBuildingDetails(buildingId) {
  contactData.buildings.forEach((b) => {
    b.collapsed = b.id !== buildingId;
  });
  renderBuildings();
}

function addNewBuildingCard() {
  contactData.buildings.forEach((b) => (b.collapsed = true));

  const newBuilding = {
    id: `building-${Date.now()}`,
    building_name: "",
    street: "",
    barangay: "",
    city: "",
    province: "",
    postal_code: "",
    country: "Philippines",
    latitude: "",
    longitude: "",
    status: "active",
    collapsed: false,
    editMode: true,
    isNew: true,
  };

  contactData.buildings.unshift(newBuilding);
  renderBuildings();
  showNotification("New address card added!", "success");
}

async function removeBuilding(buildingId) {
  const building = contactData.buildings.find((b) => b.id === buildingId);
  if (!building) return;

  const confirmFn =
    typeof window !== "undefined" && typeof window.showConfirm === "function"
      ? (msg, title) => window.showConfirm(msg, title)
      : (msg) => Promise.resolve(confirm(String(msg)));
  const ok = !!(await confirmFn(
    "Are you sure you want to remove this building and all its contacts?",
    "Confirm remove"
  ));
  if (!ok) return;
  try {
    if (building.isNew) {
      contactData.buildings = contactData.buildings.filter(
        (b) => b.id !== buildingId
      );
      showNotification("Unsaved address removed.", "success");
    } else {
      if (!building.address_id || isNaN(Number(building.address_id))) {
        showNotification("Invalid address_id. Cannot delete.", "error");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/addresses/${Number(building.address_id)}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to delete address");
      contactData.buildings = contactData.buildings.filter(
        (b) => b.id !== buildingId
      );
      showNotification("Building removed successfully!", "success");
    }
    renderBuildings();
  } catch (error) {
    showNotification(error.message || "Failed to delete address", "error");
    console.error(error);
  }
}

function previewBuildings() {
  let previewHTML = '<div style="display: grid; gap: 20px;">';

  contactData.buildings.forEach((building) => {
    previewHTML += `
                    <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb;">
                        <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <h4 style="color: #1e293b; margin: 0 0 5px 0;">${building.name
      }</h4>
                                <span style="background: #eff6ff; color: #3b82f6; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: 600;">${building.type
      }</span>
                            </div>
                            <span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: white; background: ${building.status === "active"
        ? "#10b981"
        : "#6b7280"
      };">
                                ${building.status.charAt(0).toUpperCase() +
      building.status.slice(1)
      }
                            </span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <div style="color: #64748b; font-size: 14px; line-height: 1.5;">
                                <i class="fas fa-map-marker-alt" style="color: #3b82f6; margin-right: 8px;"></i>
                                ${building.address}
                            </div>
                        </div>
                        ${building.contacts.length > 0
        ? `
                            <div>
                                <h5 style="color: #374151; margin: 0 0 10px 0; font-size: 14px;">Contact Persons:</h5>
                                ${building.contacts
          .map(
            (contact) => `
                                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${contact.name}</div>
                                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${contact.position}</div>
                                        <div style="font-size: 12px; color: #64748b;">
                                            <i class="fas fa-phone" style="margin-right: 5px;"></i>${contact.phone} | 
                                            <i class="fas fa-envelope" style="margin-left: 8px; margin-right: 5px;"></i>${contact.email}
                                        </div>
                                    </div>
                                `
          )
          .join("")}
                            </div>
                        `
        : '<p style="color: #9ca3af; font-style: italic; font-size: 14px;">No contact persons added</p>'
      }
                    </div>
                `;
  });

  previewHTML += "</div>";
  showModal("Building Addresses & Contacts Preview", previewHTML);
}

function showModal(title, content) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("preview-content").innerHTML = content;
  document.getElementById("preview-modal").classList.add("show");
}

function closeModal() {
  document.getElementById("preview-modal").classList.remove("show");
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  const icons = {
    success: "check-circle",
    error: "exclamation-triangle",
    info: "info-circle",
  };

  notification.innerHTML = `
                <i class="fas fa-${icons[type]}"></i>
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
  }, 4000);
}

document.addEventListener("DOMContentLoaded", function () {
  renderBuildings();

  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));
  document.querySelector('[data-tab="buildings"]').classList.add("active");
  document.getElementById("buildings-tab").classList.add("active");

  document
    .getElementById("preview-modal")
    .addEventListener("click", function (e) {
      if (e.target === this) {
        closeModal();
      }
    });
});

function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showNotification("Copied to clipboard!", "success");
    })
    .catch(() => {
      showNotification("Failed to copy to clipboard", "error");
    });
}

function showAddressModal() {
  document.getElementById("address-modal").classList.add("show");
  document.body.style.overflow = "hidden";
  populateAddressForm({});
  document
    .querySelectorAll(".field-error")
    .forEach((el) => (el.textContent = ""));
}

function closeAddressModal() {
  document.getElementById("address-modal").classList.remove("show");
  document.body.style.overflow = "auto";
}

function populateAddressForm(address) {
  document.getElementById("building_name").value = address.building_name ?? "";
  document.getElementById("street").value = address.street ?? "";
  document.getElementById("barangay").value = address.barangay ?? "";
  document.getElementById("city").value = address.city ?? "";
  document.getElementById("province").value = address.province ?? "";
  document.getElementById("postal_code").value = address.postal_code ?? "";
  document.getElementById("country").value = address.country ?? "Philippines";
  document.getElementById("latitude").value = address.latitude ?? "";
  document.getElementById("longitude").value = address.longitude ?? "";
}

function validateBuildingFields(building) {
  const errors = {};

  if (!building.building_name || building.building_name.trim().length === 0) {
    errors.building_name = "Building name is required.";
  } else if (building.building_name.length > 100) {
    errors.building_name = "Max 100 characters.";
  }

  if (!building.street || building.street.trim().length === 0) {
    errors.street = "Street is required.";
  } else if (building.street.length > 255) {
    errors.street = "Max 255 characters.";
  }

  if (!building.barangay || building.barangay.trim().length === 0) {
    errors.barangay = "Barangay is required.";
  } else if (building.barangay.length > 100) {
    errors.barangay = "Max 100 characters.";
  }

  if (!building.city || building.city.trim().length === 0) {
    errors.city = "City is required.";
  } else if (building.city.length > 100) {
    errors.city = "Max 100 characters.";
  }

  if (!building.province || building.province.trim().length === 0) {
    errors.province = "Province is required.";
  } else if (building.province.length > 100) {
    errors.province = "Max 100 characters.";
  }

  if (!building.postal_code || building.postal_code.trim().length === 0) {
    errors.postal_code = "Postal code is required.";
  } else if (building.postal_code.length > 20) {
    errors.postal_code = "Max 20 characters.";
  } else if (!/^[0-9\-]+$/.test(building.postal_code)) {
    errors.postal_code = "Numbers and dash only.";
  }

  if (!building.country || building.country.trim().length === 0) {
    errors.country = "Country is required.";
  } else if (building.country.length > 100) {
    errors.country = "Max 100 characters.";
  }

  if (
    building.latitude !== "" &&
    building.latitude !== null &&
    building.latitude !== undefined
  ) {
    const lat = parseFloat(building.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = "Latitude must be between -90 and 90.";
    }
  }

  if (
    building.longitude !== "" &&
    building.longitude !== null &&
    building.longitude !== undefined
  ) {
    const lng = parseFloat(building.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.longitude = "Longitude must be between -180 and 180.";
    }
  }

  return errors;
}

window.toggleBuildingDetails = toggleBuildingDetails;
window.addNewBuildingCard = addNewBuildingCard;
window.removeBuilding = removeBuilding;
window.editBuilding = editBuilding;
window.cancelEditBuilding = cancelEditBuilding;
window.saveBuilding = saveBuilding;
window.previewBuildings = previewBuildings;
window.showAddressModal = showAddressModal;
window.closeAddressModal = closeAddressModal;
window.copyToClipboard = copyToClipboard;
