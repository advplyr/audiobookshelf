// client/plugins/achievements.axios.client.js
import AchievementService from '@/services/AchievementService'

function matches (url, method, needle, m) {
  return method === m && url.includes(needle)
}

export default function ({ $axios }) {
  $axios.onResponse((resp) => {
    try {
      const { config, status } = resp || {}
      const url = (config?.url || '').toLowerCase()
      const method = (config?.method || 'get').toLowerCase()
      if (!url || status >= 400) return

      // Edited library
      if (matches(url, method, '/api/libraries/', 'patch') || matches(url, method, '/api/libraries/', 'put')) {
        AchievementService.complete({ event: 'editedLibrary' })
      }

      // Created collection
      if (matches(url, method, '/api/collections', 'post')) {
        AchievementService.complete({ event: 'createdCollection' })
      }

      // Created playlist
      if (matches(url, method, '/api/playlists', 'post')) {
        AchievementService.complete({ event: 'createdPlaylist' })
      }

      // Downloaded a book (server routes often contain /download/)
      if (url.includes('/download/') || url.includes('/public/download/')) {
        AchievementService.complete({ event: 'downloadedBook' })
      }
    } catch {}
  })
}
