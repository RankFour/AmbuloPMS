async function run() {
    const api_domain =
        bp.NODE_ENV === "production"
            ? bp.env.AMBULO_API_BASE
            : bp.env.AMBULO_API_BASE_LOCAL;
    const API_BASE = `${api_domain}/api/${bp.env.API_VERSION}`;
    const token = event?.state?.session?.jwt || event?.payload?.jwt || user?.jwt
    if (!token) {
        bp.logger.warn('getMyPayments: missing JWT')
        return state
    }

    const page = event.payload?.page ?? state.payments_page ?? 1
    const limit = event.payload?.limit ?? state.payments_limit ?? 10
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))

    const res = await fetch(`${API_BASE}/assistant/me/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    state.assistant = state.assistant || {}
    state.assistant.payments = data
    return state
}

module.exports = run
