declare module 'graceful-fs' {
  const fs: typeof import('node:fs')
  export = fs
}
