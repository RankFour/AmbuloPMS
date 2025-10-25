(function () {
    function escapeHtml(text) {
        if (text == null) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function _showAlertFallback(message, type) {
        const colors = {
            success: "#10b981",
            error: "#ef4444",
            warning: "#f59e0b",
            info: "#3b82f6",
        };
        const icons = {
            success: "check-circle",
            error: "exclamation-triangle",
            warning: "exclamation-circle",
            info: "info-circle",
        };
        const existing = document.querySelectorAll(".alert-notification");
        existing.forEach((a) => a.remove());
        const el = document.createElement("div");
        el.className = "alert-notification";
        el.style.background = colors[type] || colors.info;
        el.style.color = "#fff";
        el.style.padding = "10px 16px";
        el.style.position = "fixed";
        el.style.right = "16px";
        el.style.top = "16px";
        el.style.borderRadius = "8px";
        el.style.zIndex = 11000;
        el.innerHTML = `<i class="fas fa-${icons[type] || icons.info
            }" style="margin-right:8px"></i> ${escapeHtml(message)}`;
        document.body.appendChild(el);
        setTimeout(() => {
            if (el.parentNode) el.remove();
        }, 3500);
    }

    function showAlert(message, type = "info") {
        try {
            if (
                typeof Modal !== "undefined" &&
                Modal &&
                typeof Modal.open === "function"
            ) {
                const titleMap = {
                    success: "Success",
                    error: "Error",
                    warning: "Warning",
                    info: "Info",
                };
                const variantMap = {
                    success: "success",
                    info: "default",
                    warning: "warning",
                    error: "error",
                };
                const showFooter = type === "error" || type === "warning";
                Modal.open({
                    title: titleMap[type] || titleMap.info,
                    body: `<div style="white-space:pre-wrap;">${escapeHtml(
                        String(message)
                    )}</div>`,
                    showFooter,
                    showCancel: false,
                    confirmText: "OK",
                    variant: variantMap[type] || "default",
                    autoCloseDuration: showFooter ? 0 : 3500,
                    onConfirm: () => { },
                });
                if (!showFooter) {
                    setTimeout(() => {
                        try {
                            Modal.close();
                        } catch (e) { }
                    }, 3000);
                }
                return;
            }
        } catch (e) {
            console.warn("Modal.showAlert failed, falling back", e);
        }
        _showAlertFallback(message, type);
    }

    function showConfirm(message, title = "Confirm") {
        return new Promise((resolve) => {
            try {
                if (
                    typeof Modal !== "undefined" &&
                    Modal &&
                    typeof Modal.open === "function"
                ) {
                    Modal.open({
                        title,
                        body: `<div style="white-space:pre-wrap;">${escapeHtml(
                            String(message)
                        )}</div>`,
                        showFooter: true,
                        showCancel: true,
                        confirmText: "Yes",
                        cancelText: "Cancel",
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false),
                    });
                    return;
                }
            } catch (e) {
                console.warn("Modal.showConfirm failed, falling back", e);
            }
            resolve(confirm(String(message)));
        });
    }

    function showPrompt(message, placeholder = "", title = "Input") {
        return new Promise((resolve) => {
            try {
                if (
                    typeof Modal !== "undefined" &&
                    Modal &&
                    typeof Modal.open === "function"
                ) {
                    const inputId = `modal-prompt-${Date.now()}`;
                    const inputHtml = `<div style="display:flex;flex-direction:column;gap:8px;"><label style="font-weight:600;">${escapeHtml(
                        String(message)
                    )}</label><input id="${inputId}" type="text" placeholder="${escapeHtml(
                        placeholder
                    )}" style="padding:8px;border:1px solid #e5e7eb;border-radius:6px;" /></div>`;
                    Modal.open({
                        title,
                        body: inputHtml,
                        showFooter: true,
                        showCancel: true,
                        confirmText: "OK",
                        cancelText: "Cancel",
                        onConfirm: () => {
                            const el = document.getElementById(inputId);
                            if (!el) return resolve("");
                            resolve(el.value);
                        },
                        onCancel: () => resolve(null),
                    });
                    return;
                }
            } catch (e) {
                console.warn("Modal.showPrompt failed, falling back", e);
            }
            const res = prompt(String(message));
            if (res === null) resolve(null);
            else resolve(String(res));
        });
    }

    if (typeof window !== "undefined") {
        try {
            window.showAlert = showAlert;
            window.showConfirm = showConfirm;
            window.showPrompt = showPrompt;
            window.ModalHelpers = { showAlert, showConfirm, showPrompt };

            console.debug("ModalHelpers registered on window");
        } catch (e) {
            console.warn("Failed to attach ModalHelpers to window", e);
        }
    }

    try {
        if (typeof module !== "undefined")
            module.exports = { showAlert, showConfirm, showPrompt };
    } catch (e) { }
})();
