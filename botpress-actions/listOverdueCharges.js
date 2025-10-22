async function run() {
  const API_BASE = `${bp.env.AMBULO_API_BASE}/api/${bp.env.API_VERSION}`
  const token = event?.state?.session?.jwt || event?.payload?.jwt || user.jwt
  const res = await fetch(`${API_BASE}/assistant/admin/charges?status=overdue&limit=10`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const data = await res.json()
  state.overdueCharges = data
  return state
}
module.exports = run
