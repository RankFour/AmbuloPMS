let leaseTerms = [];

let editingId = null;
let deleteId = null;
const API_BASE_URL = "api/v1/lease-defaults";

document.addEventListener("DOMContentLoaded", function () {
    populateLeaseTermsTable();
});

async function fetchLeaseDefaults() {
    try {
        const res = await fetch(`${API_BASE_URL}`);
        if (!res.ok) throw new Error("Failed to fetch lease defaults");
        const data = await res.json();
        return data;
    } catch (err) {
        console.error(err);
        return {};
    }
}

async function populateLeaseTermsTable() {
    const apiResponse = await fetchLeaseDefaults();
    const defaults = apiResponse.defaults || {};
    leaseTerms = Object.entries(defaults).map(([key, obj], idx) => {
        let data_type = "text";
        if (key.endsWith("_percentage")) {
            data_type = "percentage";
        } else if (key.includes("months") || key.includes("days")) {
            data_type = "number";
        } else if (
            obj.value === "1" ||
            obj.value === "0" ||
            obj.value === true ||
            obj.value === false
        ) {
            data_type = "boolean";
        } else if (!isNaN(obj.value) && obj.value !== "") {
            data_type = "number";
        }
        return {
            id: obj.setting_id,
            setting_key: key,
            setting_value: obj.value,
            data_type,
            description: obj.description || "",
        };
    });
    renderLeaseTermsTable();
}

