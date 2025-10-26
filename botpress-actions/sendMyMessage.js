async function run() {
    const api_domain =
    bp.NODE_ENV === "production"
      ? process.env.AMBULO_API_BASE
      : process.env.AMBULO_API_BASE_LOCAL;
  const API_BASE = `${api_domain}/api/${process.env.API_VERSION}`
  const token = event?.state?.session?.jwt || event?.payload?.jwt || user?.jwt
  if (!token) {
    bp.logger.warn('sendMyMessage: missing JWT')
    return state
  }

  const other_user_id = (event.payload?.other_user_id || state.other_user_id || '').trim()
  const message = (event.payload?.message || state.message || '').trim()
  const attachments = Array.isArray(event.payload?.attachments) ? event.payload.attachments : undefined
  const tmpId = event.payload?.tmpId

  if (!other_user_id) {
    bp.logger.warn('sendMyMessage: missing other_user_id')
    return state
  }
  if (!message) {
    bp.logger.warn('sendMyMessage: missing message')
    return state
  }

  const res = await fetch(`${API_BASE}/assistant/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ other_user_id, message, attachments, tmpId })
  })
  const data = await res.json()
  state.assistant = state.assistant || {}
  state.assistant.lastSentMessage = { ok: res.ok, data }
  return state
}

module.exports = run
