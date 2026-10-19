// Boundary declaration for the formatting API used by application code.
// Keep this outside the library directory so index.js remains in the build output.
export function format(date: Date, format: string | string[], utc?: boolean): string
