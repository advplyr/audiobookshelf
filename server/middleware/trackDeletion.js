// server/middleware/trackDeletion.js
//
// Listens for successful DELETE/“delete”/“remove” API calls that target items/files,
// and awards the “deleted first file” achievement exactly once for the user.
//

const AchievementManager = require('../managers/AchievementManager')

module.exports = function trackDeletion () {
  // Any API route that looks like it deletes items/files/books etc.
  const looksLikeDeletePath = (p) => {
    if (!p) return false
    const path = String(p)
    const hasDeleteVerb = /\/(delete|remove)(\/|$)/i.test(path)
    const deleteMethod = /\/api\//i.test(path) && (
      hasDeleteVerb || /\/(items?|books?|library-items?|uploads?|files?)\//i.test(path)
    )
    return deleteMethod
  }

  return function (req, res, next) {
    // We’ll track a successful DELETE method OR POSTs that hit “/delete|/remove”
    const shouldWatch =
      (req.method === 'DELETE' && looksLikeDeletePath(req.originalUrl || req.url)) ||
      (['POST', 'PUT', 'PATCH'].includes(req.method) && /\/(delete|remove)(\/|$)/i.test(req.originalUrl || req.url))

    if (!shouldWatch) return next()

    const userId = String(req.user?.id || req.user?.userId || req.session?.userId || '')
    // Only attach a listener; do not block the request handler
    res.on('finish', () => {
      if (!userId) return
      // Only award if the operation actually succeeded
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AchievementManager.applyEvent(userId, 'deletedFile').catch(() => {})
      }
    })

    next()
  }
}
