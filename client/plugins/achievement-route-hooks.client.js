// client/plugins/achievement-route-hooks.client.js
export default ({ app }) => {
  const fire = async (event) => {
    try {
      const svc = (await import('@/services/AchievementService')).default
      svc.complete({ event })
    } catch (_) {}
  }

  const base = app.$config?.routerBasePath || ''
  const stripBase = (p) => (base && p.startsWith(base) ? p.slice(base.length) : p)

  const seen = new Set()

  app.router.afterEach((to) => {
    const full = to.fullPath || to.path || ''
    const path = stripBase(full)
    const purePath = path.split('?')[0]

    if (!seen.has('visited_settings') && purePath.startsWith('/config')) {
      seen.add('visited_settings')
      fire('visitedSettings')
    }
    if (!seen.has('opened_author') && (purePath.includes('/authors') || /^\/author\//.test(purePath))) {
      seen.add('opened_author')
      fire('openedAuthor')
    }
    if (!seen.has('opened_narrator') && (purePath.includes('/narrators') || /^\/narrator\//.test(purePath))) {
      seen.add('opened_narrator')
      fire('openedNarrator')
    }

    if (purePath.startsWith('/library/')) {
      const keys = Object.keys(to.query || {})
      const effective = keys.filter((k) => !['q', 'page'].includes(k))
      if (effective.length && !seen.has('applied_filter')) {
        seen.add('applied_filter')
        fire('appliedFilter')
      }
    }
  })
}
