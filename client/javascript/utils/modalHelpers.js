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
                typeof Modal.open === "function" &&
                typeof document !== "undefined" &&
                document.getElementById("globalModal")
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
                    typeof Modal.open === "function" &&
                    typeof document !== "undefined" &&
                    document.getElementById("globalModal")
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
                console.warn(
                    "Modal.showConfirm failed, falling back to in-page confirm",
                    e
                );
            }

            try {
                const overlay = document.createElement("div");
                overlay.className = "modal-overlay";
                overlay.classList.add("active");
                overlay.style.zIndex = 12000;

                const container = document.createElement("div");
                container.className = "modal-container";

                const header = document.createElement("div");
                header.className = "modal-header";
                const titleNode = document.createElement("div");
                titleNode.className = "modal-title";
                const titleText = document.createElement("span");
                titleText.className = "modal-title-text";
                titleText.textContent = String(title || "Confirm");
                titleNode.appendChild(titleText);
                header.appendChild(titleNode);

                const body = document.createElement("div");
                body.className = "modal-body";
                body.style.padding = "16px 22px";
                body.textContent = String(message || "");

                const footer = document.createElement("div");
                footer.className = "modal-footer";

                const cancelBtn = document.createElement("button");
                cancelBtn.className = "btn-cancel";
                cancelBtn.textContent = "Cancel";
                cancelBtn.onclick = () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(false);
                };

                const okBtn = document.createElement("button");
                okBtn.className = "btn-confirm";
                okBtn.textContent = "OK";
                okBtn.onclick = () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(true);
                };

                footer.appendChild(cancelBtn);
                footer.appendChild(okBtn);
                container.appendChild(header);
                container.appendChild(body);
                container.appendChild(footer);
                overlay.appendChild(container);
                (document.body || document.documentElement).appendChild(overlay);
                setTimeout(() => {
                    try {
                        okBtn.focus();
                    } catch (e) { }
                }, 20);
                return;
            } catch (e) {
                try {
                    resolve(confirm(String(message)));
                } catch (_) {
                    resolve(false);
                }
            }
        });
    }

    function showPrompt(
        message,
        placeholder = "",
        title = "Input",
        inputType = "text"
    ) {
        return new Promise((resolve) => {
            try {
                if (
                    typeof Modal !== "undefined" &&
                    Modal &&
                    typeof Modal.open === "function" &&
                    typeof document !== "undefined" &&
                    document.getElementById("globalModal")
                ) {
                    const inputId = `modal-prompt-${Date.now()}`;

                    const safeType = inputType === "password" ? "password" : "text";
                    const inputName = `modal-prompt-name-${Date.now()}`;
                    const autoAttr = safeType === "password" ? "new-password" : "off";
                    const inputHtml = `<div style="display:flex;flex-direction:column;gap:8px;"><label style="font-weight:600;">${escapeHtml(
                        String(message)
                    )}</label><input id="${inputId}" name="${inputName}" autocomplete="${autoAttr}" autocorrect="off" autocapitalize="off" spellcheck="false" type="${safeType}" placeholder="${escapeHtml(
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

            if (typeof inputType !== "undefined" && inputType === "password") {
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
                label.textContent = String(message);

                const input = document.createElement("input");
                input.type = "password";
                input.name = `modal-fallback-pw-${Date.now()}`;
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
                return;
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
