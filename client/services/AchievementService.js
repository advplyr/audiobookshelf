// client/services/AchievementService.js
const json = (res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function dispatchUnlocked (badges) {
  try {
    if (typeof window !== 'undefined' && badges && badges.length) {
      window.dispatchEvent(new CustomEvent('achievement:unlocked', { detail: { badges } }))
    }
  } catch (_) {}
}

// Try best-effort ways ABS stores the access token
function getAccessToken () {
  try {
    if (typeof window === 'undefined') return null
    const w = window
    const nuxtStore = w.$nuxt?.$store || null
    const nuxtState = w.__NUXT__?.state || null

    const tryFromStore = (s) => {
      if (!s) return null
      if (s.user?.user?.accessToken) return s.user.user.accessToken
      if (s.user?.accessToken) return s.user.accessToken
      if (s.user?.token) return s.user.token
      return null
    }

    const tokenFromStore = tryFromStore(nuxtStore) || tryFromStore(nuxtState)
    const tokenFromStorage =
      w.localStorage?.getItem('accessToken') ||
      w.localStorage?.getItem('token') ||
      null

    return tokenFromStore || tokenFromStorage || null
  } catch {
    return null
  }
}

function authHeaders () {
  const t = getAccessToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const normalizeProgress = (p) => ({
  userId: p?.userId || 'guest',
  counters: p?.counters || {},
  unlocked: Array.isArray(p?.unlocked) ? p.unlocked : [],
  history: Array.isArray(p?.history) ? p.history : []
})

async function postComplete (payload) {
  const data = await fetch('/api/achievements/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(payload || {})
  })
    .then(json)
    .catch(() => ({}))
  if (data?.unlockedNow?.length) dispatchUnlocked(data.unlockedNow)
  return data
}

export default {
  async getCatalog () {
    return fetch('/api/achievements/catalog', {
      credentials: 'include'
    }).then(json)
  },

  async getMy () {
    return fetch('/api/achievements/me', {
      credentials: 'include',
      headers: { ...authHeaders() }
    })
      .then(json)
      .then(normalizeProgress)
      .catch(() => normalizeProgress(null))
  },

  async complete (payload) {
    return postComplete(payload)
  },

  // NEW — convenience wrappers
  loginPing () {
    return postComplete({ event: 'login' })
  },
  markSearched () {
    return postComplete({ event: 'search' })
  },
  markReadToday () {
    return postComplete({ event: 'readUploadedToday' })
  }
}
