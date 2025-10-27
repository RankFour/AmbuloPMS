(function () {
    const API_BASE = window.API_BASE || `${location.origin}/api`;
    const API_VERSION =
        window.API_VERSION || (window.env && window.env.API_VERSION) || "v1";
    const base = `${API_BASE}/${API_VERSION}`;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.async = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function getJwtToken() {
        try {
            return (
                window.JWT_TOKEN ||
                (document.cookie.match(/(?:^|; )token=([^;]+)/) || [])[1] ||
                null
            );
        } catch {
            return null;
        }
    }

    function sendJwtToBotpress(retries = 20, delayMs = 250) {
        const jwt = getJwtToken();
        if (!jwt) return;

        function attempt(n) {
            const api = window.botpressWebChat || window.botpress;
            const canSend = api && typeof api.sendEvent === "function";
            if (canSend) {
                try {
                    api.sendEvent({ type: "custom", payload: { jwt } });
                } catch {}
                return;
            }
            if (n > 0) setTimeout(() => attempt(n - 1), delayMs);
        }
        attempt(retries);
    }

    async function initWebchat(claims) {
        try {
            const scriptUrl =
                window.BOTPRESS_WEBCHAT_SCRIPT_URL || window.BOTPRESS_WEBCHAT_URL;
            const config = window.BOTPRESS_WEBCHAT_CONFIG || null;
            const initFn = window.BOTPRESS_WEBCHAT_INIT || null;

            const hasEmbeddedBotpress = !!(
                window.botpressWebChat ||
                document.querySelector(
                    'script[src*="cdn.botpress.cloud/webchat"],script[src*="bpcontent.cloud"]'
                )
            );

            if (!scriptUrl && !initFn) {
                if (hasEmbeddedBotpress) {
                    sendJwtToBotpress();
                    return;
                }
                createFallbackWebchat(claims);
                return;
            }

            const composerPlaceholder =
                claims && claims.display_name
                    ? `Message Ambulo Assistant as ${claims.display_name}…`
                    : "Message Ambulo Assistant…";

            if (typeof initFn === "function") {
                try {
                    initFn({ claims, baseUrl: base, composerPlaceholder });
                } catch { }
                return;
            }

            await loadScript(scriptUrl);

            const initConfig = Object.assign({}, config || {}, {
                composerPlaceholder:
                    (config && config.composerPlaceholder) || composerPlaceholder,
            });

            if (
                window.botpressWebChat &&
                typeof window.botpressWebChat.init === "function"
            ) {
                window.botpressWebChat.init(initConfig);
                try {
                    sendJwtToBotpress();
                    if (typeof window.botpressWebChat.onEvent === "function") {
                        window.botpressWebChat.onEvent((ev) => {
                            const t = (ev && ev.type) || "";
                            if (
                                t === "webchat:ready" ||
                                t === "LIFECYCLE.READY" ||
                                t === "LIFECYCLE.LOADED"
                            ) {
                                sendJwtToBotpress();
                            }
                        });
                    }
                } catch {}
            } else {
                createFallbackWebchat(claims);
            }
        } catch (e) {
            console.warn("webchat init failed:", e);
            try {
                createFallbackWebchat(claims);
            } catch { }
        }
    }

    async function initAssistantSession() {
        try {
            const token =
                window.JWT_TOKEN ||
                (document.cookie.match(/(?:^|; )token=([^;]+)/) || [])[1];
            const res = await fetch(`${base}/assistant/session/init`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to init assistant");
            return await res.json();
        } catch (e) {
            console.error("assistant init failed:", e);
            return null;
        }
    }

    async function bootstrap() {
        const session = await initAssistantSession();
        window.ASSISTANT_CLAIMS = session && session.claims;

        await initWebchat(window.ASSISTANT_CLAIMS);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }

    // -------- Webchat Fallback (lightweight) --------
    function createEl(tag, attrs = {}, children = []) {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (k === "class") el.className = v;
            else if (k === "style") Object.assign(el.style, v);
            else el.setAttribute(k, v);
        });
        (Array.isArray(children) ? children : [children]).forEach((c) => {
            if (typeof c === "string") el.appendChild(document.createTextNode(c));
            else if (c) el.appendChild(c);
        });
        return el;
    }

    function createFallbackWebchat(claims) {
        const root = createEl("div", { id: "assistant-fallback-chat" });
        const toggle = createEl(
            "button",
            { id: "assistant-fallback-toggle", title: "Open Assistant" },
            ["💬"]
        );
        const panel = createEl("div", { id: "assistant-fallback-panel" });
        const header = createEl("div", { class: "afc-header" }, [
            createEl("span", { class: "afc-title" }, ["Ambulo Assistant"]),
            createEl("button", { class: "afc-close", title: "Close" }, ["×"]),
        ]);
        const body = createEl("div", { class: "afc-body" });
        const list = createEl("div", { class: "afc-messages" });
        const form = createEl("form", { class: "afc-form" });
        const input = createEl("input", {
            class: "afc-input",
            type: "text",
            placeholder:
                claims && claims.display_name
                    ? `Message as ${claims.display_name}…`
                    : "Type a message…",
        });
        const send = createEl("button", { class: "afc-send", type: "submit" }, [
            "Send",
        ]);
        form.appendChild(input);
        form.appendChild(send);
        panel.appendChild(header);
        panel.appendChild(body);
        body.appendChild(list);
        body.appendChild(form);
        root.appendChild(toggle);
        root.appendChild(panel);
        document.body.appendChild(root);

        const style = document.createElement("style");
        style.textContent = `
          #assistant-fallback-chat { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
          #assistant-fallback-toggle { width: 48px; height: 48px; border-radius: 50%; border: none; background: #1f2937; color: #fff; font-size: 22px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
          #assistant-fallback-panel { display: none; width: 340px; height: 440px; background: #fff; border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.25); overflow: hidden; }
          #assistant-fallback-panel.open { display: flex; flex-direction: column; }
          .afc-header { background: #111827; color: #fff; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; }
          .afc-title { font-weight: 600; }
          .afc-close { background: transparent; border: none; color: #fff; font-size: 20px; cursor: pointer; }
          .afc-body { display: flex; flex-direction: column; height: 100%; }
          .afc-messages { flex: 1; overflow-y: auto; padding: 12px; background: #f9fafb; }
          .afc-msg { max-width: 80%; margin: 6px 0; padding: 8px 10px; border-radius: 10px; line-height: 1.3; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
          .me { background: #dbeafe; color: #111827; margin-left: auto; border-bottom-right-radius: 0; }
          .other { background: #e5e7eb; color: #111827; margin-right: auto; border-bottom-left-radius: 0; }
          .afc-form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid #e5e7eb; }
          .afc-input { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; }
          .afc-send { background: #111827; color: #fff; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
        `;
        document.head.appendChild(style);

        function addMessageBubble(text, mine) {
            const bubble = createEl(
                "div",
                { class: `afc-msg ${mine ? "me" : "other"}` },
                [String(text || "")]
            );
            list.appendChild(bubble);
            list.scrollTop = list.scrollHeight;
        }

        toggle.addEventListener("click", () => {
            panel.classList.add("open");
        });
        header.querySelector(".afc-close").addEventListener("click", () => {
            panel.classList.remove("open");
        });

        let otherUserId = window.ASSISTANT_SUPPORT_USER_ID || null;
        async function loadRecent() {
            try {
                if (!otherUserId) return;
                const token =
                    window.JWT_TOKEN ||
                    (document.cookie.match(/(?:^|; )token=([^;]+)/) || [])[1];
                const url = new URL(`${base}/assistant/me/messages`, location.origin);
                url.searchParams.set("other_user_id", otherUserId);
                url.searchParams.set("limit", "20");
                const res = await fetch(url, {
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    credentials: "include",
                });
                if (!res.ok) return;
                const data = await res.json();
                (data.messages || []).forEach((m) =>
                    addMessageBubble(
                        m.message,
                        String(m.sender_user_id) ===
                        String((claims && claims.user_id) || "")
                    )
                );
            } catch { }
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const text = (input.value || "").trim();
            if (!text) return;
            addMessageBubble(text, true);
            input.value = "";
            try {
                if (!otherUserId) return;
                const token =
                    window.JWT_TOKEN ||
                    (document.cookie.match(/(?:^|; )token=([^;]+)/) || [])[1];
                await fetch(`${base}/assistant/me/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    credentials: "include",
                    body: JSON.stringify({ other_user_id: otherUserId, message: text }),
                });
            } catch { }
        });

        loadRecent();
    }
})();
