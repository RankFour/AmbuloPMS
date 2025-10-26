async function run() {
    const api_domain =
        bp.NODE_ENV === "production"
            ? bp.env.AMBULO_API_BASE
            : bp.env.AMBULO_API_BASE_LOCAL;
    const API_BASE = `${api_domain}/api/${bp.env.API_VERSION}`;
    const token = event?.state?.session?.jwt || event?.payload?.jwt || user?.jwt
    if (!token) {
        bp.logger.warn('getMyCharges: missing JWT')
        return state
    }

    const status = event.payload?.status ?? state.charges_status // e.g., 'All' | 'Paid' | 'Pending' | 'Overdue' | 'Waived'
    const params = new URLSearchParams()
    if (status) params.set('status', String(status))

    const url = `${API_BASE}/assistant/me/charges${params.toString() ? `?${params.toString()}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    state.assistant = state.assistant || {}
    state.assistant.charges = data
    return state
}

module.exports = run
