export interface Options {
  uid?: number
  gid?: number
  pathExt?: string
  ignoreErrors?: boolean
}

// The POSIX mode check can return the executable bit as a number.
export type Callback = (error: NodeJS.ErrnoException | null, executable: boolean | number) => void

declare global {
  var TESTING_WINDOWS: boolean | undefined
}
