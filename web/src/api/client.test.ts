import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, getAccessToken, setAccessToken } from './client'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  setAccessToken(null)
})

describe('api client', () => {
  it('sends the access token as a Bearer header', async () => {
    setAccessToken('tok1')
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await api('/api/libraries')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/audiobookshelf/api/libraries')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok1')
  })

  it('refreshes once on 401 and retries with the new token', async () => {
    setAccessToken('expired')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { user: { accessToken: 'fresh' } })) // POST /auth/refresh
      .mockResolvedValueOnce(json(200, { libraries: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/api/libraries')).resolves.toEqual({ libraries: [] })
    expect(fetchMock.mock.calls[1][0]).toBe('/audiobookshelf/auth/refresh')
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer fresh')
    expect(getAccessToken()).toBe('fresh')
  })

  it('signs out when the refresh also fails', async () => {
    setAccessToken('expired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {})))

    await expect(api('/api/libraries')).rejects.toBeInstanceOf(ApiError)
    expect(getAccessToken()).toBeNull()
  })

  it('does not try to refresh a failed login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api('/login', { method: 'POST' })).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
