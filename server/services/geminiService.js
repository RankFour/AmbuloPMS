/* 
🧠 Copilot Setup Prompt: Chatbot Response Optimization

You are helping improve the quality, clarity, and accuracy of chatbot replies across ALL modules of the Ambulo Property Management System.

Focus areas:
1. **General Goal**  
   - Make every response clear, human-like, and contextually accurate.  
   - Use short, conversational sentences that sound natural.  
   - Keep tone polite, professional, and consistent across all topics.  

2. **Context Awareness**  
   - Understand queries related to:
     • Lease details (rent, duration, status)
     • Payment history 
     • Charges and due dates
     • Maintenance tickets or requests
     • User or tenant profiles
     • Property availability or unit 
     • Retrievel of document/file/info related to the above topics
   - Always reference the correct module or dataset based on user intent.

3. **Data Usage**  
   - Retrieve and display only necessary data (no raw JSON).  
   - When showing numbers or dates, format them clearly (e.g., “₱20,000” or “March 15, 2025”).  
   - Confirm database or API fields (like `rent_amount`, `lease_status`, `due_date`) are used correctly.

4. **Tone & Structure**  
   - Start with a direct answer.
   - Optionally follow with a short helpful suggestion (e.g., “Would you like to see your payment history?”).  
   - Avoid filler phrases or technical jargon.

5. **Fallbacks & Error Handling**  
   - If data is missing, respond with empathy and guidance (e.g., “I couldn’t find your lease details right now — please try again later.”).  
   - Never expose internal errors, tokens, or raw data.

6. **Consistency**  
   - Ensure all replies across different modules (lease, payments, maintenance, etc.) sound cohesive, as if written by one assistant personality.

When improving or suggesting code, focus on:
- Enhancing prompt wording for Gemini NLU accuracy
- Adjusting how responses are composed and formatted
- Maintaining lightweight, readable logic without over-engineering
*/


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

// --- Domain taxonomy to guide both intent extraction and downstream routing ---
export const DOMAIN_TAXONOMY = Object.freeze({
  payments: {
    description: "Amounts paid and payment records",
    keyFields: ["amount_paid", "payment_status", "method", "created_at"],
  },
  charges: {
    description: "Amounts owed/expected to be paid",
    keyFields: ["original_amount", "due_date", "canonical_status"],
  },
  leases: { description: "Lease contracts", keyFields: ["rent_amount", "lease_status", "lease_start_date", "lease_end_date"] },
  tickets: { description: "Maintenance tickets", keyFields: ["ticket_status", "request_type", "start_datetime", "end_datetime"] },
  properties: { description: "Properties and units", keyFields: ["property_id", "unit", "availability"] },
  profiles: { description: "User/Tenant profiles", keyFields: ["first_name", "last_name", "email", "phone"] },
  documents: { description: "Files/documents", keyFields: ["name", "uploaded_at", "type"] },
});

export async function generateText({ text, system = null, context = null } = {}) {
  const model = getModel();
  if (!model) return null;
  const parts = [];
  // Adaptive detail scaling hint: callers can inject context.detail_level or we infer simple heuristic
  const inferredDetail = computeDetailLevel(text);
  const sys = (system ? system : SYSTEM_RESPONSE_PROMPT) + `\n\nDetail level hint: ${inferredDetail}`;
  parts.push(`System: ${sys}`);
  if (context) parts.push(`Context: ${typeof context === 'string' ? context : JSON.stringify(context)}`);
  parts.push(`User: ${text}`);
  const prompt = parts.join("\n\n");
  const res = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  const out = res?.response?.text?.() || res?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return (typeof out === 'function' ? out() : out) || "";
}

function computeDetailLevel(utterance = "") {
  const q = String(utterance || '').toLowerCase();
  if (/show\s+all|list\s+all|everything|full\s+details|export|download/.test(q)) return 'full';
  if (/summary|brief|overview|quick/.test(q)) return 'summary';
  return 'minimal';
}

