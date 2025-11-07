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
                        body: `<div style="white-space:pre-wrap;">${escapeHtml(String(message))}</div>`,
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

            // Fallback lightweight overlay
            try {
                const overlay = document.createElement("div");
                overlay.className = "modal-overlay";
                overlay.classList.add("active");
                overlay.style.position = "fixed";
                overlay.style.inset = "0";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.background = "rgba(0,0,0,0.45)";
                overlay.style.backdropFilter = "blur(2px)";
                overlay.style.zIndex = 140000;
                overlay.style.pointerEvents = "auto";

                const container = document.createElement("div");
                container.className = "modal-container";
                container.style.background = "#fff";
                container.style.borderRadius = "12px";
                container.style.minWidth = "360px";
                container.style.maxWidth = "90%";
                container.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
                container.style.overflow = "hidden";
                container.style.pointerEvents = "auto";
                container.addEventListener('click', function(e){ e.stopPropagation(); });

                const header = document.createElement("div");
                header.className = "modal-header";
                header.style.padding = "14px 18px";
                header.style.borderBottom = "1px solid #e5e7eb";
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
                footer.style.display = "flex";
                footer.style.justifyContent = "flex-end";
                footer.style.gap = "10px";
                footer.style.padding = "12px 16px";
                footer.style.borderTop = "1px solid #e5e7eb";

                const cancelBtn = document.createElement("button");
                cancelBtn.className = "btn-cancel";
                cancelBtn.textContent = "Cancel";
                cancelBtn.style.cursor = "pointer";
                cancelBtn.style.background = "#f3f4f6";
                cancelBtn.style.border = "1px solid #e5e7eb";
                cancelBtn.style.borderRadius = "8px";
                cancelBtn.style.padding = "8px 14px";
                cancelBtn.onclick = () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(false);
                };

                const okBtn = document.createElement("button");
                okBtn.className = "btn-confirm";
                okBtn.textContent = "OK";
                okBtn.style.cursor = "pointer";
                okBtn.style.background = "#3b82f6";
                okBtn.style.color = "#fff";
                okBtn.style.border = "1px solid #2563eb";
                okBtn.style.borderRadius = "8px";
                okBtn.style.padding = "8px 14px";
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

                overlay.addEventListener('click', function(){
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(false);
                });

                (document.body || document.documentElement).appendChild(overlay);
                setTimeout(() => {
                    try { okBtn.focus(); } catch (e) { }
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
                    typeof Modal.open === "function"
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
                overlay.style.zIndex = 120000;
                overlay.style.pointerEvents = "auto";

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
                // clicking outside cancels
                overlay.addEventListener('click', function(){
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(null);
                });

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
