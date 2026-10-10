declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: number
  }

  export function sign(
    payload: object,
    secret: string,
    options: SignOptions,
    callback: (error: Error | null, token?: string) => void
  ): void
}
