async function run() {
    const api_domain =
        bp.NODE_ENV === "production"
            ? bp.env.AMBULO_API_BASE
            : bp.env.AMBULO_API_BASE_LOCAL;
    const API_BASE = `${api_domain}/api/${bp.env.API_VERSION}`;
  const token = event?.state?.session?.jwt || event?.payload?.jwt || user?.jwt

  if (!token) {
    bp.logger.warn('initSession: missing JWT in session/payload/user')
    return state
  }

  const res = await fetch(`${API_BASE}/assistant/session/init`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
  let data = {}
  try { data = await res.json() } catch (e) {}

  state.assistant = state.assistant || {}
  state.assistant.session = { ok: res.ok, ...data }
  if (data?.claims) state.assistant.claims = data.claims
  return state
}

module.exports = run
