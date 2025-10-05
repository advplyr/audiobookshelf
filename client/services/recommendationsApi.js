// Minimal client for /api/recommendations
const routerBase = (typeof window !== 'undefined' && window.__NUXT__?.config?.routerBasePath) || '/audiobookshelf'

const base = `${routerBase}/api/recommendations`

function qs(p = {}) {
  const q = new URLSearchParams(p)
  const s = q.toString()
  return s ? `?${s}` : ''
}
async function http(path, opts = {}) {
  let token = ''
  try {
    token = window?.$nuxt?.$store?.getters?.['user/getToken'] || ''
  } catch (_) {}
  if (!token) {
    try {
      token = localStorage.getItem('accessToken') || ''
    } catch (_) {}
    const res = await fetch(path, {
      credentials: 'include',
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    })
    if (res.status === 401) {
      const back = encodeURIComponent(location.pathname + location.search)
      location.assign(`${routerBase}/login?redirect=${back}`)
      throw new Error('Unauthorized')
    }
    if (!res.ok) {
      let msg = 'Request failed'
      try {
        const j = await res.json()
        msg = j.message || msg
      } catch (_) {}
      const e = new Error(msg)
      e.status = res.status
      throw e
    }
    return res.status === 204 ? null : res.json()
  }
}
export const getTags = () => http(`${base}/tags`)
export const createRecommendation = (payload) => http(base, { method: 'POST', body: payload })
export const getInbox = (p = {}) => http(`${base}/inbox${qs(p)}`)
export const getSent = (p = {}) => http(`${base}/sent${qs(p)}`)
export const getBookRecs = (bookId, p = {}) => http(`${base}/book/${encodeURIComponent(bookId)}${qs(p)}`)
export const deleteRec = (id) => http(`${base}/${id}`, { method: 'DELETE' })
export const updateRec = (id, body) => http(`${base}/${id}`, { method: 'PUT', body })
