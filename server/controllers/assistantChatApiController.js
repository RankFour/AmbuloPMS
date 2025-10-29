import * as chatSvc from "../services/botpressChatClient.js";

function isChatConfigured() {
    return !!(
        process.env.BP_CHAT_WEBHOOK_ID || process.env.BOTPRESS_CHAT_WEBHOOK_ID
    );
}

function getSvc() {
    const backendPref = (process.env.BP_ASSISTANT_BACKEND || "").toLowerCase();
    if (backendPref === "chat" && isChatConfigured()) return chatSvc;

    if (isChatConfigured()) return chatSvc;
    const e = new Error("No Botpress API configured");
    e.code = "NOT_CONFIGURED";
    throw e;
}

export async function openConversation(req, res) {
    try {
        const svc = getSvc();
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const { conversationId } = await svc.ensureConversation(String(userId));
        return res.json({ conversationId });
    } catch (e) {
        const status = e.code === "NOT_CONFIGURED" ? 501 : 500;
        return res
            .status(status)
            .json({ message: e.message || "Failed to open conversation" });
    }
}

export async function send(req, res) {
    try {
        const svc = getSvc();
        const userId = req.user?.user_id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const { conversationId, text } = req.body || {};
        const convId =
            conversationId ||
            (await svc.ensureConversation(String(userId))).conversationId;
        await svc.sendTextMessage(String(userId), convId, text);
        return res.status(202).json({ ok: true, conversationId: convId });
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
        const status = e.code === "NOT_CONFIGURED" ? 501 : 400;
        return res
            .status(status)
            .json({ message: e.message || "Failed to list messages" });
    }
}

export default { openConversation, send, history };
