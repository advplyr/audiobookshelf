// client/plugins/achievements-axios-hook.client.js
import AchievementService from '@/services/AchievementService'

const hit = (event) => AchievementService.complete({ event }).catch(() => {})

export default (ctx) => {
  const isAchUrl = (u) => typeof u === 'string' && u.includes('/api/achievements/')
  ctx.$axios.onResponse((response) => {
    try {
      const { config, status } = response || {}
      if (!config || status >= 400) return
      const method = (config.method || 'get').toLowerCase()
      const url = config.url || ''
      if (isAchUrl(url)) return

      // Library edited
      if ((method === 'patch' || method === 'put') && /\/api\/libraries\/[^/]+$/.test(url)) return hit('editedLibrary')

      // Collections & Playlists created
      if (method === 'post' && /\/api\/collections(\/|$)/.test(url)) return hit('createdCollection')
      if (method === 'post' && /\/api\/playlists(\/|$)/.test(url)) return hit('createdPlaylist')

      // Series created
      if (method === 'post' && /\/api\/series(\/|$)/.test(url)) return hit('createdSeries')

      // Book uploaded already backfilled; download is normally not via axios
    } catch { /* noop */ }
  })
}
