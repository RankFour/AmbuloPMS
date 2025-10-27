(function () {
    const API_BASE = window.API_BASE || `${location.origin}/api`;
    const API_VERSION = window.API_VERSION || "v1";
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

    function sendJwtToBotpress() {
        const jwt = getJwtToken();
        if (!jwt) return console.warn("⚠️ No JWT found");

        const sendNow = () => {
            try {
                console.log("✅ Sending JWT to Botpress:", jwt);
                window.botpressWebChat.sendEvent({
                    type: "jwtToken",
                    payload: { jwt },
                });
            } catch (err) {
                console.error("❌ Failed to send JWT:", err);
            }
        };

        const checkReady = setInterval(() => {
            if (window.botpressWebChat && typeof window.botpressWebChat.sendEvent === "function") {
                clearInterval(checkReady);
                sendNow();
            }
        }, 500);
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

        const scriptUrl =
            window.BOTPRESS_WEBCHAT_SCRIPT_URL ||
            "https://files.bpcontent.cloud/2025/10/20/20/20251020204110-KI06VUC7.js";

        await loadScript(scriptUrl);
        console.log("✅ Botpress script loaded, initializing bot...");

        if (window.botpress && typeof window.botpress.init === "function") {
            window.botpress.init({
                botId: "6c967958-d7da-42b1-aac0-6f3a8cb36cbf",
                clientId: "f066f9b1-575b-48b8-8d22-d03caddf7906",
                configuration: {
                    version: "v2",
                    composerPlaceholder: "Talk to Ambulo Assistant...",
                    botName: "Ambulo Assistant",
                    botAvatar:
                        "https://files.bpcontent.cloud/2025/10/20/21/20251020212727-A4OBVVD4.png",
                    color: "#6366f1",
                    themeMode: "light",
                    feedbackEnabled: true,
                },
            });

            if (window.botpressWebChat && typeof window.botpressWebChat.init === "function") {
                console.log("✅ Botpress Webchat (v3) detected — initializing...");
                window.botpressWebChat.init({
                    botId: "6c967958-d7da-42b1-aac0-6f3a8cb36cbf",
                    clientId: "f066f9b1-575b-48b8-8d22-d03caddf7906",
                    composerPlaceholder: "Talk to Ambulo Assistant...",
                    theme: "light",
                });

                
                const interval = setInterval(() => {
                    if (document.querySelector('iframe[src*="botpress.cloud"]')) {
                        clearInterval(interval);
                        console.log("✅ Botpress iframe detected — sending JWT...");
                        sendJwtToBotpress();
                    }
                }, 1000);
            } else {
                console.warn("⚠️ window.botpressWebChat.init not available yet, retrying...");
                const retry = setInterval(() => {
                    if (window.botpressWebChat && typeof window.botpressWebChat.init === "function") {
                        clearInterval(retry);
                        console.log("✅ Retrying Botpress webchat init...");
                        window.botpressWebChat.init({
                            botId: "6c967958-d7da-42b1-aac0-6f3a8cb36cbf",
                            clientId: "f066f9b1-575b-48b8-8d22-d03caddf7906",
                            composerPlaceholder: "Talk to Ambulo Assistant...",
                            theme: "light",
                        });
                        sendJwtToBotpress();
                    }
                }, 1000);
            }


            sendJwtToBotpress();
        } else {
            console.error("❌ window.botpress.init() not found.");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
        bootstrap();
    }
})();