const intentSchema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: { type: SchemaType.STRING, description: "intent name in snake_case" },
    confidence: { type: SchemaType.NUMBER },
    domain: { type: SchemaType.STRING, description: "primary domain: charges|payments|leases|tickets|properties|profiles|documents|other" },
    detail_level: { type: SchemaType.STRING, description: "summary|minimal|full" },
    params: { type: SchemaType.OBJECT },
  },
  required: ["intent", "confidence", "params"],
};

const SYSTEM_INTENT = [
  "You are an NLU that extracts intents for a property management system.",
  "Be role-aware: TENANT queries are about their own data; ADMIN can reference any records.",
  "Domain taxonomy (do not conflate):",
  "- payments: money that has been paid (records like amount_paid, payment_status, method, created_at)",
  "- charges: money that is owed (records like original_amount, due_date, canonical_status)",
  "- leases: contract info (rent_amount, lease_status, dates)",
  "- tickets: maintenance requests (ticket_status, request_type)",
  "- properties: listings/units (availability, unit details)",
  "- profiles: tenant/user info",
  "- documents: files linked to users/leases/properties",
  "If the user asks about 'how much do I owe' -> domain=charges. If 'how much did I pay' -> domain=payments.",
  "Map phrases: 'unpaid', 'due', 'overdue' => charges. Phrases like 'paid', 'payment history', 'receipts' => payments.",
  "Set detail_level to 'full' when the question asks for lists or 'all', else 'summary'.",
  "Supported intents (with common params):",
  "- show_profile",
  "- show_lease",
  "- show_payments { status?: paid|pending|overdue|all }",
  "- list_faqs",
  "- create_ticket { title, description }",
  "- list_tickets { status?: pending|assigned|in_progress|completed|all }",
  "- search_tenants { query }",
  "- list_tenants { status?: active|inactive|all }",
  "- count_tenants { status?: active|inactive|all }",
  "- show_tenant { query, fields?: phone|email|profile|all }",
  "- list_tenants_outstanding_charges",
  "- search_properties { query }",
  "- list_overdue_charges",
  "- list_due_soon_charges",
  "- list_pending_payments",
  "- confirm_payment { payment_id }",
  "- reject_payment { payment_id }",
  "- create_charge { lease_id, amount, description }",
  "- list_properties",
  "- count_properties { status?: available|all }",
  "- show_user_documents",
  "- show_lease_documents { lease_id? }",
  "- show_ticket_documents { ticket_id }",
  "- show_invoice_documents { payment_id|invoice_id }",
  "- list_all_documents { scope?: users|leases|tickets|invoices|all }",
  "- company_info",
  "- help",
  "Return strictly JSON with fields: intent, confidence (0-1), params (object).",
].join(" \n");

