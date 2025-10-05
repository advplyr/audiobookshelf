// server/middleware/sessionOrJwt.js
let AchievementManager = null;
try {
  // If you actually have an achievements manager, require it here.
  // Otherwise keep this try/catch and we'll simply no-op below.
  AchievementManager = require('../managers/AchievementManager');
} catch (_) {
  // optional; safely ignored when absent
}

function fireLoginEvent(req) {
  try {
    // Only call if the module exists AND exposes applyEvent
    if (!AchievementManager || typeof AchievementManager.applyEvent !== 'function') return;
    if (req._absLoginEventSent) return;

    const user = req.user;
    const uid = user && (user.id || user.userId);
    if (!uid) return;

    req._absLoginEventSent = true;
    AchievementManager.applyEvent(String(uid), 'userLoggedIn').catch(() => {});
  } catch (_) {
    // never break auth flow
  }
}

module.exports = (auth) => {
  if (!auth || typeof auth.isAuthenticated !== 'function') {
    throw new Error('[sessionOrJwt] auth.isAuthenticated missing');
  }
  return (req, res, next) => {
    // If something upstream already attached req.user, fire and continue.
    if (req.user && (req.user.id || req.user.userId)) {
      fireLoginEvent(req);
      return next();
    }

    auth.isAuthenticated(req, res, (err) => {
      if (err) return next(err);
      if (req.user && (req.user.id || req.user.userId)) {
        fireLoginEvent(req);
        return next();
      }
      // IMPORTANT: 401 here (not 500) when no credentials
      return res.status(401).send('Unauthorized');
    });
  };
};
