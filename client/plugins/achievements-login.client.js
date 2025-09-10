// client/plugins/achievements-login.client.js
import AchievementService from '@/services/AchievementService'

export default () => {
  // Fire a login event on each app start when the user has a token
  const hasToken = !!(typeof window !== 'undefined' && (localStorage.getItem('accessToken') || localStorage.getItem('token')))
  if (!hasToken) return

  // To allow "double dip", we DO send each time the app boots.
  AchievementService.complete({ event: 'login' }).catch(() => {})
}