// Chatbot response composition system prompt (distinct from intent extraction)
// Override with GEMINI_SYSTEM_RESPONSE env variable if present
const SYSTEM_RESPONSE_PROMPT = (process.env.GEMINI_SYSTEM_RESPONSE || [`
You are Ambulo Assistant — an intelligent, conversational AI inside a Property Management System (PMS).

You respond differently based on the user's role.

---
### 👤 TENANT MODE
When role = "TENANT":
- Assume the user is asking about their own account, leases, and payments.
- Respond only with data tied to their userId.
- Do not expose or mention other tenants.
- Use a friendly, helpful tone.
- Example:
  User: "What’s my rent?"
  → "Your monthly rent for Ground Floor Unit A is ₱20,000."

---
### 🧑‍💼 ADMIN MODE
When role = "ADMIN":
- The user is a staff or property manager.
- They can query *any tenant or system data*.
- Respond using a professional, summary style.
- Include multiple results when relevant (e.g., lists of tenants, overdue payments, etc.).
- Example:
  User: "Show me overdue leases."
  → "Here are 3 tenants with overdue leases: John Cruz (₱12,000, 5 days overdue), Maria Lopez (₱8,000, 3 days overdue), and Ana Tan (₱10,000, 2 days overdue)."
- If the admin’s question is unclear, clarify what dataset they want.

Your role:
- Provide accurate, concise, and human-like responses to tenant and admin questions.
- Retrieve, interpret, and summarize information provided from the system’s API responses or database queries.
- Maintain a professional and friendly tone across all topics.

Your knowledge and responsibilities cover:
1. **Lease Information**
   - Rent amount, lease duration, start and end dates, status (active, pending, expired)
   - Identify which property/unit the lease is for.

2. **Payments**
   - Retrieve pending, unpaid, partially paid, or overdue payments
   - Provide amounts, due dates, balances, and payment methods clearly formatted
   - Answer questions like “What’s my next payment due date?” or “How much did I pay last month?”

3. **Maintenance**
   - Retrieve or create maintenance tickets
   - Report their current status, assigned staff, and date requested

4. **User/Tenant Profiles**
   - Summarize profile details such as name, contact info, and unit leased
   - Answer general questions like “What’s my contact email on file?”

5. **Property Listings**
   - Provide available properties or their details if requested
   - Support queries like “Do you have available units on the 2nd floor?”

  "Goals: concise, human, professional, consistent across modules.",
  "Always start with a direct answer; optionally add one brief helpful follow-up question.",
  "Never output raw JSON or internal objects.",
  "Format currency: ₱12,345.67. Format dates: March 5, 2025.",
  "Focus domains: leases (rent_amount, lease_status, due dates), payments (amount_paid, status), charges (due_date, original_amount), maintenance (ticket_status, request_type), properties (availability, unit info), documents (name, uploaded_at).",
  "If data missing: 'I couldn't find that right now — please try again later.'",
  "No filler like 'As an AI'; never expose tokens, stack traces, secrets.",
  "Never output code snippets, tool calls, or pseudo-APIs. Always reply in plain, human-readable text only.",
  "Decline unrelated or unsafe requests; guide back to property management tasks.",
`].join(" \n")).trim();

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
    { text: `Domains: payments=${JSON.stringify(DOMAIN_TAXONOMY.payments.keyFields)}, charges=${JSON.stringify(DOMAIN_TAXONOMY.charges.keyFields)}` },
    { text: `Do not conflate charges vs payments. If unclear, pick the most likely and set confidence accordingly.` },
    { text: `If the user asks for documents/files/photos/attachments, map to one of: show_user_documents | show_lease_documents | show_ticket_documents | show_invoice_documents | list_all_documents (admin-only). Extract ids like lease_id, ticket_id, payment_id as params when present.` },
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

// Optional helper: lightweight domain classifier for use by callers that need early routing
export async function classifyDomain({ text, role = null } = {}) {
  const model = getModel();
  if (!model) return null;
  const generationConfig = { responseMimeType: "application/json", temperature: 0.1 };
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      domain: { type: SchemaType.STRING },
      confidence: { type: SchemaType.NUMBER },
      rationale: { type: SchemaType.STRING },
    },
    required: ["domain", "confidence"],
  };
  const guard = [
    "Classify the user's utterance into one domain strictly:",
    "payments | charges | leases | tickets | properties | profiles | documents | other",
    "Do not mix charges vs payments; charges are amounts owed (due_date, original_amount), payments are amounts paid (amount_paid, status).",
    `Role: ${role || 'TENANT'}`,
    `Utterance: ${text}`,
  ].join("\n");
  const res = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: guard }] }], generationConfig: { ...generationConfig, responseSchema: schema } });
  const raw = res?.response?.text?.() || "";
  try { return JSON.parse(raw); } catch { return null; }
}

