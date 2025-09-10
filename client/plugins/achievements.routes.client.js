// client/plugins/achievements.routes.client.js
import AchievementService from '@/services/AchievementService'

let fired = new Set()
const once = (k, fn) => { if (fired.has(k)) return; fired.add(k); try { fn() } catch {} }

export default function ({ app }) {
  const handle = (to) => {
    const p = to?.path || ''
    const q = to?.query || {}

    // Author
    if (/^\/author\/[^/]+$/.test(p)) once('openedAuthor', () => AchievementService.complete({ event: 'openedAuthor' }))

    // Narrators tab
    if (/^\/library\/[^/]+\/narrators/.test(p)) once('openedNarrator', () => AchievementService.complete({ event: 'openedNarrator' }))

    // ✅ Stats pages (any of these routes count)
    if (
      /^\/library\/[^/]+\/stats/.test(p) ||
      /^\/config\/stats/.test(p) ||
      /^\/stats(\/|$)/.test(p) ||
      /^\/your-stats(\/|$)/.test(p)
    ) {
      once('visitedStats', () => AchievementService.complete({ event: 'visitedStats' }))
    }

    // Applied filter (search page with any extra query besides q)
    if (/^\/library\/[^/]+\/search/.test(p)) {
      const keys = Object.keys(q).filter(k => k !== 'q')
      if (keys.length) once('appliedFilter', () => AchievementService.complete({ event: 'appliedFilter' }))
    }
  }

  handle(app.router.currentRoute)
  app.router.afterEach((to) => handle(to))
}
