async function run() {
    const api_domain =
        bp.NODE_ENV === "production"
            ? bp.env.AMBULO_API_BASE
            : bp.env.AMBULO_API_BASE_LOCAL;
    const API_BASE = `${api_domain}/api/${bp.env.API_VERSION}`;
    const token = event?.state?.session?.jwt || event?.payload?.jwt || user?.jwt
    if (!token) {
        bp.logger.warn('getMyMessages: missing JWT')
        return state
    }

    const other_user_id = (event.payload?.other_user_id || state.other_user_id || '').trim()
    if (!other_user_id) {
        bp.logger.warn('getMyMessages: missing other_user_id')
        return state
    }

    const page = event.payload?.page ?? state.messages_page ?? 1
    const limit = event.payload?.limit ?? state.messages_limit ?? 20
    const search = event.payload?.search ?? state.messages_search
    const sort = event.payload?.sort ?? state.messages_sort
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    if (search) params.set('search', String(search))
    if (sort) params.set('sort', String(sort))

    const res = await fetch(`${API_BASE}/assistant/me/messages?other_user_id=${encodeURIComponent(other_user_id)}&${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    state.assistant = state.assistant || {}
    state.assistant.thread = { other_user_id, data }
    return state
}

module.exports = run