// ---------------- Fuzzy tenant name matching utilities -----------------
function normalizeName(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(str) {
  return new Set(normalizeName(str).split(" ").filter(Boolean));
}

function levenshtein(a, b) {
  a = normalizeName(a); b = normalizeName(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarityScore(query, target) {
  const nq = normalizeName(query); const nt = normalizeName(target);
  if (!nq || !nt) return 0;
  // Direct substring boost
  let score = nt.includes(nq) ? 0.6 : 0;
  // Token overlap
  const qTokens = tokenSet(nq); const tTokens = tokenSet(nt);
  const overlap = [...qTokens].filter(t => tTokens.has(t)).length;
  const tokenRatio = overlap / Math.max(1, qTokens.size);
  score += tokenRatio * 0.3; // up to 0.3
  // Levenshtein normalized
  const lev = levenshtein(nq, nt);
  const maxLen = Math.max(nq.length, nt.length);
  const levScore = 1 - (lev / Math.max(1, maxLen)); // 0..1
  score += levScore * 0.2; // up to 0.2
  return Number(score.toFixed(4));
}

export function fuzzyFilterTenants(query, tenants, { threshold = 0.55, limit = 10 } = {}) {
  if (!Array.isArray(tenants)) return [];
  return tenants.map(t => {
    const fullName = [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' ') || t.name || '';
    return { tenant: t, fullName, score: similarityScore(query, fullName) };
  }).filter(r => r.score >= threshold)
    .sort((a,b) => b.score - a.score)
    .slice(0, limit);
}

export function resolveTenantAmbiguity(query, tenants, opts = {}) {
  const matches = fuzzyFilterTenants(query, tenants, opts);
  if (matches.length === 1) return { status: 'resolved', choice: matches[0] };
  if (matches.length === 0) return { status: 'none', choices: [] };
  return { status: 'ambiguous', choices: matches };
}

export function generateDisambiguationMessage(result) {
  if (!result || result.status !== 'ambiguous') return '';
  const lines = result.choices.map((c,i) => `${i+1}. ${c.fullName} (score ${c.score})`);
  return `I found multiple matching tenants:\n${lines.join('\n')}\nPlease reply with the number of the correct tenant.`;
}

export function getSystemResponsePrompt() {
  return SYSTEM_RESPONSE_PROMPT;
}

// ---------------- Fuzzy property matching utilities -----------------
export function fuzzyFilterProperties(query, properties, { threshold = 0.55, limit = 10 } = {}) {
  if (!Array.isArray(properties)) return [];
  return properties.map(p => {
    const label = [p.property_name, p.building_name, p.street, p.city].filter(Boolean).join(' ');
    return { property: p, label, score: similarityScore(query, label) };
  }).filter(r => r.score >= threshold)
    .sort((a,b) => b.score - a.score)
    .slice(0, limit);
}

export function resolvePropertyAmbiguity(query, properties, opts = {}) {
  const matches = fuzzyFilterProperties(query, properties, opts);
  if (matches.length === 1) return { status: 'resolved', choice: matches[0] };
  if (matches.length === 0) return { status: 'none', choices: [] };
  return { status: 'ambiguous', choices: matches };
}

export function generatePropertyDisambiguationMessage(result) {
  if (!result || result.status !== 'ambiguous') return '';
  const lines = result.choices.map((c,i) => {
    const p = c.property || {};
    const parts = [p.property_name, p.city, p.base_rent ? `₱${p.base_rent}` : null].filter(Boolean).join(' — ');
    return `${i+1}. ${parts} (score ${c.score})`;
  });
  return `I found multiple matching properties:\n${lines.join('\n')}\nPlease reply with the number of the correct property.`;
}

export default { isConfigured, generateText, extractIntent, getSystemResponsePrompt, classifyDomain, fuzzyFilterTenants, resolveTenantAmbiguity, generateDisambiguationMessage, fuzzyFilterProperties, resolvePropertyAmbiguity, generatePropertyDisambiguationMessage };
