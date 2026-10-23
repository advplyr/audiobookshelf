declare module 'passport' {
  import type { NextFunction, Request, Response } from 'express'
  interface AuthenticateOptions {
    session?: boolean
    redirect_uri?: string
  }

  interface Authenticator {
    use(strategy: object): Authenticator
    use(name: string, strategy: object): Authenticator
    unuse(name: string): Authenticator
    authenticate(strategy: string, options?: AuthenticateOptions): (req: Request, res: Response, next: NextFunction) => void
    authenticate(
      strategy: string,
      options: AuthenticateOptions,
      callback: (err: unknown, user: unknown, info: unknown) => void
    ): (req: Request, res: Response, next: NextFunction) => void
    serializeUser(fn: (user: { id: string }, cb: (err: unknown, id?: string) => void) => void): void
    deserializeUser(fn: (serialized: string, cb: (err: unknown, user?: unknown) => void) => void): void
  }

  const passport: Authenticator
  export = passport
}

declare module 'passport-jwt' {
  import type { Request } from 'express'
  interface JwtFromRequest {
    (req: Request): string | null
  }

  interface StrategyOptions {
    jwtFromRequest: JwtFromRequest
    secretOrKey: string | null | undefined
    ignoreExpiration?: boolean
  }

  type VerifyCallback = (payload: object, done: (err: unknown, user?: unknown) => void) => void | Promise<void>

  class Strategy {
    constructor(options: StrategyOptions, verify: VerifyCallback)
  }

  interface Extractors {
    fromAuthHeaderAsBearerToken(): JwtFromRequest
    fromUrlQueryParameter(name: string): JwtFromRequest
    fromExtractors(extractors: JwtFromRequest[]): JwtFromRequest
  }

  const ExtractJwt: Extractors
  export { Strategy, ExtractJwt }
}
