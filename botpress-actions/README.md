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

JWT pass-through (Option A) setup
1) Botpress Cloud → Variables: define
  - AMBULO_API_BASE = https://<your-api-host>
  - API_VERSION = v1   (or whatever you expose)
2) Webchat embedding: send the user's JWT to the bot at startup
  - After the webchat loads, emit a custom event with the JWT so your first node can capture it.

  Example (client-side):
  <script>
    // After webchat initializes
    window.BOTPRESS_WEBCHAT_INIT = async () => {
     const jwt = /* read from your app's auth (cookie/localStorage/etc.) */
     if (window.botpressWebChat) {
      window.botpressWebChat.sendEvent({ type: 'custom', payload: { jwt } })
     }
    }
  </script>

3) In your bot flow: first node runs the captureJwt action (included in this folder)
  - This stores the token into state.session.jwt so every action can forward it.
4) Call initSession next to validate and load claims into state.assistant.claims.
  - Use claims.role to branch admin vs tenant experiences.

Usage inside a Botpress Code Action
1) All actions here expect:
  - Environment variables: AMBULO_API_BASE and API_VERSION
  - JWT available on state.session.jwt or event.payload.jwt
2) Paste an action's code into a Code Action and wire its outputs from state.assistant.* to your nodes.

Example (Action script body):
async function run() {
  const API_BASE = `${bp.env.AMBULO_API_BASE}/api/${bp.env.API_VERSION}`
  const token = state?.session?.jwt || event?.payload?.jwt || user?.jwt

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
- captureJwt.js → store event.payload.jwt into state.session.jwt
- initSession.js → POST /assistant/session/init → state.assistant.claims
- getMyProfile.js → GET /assistant/me/profile → state.assistant.profile
- getMyTickets.js → GET /assistant/me/tickets → state.assistant.tickets
- getMyLease.js → GET /assistant/me/lease → state.assistant.lease
- getMyCharges.js → GET /assistant/me/charges → state.assistant.charges
- getMyPayments.js → GET /assistant/me/payments → state.assistant.payments
- getFaqs.js → GET /assistant/faqs → state.assistant.faqs
- getMessagesSummary.js → GET /assistant/me/messages/summary → state.assistant.messagesSummary
- getMyMessages.js → GET /assistant/me/messages?other_user_id=... → state.assistant.thread
- sendMyMessage.js → POST /assistant/me/messages → state.assistant.lastSentMessage
- confirmPayment.js → PUT /assistant/admin/payments/:payment_id { status: 'confirmed' }
- rejectPayment.js → PUT /assistant/admin/payments/:payment_id { status: 'rejected' }
- waiveCharge.js → POST /assistant/admin/charges/:charge_id/waive
- listOverdueCharges.js → GET /assistant/admin/charges?status=overdue

Webchat embedding (client)
- Configure window.BOTPRESS_WEBCHAT_SCRIPT_URL and optionally window.BOTPRESS_WEBCHAT_CONFIG before assistant-webchat.js runs (or anytime before bootstrap completes).
- Optionally, define window.BOTPRESS_WEBCHAT_INIT = (ctx) => { /* send JWT as shown above, use ctx if needed */ }.

Suggested starter flow
1) Node: Start → Action: captureJwt → Action: initSession
2) Decision: claims.role in ['ADMIN','MANAGER']? → Admin menu; else → Tenant menu
3) Tenant menu: add actions like getMyProfile, getMyLease, getMyCharges, getMyPayments, getFaqs
4) Messages: getMessagesSummary to list threads; then getMyMessages and sendMyMessage per selection
5) Admin menu: listOverdueCharges, confirmPayment, rejectPayment, waiveCharge, and your other admin queries
