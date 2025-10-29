import gemini from "../services/geminiService.js";

const assistantGeminiController = {
  async status(req, res) {
    try {
      const ok = gemini.isConfigured();
      res.json({ ok, model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
    } catch (e) {
      res.status(500).json({ ok: false, message: e?.message || String(e) });
    }
  },

  async generate(req, res) {
    try {
      const { text, system, context } = req.body || {};
      if (!text) return res.status(400).json({ ok: false, message: "text is required" });
      const out = await gemini.generateText({ text, system, context });
      res.json({ ok: true, text: out || "" });
    } catch (e) {
      res.status(500).json({ ok: false, message: e?.message || String(e) });
    }
  },

  async intent(req, res) {
    try {
      const { text } = req.body || {};
      const role = req.user?.role || null;
      if (!text) return res.status(400).json({ ok: false, message: "text is required" });
      const out = await gemini.extractIntent({ text, role });
      res.json({ ok: true, intent: out });
    } catch (e) {
      res.status(500).json({ ok: false, message: e?.message || String(e) });
    }
  },
};

export default assistantGeminiController;