function renderLeaseTermsTable() {
    const container = document.getElementById("lease-terms-container");

    if (leaseTerms.length === 0) {
        container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-contract"></i>
                        <h3>No Lease Terms Configured</h3>
                        <p>Get started by adding your first lease term setting.</p>
                        <button class="btn btn-primary" onclick="addNewLeaseTerm()">
                            <i class="fas fa-plus"></i>
                            Add First Lease Term
                        </button>
                    </div>
                `;
        return;
    }

    container.innerHTML = `
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Setting Key</th>
                                <th>Value</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${leaseTerms
            .map(
                (term) => `
                                <tr>
                                    <td>
                                        <div class="setting-key">${formatSettingKey(
                    term.setting_key
                )}</div>
                                        
                                    </td>
                                    <td>
                                        <span class="setting-value">${formatValue(
                    term.setting_value,
                    term.data_type
                )}</span>
                                    </td>
                                    <td>
                                        <span class="data-type-badge data-type-${term.data_type
                    }">${term.data_type}</span>
                                    </td>
                                    <td class="description-cell">${term.description
                    }</td>
                                    <td class="actions-cell">
                                        <button class="btn btn-primary btn-small" onclick="editLeaseTerm(${term.id
                    })">
                                            <i class="fas fa-edit"></i>
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            `
            )
            .join("")}
                        </tbody>
                    </table>
                </div>
            `;
}

function formatSettingKey(key) {
    if (!key) return "";

    const keyMap = {
        security_deposit_months: ["Security Deposit", "Months"],
        advance_payment_months: ["Advance Payment", "Months"],
        payment_frequency: ["Payment Frequency", ""],
        lease_term_months: ["Lease Term", "Months"],
        quarterly_tax_percentage: ["Quarterly Tax", "Percentage"],
        late_fee_percentage: ["Late Fee", "Percentage"],
        grace_period_days: ["Grace Period", "Days"],
        auto_termination_after_months: ["Auto Termination After", "Months"],
        termination_trigger_days: ["Termination Trigger", "Days"],
        advance_payment_forfeited_on_cancel: [
            "Advance Payment Forfeited On Cancel",
            "",
        ],
        is_security_deposit_refundable: ["Security Deposit (if Refundable)", ""],
        notice_before_cancel_days: ["Notice Before Cancel", "Days"],
        notice_before_renewal_days: ["Notice Before Renewal", "Days"],
        rent_increase_on_renewal_percentage: [
            "Rent Increase On Renewal",
            "Percentage",
        ],
    };

    if (keyMap[key]) {
        const [label, unit] = keyMap[key];
        return unit ? `${label} (${unit})` : label;
    }
    return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatValue(value, dataType) {
    switch (dataType) {
        case "percentage":
            return value + "%";
        case "boolean":
            return value === "1" || value === true ? "Yes" : "No";
        case "number":
            return !isNaN(value) && value !== ""
                ? Number(value).toLocaleString()
                : value;
        default:
            return value;
    }
}

function switchTab(tabName) {
    document
        .querySelectorAll(".tab-button")
        .forEach((btn) => btn.classList.remove("active"));
    document
        .querySelectorAll(".tab-content")
        .forEach((content) => content.classList.remove("active"));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");
}

function editLeaseTerm(id) {
    const term = leaseTerms.find((t) => t.id === id);
    if (!term) return;

    editingId = term.id;
    document.getElementById("modal-title").textContent = "Edit Lease Term";
    const keyInput = document.getElementById("setting_key");
    keyInput.value = term.setting_key;
    keyInput.setAttribute("readonly", "readonly");
    keyInput.style.backgroundColor = "#e5e7eb";
    keyInput.style.color = "#6b7280";

    const typeInput = document.getElementById("data_type");
    typeInput.value = term.data_type;
    typeInput.setAttribute("disabled", "disabled");
    typeInput.style.backgroundColor = "#e5e7eb";
    typeInput.style.color = "#6b7280";

    document.getElementById("setting_value").value = term.setting_value;
    document.getElementById("description").value = term.description;
    clearFormErrors();
    document.getElementById("lease-term-modal").classList.add("show");
}

function deleteLeaseTerm(id) {
    deleteId = id;
    document.getElementById("delete-modal").classList.add("show");
}

function confirmDelete() {
    if (deleteId) {
        leaseTerms = leaseTerms.filter((term) => term.id !== deleteId);
        renderLeaseTermsTable();
        closeDeleteModal();
        showNotification("Lease term deleted successfully!", "success");
        deleteId = null;
    }
}

function closeModal() {
    document.getElementById("lease-term-modal").classList.remove("show");
    clearFormErrors();
}

function closeDeleteModal() {
    document.getElementById("delete-modal").classList.remove("show");
    deleteId = null;
}

function clearFormErrors() {
    document
        .querySelectorAll(".field-error")
        .forEach((error) => (error.textContent = ""));
    document
        .querySelectorAll(".form-input")
        .forEach((input) => input.classList.remove("error"));
}

function validateForm() {
    let isValid = true;
    clearFormErrors();

    const settingKey = document.getElementById("setting_key").value.trim();
    const settingValue = document.getElementById("setting_value").value.trim();
    const description = document.getElementById("description").value.trim();

    if (!settingKey) {
        document.getElementById("setting_key_error").textContent =
            "Setting key is required";
        document.getElementById("setting_key").classList.add("error");
        isValid = false;
    } else if (!/^[a-z_]+$/.test(settingKey)) {
        document.getElementById("setting_key_error").textContent =
            "Setting key must contain only lowercase letters and underscores";
        document.getElementById("setting_key").classList.add("error");
        isValid = false;
    } else {
        const existingTerm = leaseTerms.find(
            (term) => term.setting_key === settingKey && term.id !== editingId
        );
        if (existingTerm) {
            document.getElementById("setting_key_error").textContent =
                "Setting key already exists";
            document.getElementById("setting_key").classList.add("error");
            isValid = false;
        }
    }

    if (!settingValue) {
        document.getElementById("setting_value_error").textContent =
            "Setting value is required";
        document.getElementById("setting_value").classList.add("error");
        isValid = false;
    }

    if (!description) {
        document.getElementById("description_error").textContent =
            "Description is required";
        document.getElementById("description").classList.add("error");
        isValid = false;
    }

    return isValid;
}

function validateForm() {
    let isValid = true;
    clearFormErrors();

    const settingKey = document.getElementById("setting_key").value.trim();
    const settingValue = document.getElementById("setting_value").value.trim();
    const dataType = document.getElementById("data_type").value;
    const description = document.getElementById("description").value.trim();

    if (!settingKey) {
        document.getElementById("setting_key_error").textContent =
            "Setting key is required";
        document.getElementById("setting_key").classList.add("error");
        isValid = false;
    } else if (!/^[a-z_]+$/.test(settingKey)) {
        document.getElementById("setting_key_error").textContent =
            "Setting key must contain only lowercase letters and underscores";
        document.getElementById("setting_key").classList.add("error");
        isValid = false;
    }

    if (!settingValue) {
        document.getElementById("setting_value_error").textContent =
            "Setting value is required";
        document.getElementById("setting_value").classList.add("error");
        isValid = false;
    } else {
        if (
            ["number", "months", "days", "percentage"].includes(dataType) ||
            settingKey.endsWith("_months") ||
            settingKey.endsWith("_days") ||
            settingKey.endsWith("_percentage")
        ) {
            if (isNaN(settingValue)) {
                document.getElementById("setting_value_error").textContent =
                    "Value must be a number";
                document.getElementById("setting_value").classList.add("error");
                isValid = false;
            }
        } else if (
            dataType === "boolean" ||
            settingKey.startsWith("is_") ||
            settingKey.endsWith("_forfeited_on_cancel")
        ) {
            if (!(settingValue === "0" || settingValue === "1")) {
                document.getElementById("setting_value_error").textContent =
                    "Boolean value must be 0 or 1";
                document.getElementById("setting_value").classList.add("error");
                isValid = false;
            }
        }
    }

    if (!description) {
        document.getElementById("description_error").textContent =
            "Description is required";
        document.getElementById("description").classList.add("error");
        isValid = false;
    }

    return isValid;
}

document
    .getElementById("lease-term-form")
    .addEventListener("submit", async function (e) {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const formData = {
            setting_id: editingId,
            setting_value: document.getElementById("setting_value").value.trim(),
            description: document.getElementById("description").value.trim(),
        };

        try {
            await fetch(`${API_BASE_URL}/${formData.setting_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    settingValue: formData.setting_value,
                    description: formData.description,
                }),
            });
            showNotification("Lease term updated successfully!", "success");
        } catch (err) {
            showNotification("Failed to update lease term!", "error");
        }

        if (editingId) {
            const index = leaseTerms.findIndex((term) => term.id === editingId);
            if (index !== -1) {
                leaseTerms[index] = { ...leaseTerms[index], ...formData };
            }
        } else {
            const newId = Math.max(...leaseTerms.map((t) => t.id), 0) + 1;
            leaseTerms.push({ id: newId, ...formData });
        }

        renderLeaseTermsTable();
        closeModal();
    });

function showNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerHTML = `
                <i class="fas fa-${type === "success" ? "check" : "exclamation-triangle"
        }"></i>
                ${message}
            `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add("show"), 100);

    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = "/contentManagement.html";
    }
}

document.addEventListener("click", function (e) {
    if (e.target.classList.contains("modal")) {
        if (e.target.id === "lease-term-modal") {
            closeModal();
        } else if (e.target.id === "delete-modal") {
            closeDeleteModal();
        }
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        closeModal();
        closeDeleteModal();
    }
});
