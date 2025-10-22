Botpress Actions scaffold for AmbuloPMS Assistant

Overview
- These helpers show how your Botpress actions can call the secured assistant endpoints you now have under /api/{API_VERSION}/assistant.
- They are plain JavaScript utilities you can copy into your Botpress bot (as Code Actions) or import into a custom actions bundle.

Endpoints (JWT required)
- POST /assistant/session/init → returns { claims } for the current user session
- GET  /assistant/me/tickets → tenant tickets (query: page, limit, status)
- GET  /assistant/admin/tickets → admin tickets search
- GET  /assistant/admin/tenants → admin tenant search
- GET  /assistant/admin/tenants/:user_id/financials → charges + payments for a tenant
- GET  /assistant/admin/leases/:lease_id/charges → lease charges
- POST /assistant/admin/charges → create a charge
- POST /assistant/admin/payments → create a payment or consolidated payment (allocations[])

Usage inside a Botpress Code Action
1) Ensure your webchat or channel sets a valid JWT cookie or Authorization: Bearer <token> header that your backend will accept.
2) In a Code Action, you can paste one of the helpers below and call it with your API base URL and token.

Example (Action script body):
async function run() {
  const API_BASE = `${bp.env.AMBULO_API_BASE}/api/${bp.env.AMBULO_API_VERSION}`
  const token = event?.state?.session?.jwt || event?.payload?.jwt || user.jwt

  // init session
  const initRes = await fetch(`${API_BASE}/assistant/session/init`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  const { claims } = await initRes.json()
  bp.logger.info('Assistant claims', claims)

  // get tickets for tenant
  const ticketsRes = await fetch(`${API_BASE}/assistant/me/tickets?page=1&limit=5`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const tickets = await ticketsRes.json()
  state.assistant = { claims, tickets }
  return state
}

module.exports = run

Notes
- For admin-only endpoints, validate role in your bot flows before calling.
- For consolidated payments, send payload: { user_id, amountPaid, paymentMethod, notes, allocations: [{ chargeId, amount }, ...] }.

Additional Code Actions included
- confirmPayment.js → PUT /assistant/admin/payments/:payment_id { status: 'confirmed' }
- rejectPayment.js → PUT /assistant/admin/payments/:payment_id { status: 'rejected' }
- waiveCharge.js → POST /assistant/admin/charges/:charge_id/waive
- listOverdueCharges.js → GET /assistant/admin/charges?status=overdue

Webchat embedding (client)
- Configure window.BOTPRESS_WEBCHAT_SCRIPT_URL and optionally window.BOTPRESS_WEBCHAT_CONFIG before assistant-webchat.js runs (or anytime before bootstrap completes).
- Alternatively, define window.BOTPRESS_WEBCHAT_INIT = (ctx) => { /* custom init with ctx.claims */ }.
