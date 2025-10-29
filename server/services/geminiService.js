import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

let genAI = null;
function getClient() {
  if (!apiKey) return null;
  if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

export function isConfigured() {
  return Boolean(getClient());
}

function getModel() {
  const client = getClient();
  if (!client) return null;
  return client.getGenerativeModel({ model: modelName });
}

export async function generateText({ text, system = null, context = null } = {}) {
  const model = getModel();
  if (!model) return null;
  const parts = [];
  if (system) parts.push(`System: ${system}`);
  if (context) parts.push(`Context: ${typeof context === 'string' ? context : JSON.stringify(context)}`);
  parts.push(`User: ${text}`);
  const prompt = parts.join("\n\n");
  const res = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  const out = res?.response?.text?.() || res?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return (typeof out === 'function' ? out() : out) || "";
}

const intentSchema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: { type: SchemaType.STRING, description: "intent name in snake_case" },
    confidence: { type: SchemaType.NUMBER },
    params: { type: SchemaType.OBJECT },
  },
  required: ["intent", "confidence", "params"],
};

const SYSTEM_INTENT = [
  "You are an NLU that extracts intents for a property management system.",
  "Supported intents (with common params):",
  "- show_profile",
  "- show_lease",
  "- show_payments { status?: paid|pending|overdue|all }",
  "- list_faqs",
  "- create_ticket { title, description }",
  "- list_tickets { status?: pending|assigned|in_progress|completed|all }",
  "- search_tenants { query }",
  "- list_overdue_charges",
  "- list_due_soon_charges",
  "- list_pending_payments",
  "- confirm_payment { payment_id }",
  "- reject_payment { payment_id }",
  "- create_charge { lease_id, amount, description }",
  "- list_properties",
  "- company_info",
  "- help",
  "Return strictly JSON with fields: intent, confidence (0-1), params (object).",
].join(" \n");

export async function extractIntent({ text, role = null } = {}) {
  const model = getModel();
  if (!model) return null;
  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: intentSchema,
    temperature: 0.2,
  };
  const payloadParts = [
    { text: SYSTEM_INTENT },
    { text: `User role: ${role || 'TENANT'}` },
    { text: `Utterance: ${text}` },
  ];
  const res = await model.generateContent({
    contents: [{ role: "user", parts: payloadParts }],
    generationConfig,
  });
  const raw = res?.response?.text?.() || "";
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (obj && typeof obj === 'object' && obj.intent) return obj;
  } catch {}
  return null;
}

export default { isConfigured, generateText, extractIntent };
