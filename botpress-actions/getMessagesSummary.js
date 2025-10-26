async function run() {
    const api_domain =
        bp.NODE_ENV === "production"
            ? bp.env.AMBULO_API_BASE
            : bp.env.AMBULO_API_BASE_LOCAL;
    const API_BASE = `${api_domain}/api/${bp.env.API_VERSION}`;
    const token = event?.state?.session?.jwt || event?.payload?.jwt || user?.jwt
    if (!token) {
        bp.logger.warn('getMessagesSummary: missing JWT')
        return state
    }
    const res = await fetch(`${API_BASE}/assistant/me/messages/summary`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    state.assistant = state.assistant || {}
    state.assistant.messagesSummary = data
    return state
}

module.exports = run
