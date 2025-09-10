// server/middleware/sessionOrJwt.js
/**
 * Accept either an existing session user (passport session)
 * or a JWT bearer token (API). Returns 401 only if neither is present.
 *
 * 👉 Enhancement:
 * When a user is authenticated, we emit the "userLoggedIn" achievement
 * event in a fire-and-forget way so "First Login" (and streaks) unlock
 * immediately for brand-new accounts too.
 */
const AchievementManager = require('../managers/AchievementManager')

function fireLoginEvent(req) {
  try {
    if (req._absLoginEventSent) return
    const user = req.user
    const uid = user && (user.id || user.userId)
    if (!uid) return

    req._absLoginEventSent = true
    // Do not block the request if achievements write fails
    AchievementManager.applyEvent(String(uid), 'userLoggedIn').catch(() => {})
  } catch (_) {
    // swallow — achievements must never break auth
  }
}

module.exports = (auth) => {
  if (!auth || typeof auth.isAuthenticated !== 'function') {
    throw new Error('[sessionOrJwt] auth.isAuthenticated missing')
  }

  return (req, res, next) => {
    // Session user already present?
    if (req.user && (req.user.id || req.user.userId)) {
      fireLoginEvent(req)
      return next()
    }

    // Try JWT auth (no session). Use custom callback so we can continue.
    auth.isAuthenticated(req, res, (err) => {
      if (err) return next(err)
      if (req.user && (req.user.id || req.user.userId)) {
        fireLoginEvent(req)
        return next()
      }
      return res.status(401).json({ error: 'Unauthorized' })
    })
  }
}
