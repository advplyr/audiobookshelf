import fs from 'node:fs'
import { createRequire } from 'node:module'

type RealpathCache = NonNullable<Parameters<typeof old.realpathSync>[1]>
type RealpathCallback = NonNullable<Parameters<typeof old.realpath>[2]>

realpath.realpath = realpath
realpath.sync = realpathSync
realpath.realpathSync = realpathSync

// Older Node versions accept a cache where current versions accept options.
const origRealpath = fs.realpath as unknown as (p: string, cache: RealpathCache | RealpathCallback | null, cb?: RealpathCallback) => void
const origRealpathSync = fs.realpathSync as unknown as (p: string, cache?: RealpathCache | null) => string

var version = process.version
var ok = /^v[0-5]\./.test(version)
const old = createRequire(__filename)('./old.js') as typeof import('./old.js')

function newError(er: unknown) {
  const error = er as NodeJS.ErrnoException | null | undefined
  return error && error.syscall === 'realpath' && (
    error.code === 'ELOOP' ||
    error.code === 'ENOMEM' ||
    error.code === 'ENAMETOOLONG'
  )
}

function realpath(p: string, cb: RealpathCallback): void
function realpath(p: string, cache: RealpathCache | null, cb: RealpathCallback): void
function realpath(p: string, cache: RealpathCache | RealpathCallback | null, cb?: RealpathCallback) {
  if (ok) {
    return origRealpath(p, cache, cb)
  }

  if (typeof cache === 'function') {
    cb = cache
    cache = null
  }
  origRealpath(p, cache, function (er, result) {
    if (newError(er)) {
      old.realpath(p, cache, cb)
    } else {
      cb!(er, result)
    }
  })
}

function realpathSync(p: string, cache?: RealpathCache | null) {
  if (ok) {
    return origRealpathSync(p, cache)
  }

  try {
    return origRealpathSync(p, cache)
  } catch (er) {
    if (newError(er)) {
      return old.realpathSync(p, cache)
    } else {
      throw er
    }
  }
}

export = realpath
