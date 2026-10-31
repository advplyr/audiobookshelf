import type { Request } from 'express'

type RequestContext = Pick<Request, 'secure' | 'get'>

/**
 * Whether the request was made over HTTPS.
 * Uses Express `req.secure` and `x-forwarded-proto`
 */
export function isRequestSecure(req: RequestContext): boolean {
  if (req.secure) return true
  const xfp = (req.get('x-forwarded-proto') || '').toLowerCase()
  // Nginx Proxy Manager sends "http, https"; see https://github.com/advplyr/audiobookshelf/pull/4635
  return (
    xfp === 'https' ||
    xfp
      .split(',')
      .map((s) => s.trim())
      .includes('https')
  )
}

export function getRequestProtocol(req: RequestContext): 'https' | 'http' {
  return isRequestSecure(req) ? 'https' : 'http'
}

export function getRequestOrigin(req: RequestContext): { protocol: 'https' | 'http'; host: string | undefined; origin: string } {
  const protocol = getRequestProtocol(req)
  const host = req.get('host')
  return { protocol, host, origin: `${protocol}://${host}` }
}
