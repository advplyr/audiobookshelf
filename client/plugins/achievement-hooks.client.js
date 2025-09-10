// client/plugins/achievement-hooks.client.js
import AchievementService from '@/services/AchievementService'

export default ({ app }, inject) => {
  const seen = new Set()

  const once = async (key, fn) => {
    try {
      if (seen.has(key)) return
      seen.add(key)
      await fn()
    } catch (_) {}
  }

  // --------------------- DAILY LOGIN PING (UTC-day safe) --------------------
  const todayKey = () => Math.floor(Date.now() / (24 * 60 * 60 * 1000)) // UTC-ish
  const storageKey = () => `abs:login-ping:${todayKey()}`
  const trySendDailyLoginPing = async () => {
    const k = storageKey()
    if (sessionStorage.getItem(k)) return

    // Ensure we are authenticated before we count a login
    const me = await AchievementService.getMy().catch(() => null)
    if (me && me.userId && me.userId !== 'guest') {
      await AchievementService.complete({ event: 'userLoggedIn' })
      sessionStorage.setItem(k, '1')
    }
  }

  if (process.browser) {
    // fire on app load and after each route change (first successful auth wins)
    trySendDailyLoginPing()
    app.router.afterEach(() => trySendDailyLoginPing())

    // also check again every ~15 minutes in long-lived tabs crossing midnight
    setInterval(() => trySendDailyLoginPing(), 15 * 60 * 1000)
  }

  // -------------------------- NAVIGATION HOOKS ------------------------------
  app.router.afterEach((to) => {
    // Upload page
    if (to.path.startsWith('/upload')) {
      once('visitedUpload', () => AchievementService.complete({ event: 'visitedUpload' }))
    }

    // Authors
    if (to.path.startsWith('/author') || to.path.startsWith('/authors')) {
      once('openedAuthor', () => AchievementService.complete({ event: 'openedAuthor' }))
    }

    // Narrators
    if (to.path.startsWith('/narrator') || to.path.startsWith('/narrators')) {
      once('openedNarrator', () => AchievementService.complete({ event: 'openedNarrator' }))
    }

    // Stats pages (Your Stats / Library Stats)
    if (to.path.startsWith('/stats') || to.path.startsWith('/your-stats') || to.path.startsWith('/library-stats')) {
      once('visitedSettings', () => AchievementService.complete({ event: 'visitedSettings' }))
    }
  })

  // ------------------------ OPTIONAL ACTION HOOKS ---------------------------
  if (process.browser) {
    window.addEventListener('abs:search-performed', () => {
      AchievementService.complete({ event: 'performedSearch' })
    })
    window.addEventListener('abs:playlist-created', () => {
      AchievementService.complete({ event: 'createdPlaylist' })
    })
    window.addEventListener('abs:book-downloaded', () => {
      AchievementService.complete({ event: 'downloadedBook' })
    })
  }
}
