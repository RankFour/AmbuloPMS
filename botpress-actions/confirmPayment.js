async function run() {
    const api_domain =
        bp.NODE_ENV === "production"
            ? bp.env.AMBULO_API_BASE
            : bp.env.AMBULO_API_BASE_LOCAL;
    const API_BASE = `${api_domain}/api/${bp.env.API_VERSION}`;
  const token = event?.state?.session?.jwt || event?.payload?.jwt || user.jwt
  const id = (state.payment_id || event.payload?.payment_id || '').trim()
  if (!id) {
    bp.logger.warn('confirmPayment missing payment_id')
    return state
  }
  const res = await fetch(`${API_BASE}/assistant/admin/payments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'confirmed' })
  })
  const data = await res.json()
  state.confirmPayment = { ok: res.ok, data }
  return state
}
module.exports = run
