declare module 'semver' {
  export function compare(left: string, right: string): -1 | 0 | 1
  export function gt(left: string, right: string): boolean
  export function lte(left: string, right: string): boolean
}
