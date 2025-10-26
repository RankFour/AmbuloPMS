async function run() {
  const API_BASE = `${bp.env.AMBULO_API_BASE}/api/${bp.env.API_VERSION}`
  const token = event?.state?.session?.jwt || event?.payload?.jwt || user.jwt
  const id = (state.charge_id || event.payload?.charge_id || '').trim()
  if (!id) {
    bp.logger.warn('waiveCharge missing charge_id')
    return state
  }
  const res = await fetch(`${API_BASE}/assistant/admin/charges/${id}/waive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  state.waiveCharge = { ok: res.ok, data }
  return state
}
module.exports = run
