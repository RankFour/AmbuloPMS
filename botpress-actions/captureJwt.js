async function run() {
  const jwt = event?.payload?.jwt
  if (jwt) {
    state.session = state.session || {}
    state.session.jwt = jwt
    bp.logger.info('JWT captured in session state')
  } else {
    bp.logger.warn('captureJwt: no jwt in event.payload')
  }
  return state
}

module.exports = run
