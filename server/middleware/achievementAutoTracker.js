// server/middleware/achievementAutoTracker.js
// Best-effort, low-overhead server middleware that translates common API
// requests into achievement events. It listens for the final status code so we
// only record events on successful requests.

const AchievementManager = require('../managers/AchievementManager')

// normalize to YYYY-MM-DD
const today = () => new Date().toISOString().slice(0, 10)

module.exports = function achievementAutoTracker () {
  return (req, res, next) => {
    // We’ll run *after* the auth middleware inside the /api chain so req.user
    // is populated (either session or JWT).
    const userId = req.user && (req.user.id || req.user.userId)
      ? String(req.user.id || req.user.userId)
      : null

    const method = req.method || 'GET'
    const path = req.path || ''
    const q = req.query || {}

    const fire = (event) => {
      if (!userId) return
      AchievementManager.applyEvent(userId, event).catch(() => {})
    }

    // Mark a login once per day on the first authed API hit we see.
    if (userId) {
      const t = today()
      if (!req.session) req.session = {}
      if (req.session.__achLoginDate !== t) {
        req.session.__achLoginDate = t
        fire('login')
      }
    }

    // -------------------- SEARCH + FILTERS --------------------
    // Explicit search endpoint
    if (method === 'GET' && /^\/api\/libraries\/[^/]+\/search\b/.test(path)) {
      fire('performedSearch')
    }

    // Filters on listing endpoints (heuristic: presence of filter-ish query keys)
    if (method === 'GET' && /^\/api\/libraries\/[^/]+\//.test(path)) {
      const keysStr = Object.keys(q).join(',').toLowerCase()
      if (keysStr && /(filter|filters|sort|order|tag|genre|author|narrator|series|collection|min|max|asc|desc)/.test(keysStr)) {
        fire('appliedFilter')
      }
    }

    // -------------------- LIBRARIES ---------------------------
    // Created library
    if (userId && method === 'POST' && /^\/api\/libraries\b/.test(path)) {
      res.on('finish', () => { if (res.statusCode < 400) fire('createdLibrary') })
    }
    // Edited library (PUT or PATCH /api/libraries/:id)
    if (userId && (method === 'PUT' || method === 'PATCH') && /^\/api\/libraries\/[^/]+$/.test(path)) {
      res.on('finish', () => { if (res.statusCode < 400) fire('editedLibrary') })
    }

    // -------------------- COLLECTIONS / PLAYLISTS -------------
    // Created collection
    if (userId && method === 'POST' && /^\/api\/collections?\b/.test(path)) {
      res.on('finish', () => { if (res.statusCode < 400) fire('createdCollection') })
    }
    // Created playlist  (covers /api/playlists or /api/playlist)
    if (userId && method === 'POST' && /^\/api\/playlists?\b/.test(path)) {
      res.on('finish', () => { if (res.statusCode < 400) fire('createdPlaylist') })
    }

    // -------------------- BOOK DOWNLOADS ----------------------
    // ABS uses a few different download/serve endpoints. We fire when it looks
    // like the user fetched a file for an item.
    if (userId && method === 'GET') {
      const isItemDownload =
        /^\/api\/items\/[a-z0-9-]{36}\//.test(path) &&
        /(download|ebook|file|audio|stream)/i.test(path)

      const isGenericDownload = /\/download\b/i.test(path)

      if (isItemDownload || isGenericDownload) {
        res.on('finish', () => { if (res.statusCode < 400) fire('downloadedBook') })
      }
    }

    next()
  }
}
