import * as localAssistant from "../services/localAssistantService.js";
import assistantMessages from "../services/assistantMessagesService.js";

function getSvc() {
    // Botpress removed; always use local assistant (with optional Gemini if configured)
    return localAssistant;
}

export async function openConversation(req, res) {
    try {
        const svc = getSvc();
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const { conversationId } = await svc.ensureConversation(String(userId));
        // Seed an auto-greeting if this conversation has no messages yet
        try {
            await svc.seedGreetingIfEmpty(String(userId), conversationId, req.user?.role);
        } catch (greetErr) {
            if (process.env.NODE_ENV !== 'production') console.warn('[assistant] greeting seed failed:', greetErr?.message || greetErr);
        }
        return res.json({ conversationId });
    } catch (e) {
        const msg = String(e?.message || "");
        let status = 500;
        if (e.code === "NOT_CONFIGURED") status = 501;
        else if (/invalid user key/i.test(msg)) status = 401; 
        return res.status(status).json({ message: msg || "Failed to open conversation" });
    }
}

export async function send(req, res) {
    try {
        const svc = getSvc();
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const { conversationId, text, tmpId } = req.body || {};
        const convId =
            conversationId ||
            (await svc.ensureConversation(String(userId))).conversationId;
        await svc.sendTextMessage(String(userId), convId, text, { role: req.user?.role, tmpId });
        return res.status(202).json({ ok: true, conversationId: convId, tmpId: tmpId || null });
    } catch (e) {
        return res
            .status(400)
            .json({ message: e.message || "Failed to send message" });
    }
}

export async function history(req, res) {
    try {
        const svc = getSvc();
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const { conversationId, limit } = req.query || {};
        const result = await svc.listMessages(
            String(userId),
            conversationId,
            Number(limit) || 30
        );
        return res.json(result);
    } catch (e) {
        const msg = String(e?.message || "");
        let status = 400;
        if (e.code === "NOT_CONFIGURED") status = 501;
        else if (/invalid user key/i.test(msg)) status = 401;
        return res.status(status).json({ message: msg || "Failed to list messages" });
    }
}

export async function clear(req, res) {
    try {
        const svc = getSvc();
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const { conversationId } = await svc.ensureConversation(String(userId));
        await assistantMessages.clearConversation(conversationId);
        // Reseed greeting after clearing
        await svc.seedGreetingIfEmpty(String(userId), conversationId, req.user?.role);
        return res.json({ ok: true, conversationId });
    } catch (e) {
        return res.status(500).json({ message: e.message || 'Failed to clear chat' });
    }
}

export default { openConversation, send, history, clear };
