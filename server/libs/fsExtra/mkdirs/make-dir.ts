import { createRequire } from 'node:module'
import type { mkdirSync } from 'node:fs'
import type { mkdir } from 'node:fs/promises'
import { checkPath } from './utils'

const fs = createRequire(__filename)('../fs') as {
  mkdir: typeof mkdir
  mkdirSync: typeof mkdirSync
}
type Options = number | { mode?: number | string } | null


const getMode = (options?: Options) => {
  const defaults = { mode: 0o777 }
  if (typeof options === 'number') return options
  return ({ ...defaults, ...options }).mode
}

export async function makeDir(dir: string, options?: Options) {
  checkPath(dir)

  return fs.mkdir(dir, {
    mode: getMode(options),
    recursive: true
  })
}

export function makeDirSync(dir: string, options?: Options) {
  checkPath(dir)

  return fs.mkdirSync(dir, {
    mode: getMode(options),
    recursive: true
  })
}
