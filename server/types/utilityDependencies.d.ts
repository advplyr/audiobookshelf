// Boundaries used by the foundation utilities; parsed XML remains untrusted.
declare module 'uuid' {
  export function validate(value: string): boolean
}

declare module 'xml2js' {
  export function parseString(xml: string | Buffer, callback: (error: Error | null, result: unknown) => void): void
}
