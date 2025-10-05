// server/middleware/requireAuth.js
//
// Tiny guard that ensures req.user is present AFTER sessionOrJwt has run.
// Sends a clean 401 instead of leaking as a 500.
module.exports = (auth) => {
  return (req, res, next) => {
    // If Auth added a user (via cookie session or Bearer) we proceed.
    if (req.user && req.user.id) return next()

    // Otherwise make it explicit that this route requires auth.
    res.status(401).send('Unauthorized')
  }
}
