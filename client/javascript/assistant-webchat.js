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

  
  async function sendJwtToBotpress() {
    const jwt = getJwtToken();
    if (!jwt) {
      console.warn("⚠️ No JWT found; skipping send.");
      return;
    }

    const waitForWebchatReady = async (maxRetries = 20, delay = 500) => {
      for (let i = 0; i < maxRetries; i++) {
        const iframeReady = !!document.querySelector('iframe[src*="botpress.cloud"]');
        const sdkReady = !!window.botpress?.initialized;

        if (iframeReady && sdkReady) {
          console.log("✅ Webchat iframe ready, sending JWT...");
          try {
            window.botpress.sendEvent({
              type: "custom",
              payload: { jwt },
            });
            console.log("✅ JWT sent to Botpress successfully!");
          } catch (err) {
            console.error("❌ Failed to send JWT:", err);
          }
          return true;
        }

        console.log(`⏳ Waiting for webchat... [${i + 1}/${maxRetries}]`);
        await new Promise((r) => setTimeout(r, delay));
      }

      console.warn("⚠️ Botpress webchat never became ready to receive JWT.");
      return false;
    };

    await waitForWebchatReady();
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

    const isV3 = typeof window.botpress?.init === "function";

    try {
      if (isV3) {
        
        window.botpress.init({
          botId: "6c967958-d7da-42b1-aac0-6f3a8cb36cbf",
          clientId: "f066f9b1-575b-48b8-8d22-d03caddf7906",
          configuration: {
            composerPlaceholder: "Talk to Ambulo Assistant...",
            botName: "Ambulo Assistant",
            botAvatar:
              "https://files.bpcontent.cloud/2025/10/20/21/20251020212727-A4OBVVD4.png",
            color: "#6366f1",
            themeMode: "light",
            feedbackEnabled: true,
          },
        });
        console.log("✅ Botpress webchat initialized (v3).");

        
        if (window.botpressWebChat && typeof window.botpressWebChat.init === "function") {
          window.botpressWebChat.init({
            botId: "6c967958-d7da-42b1-aac0-6f3a8cb36cbf",
            clientId: "f066f9b1-575b-48b8-8d22-d03caddf7906",
            composerPlaceholder: "Talk to Ambulo Assistant...",
            botName: "Ambulo Assistant",
            botAvatar:
              "https://files.bpcontent.cloud/2025/10/20/21/20251020212727-A4OBVVD4.png",
            theme: "light",
          });
          console.log("✅ window.botpressWebChat initialized manually!");
        } else {
          console.warn("⚠️ window.botpressWebChat not ready yet.");
        }
      } else if (window.botpress?.webchat?.init) {
        
        window.botpress.webchat.init({
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
        console.log("✅ Botpress webchat initialized (legacy).");
      } else {
        console.error("❌ Botpress init method not found.");
      }

      
      await new Promise((r) => setTimeout(r, 2500));
      await sendJwtToBotpress();
    } catch (err) {
      console.error("❌ Error initializing Botpress webchat:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
