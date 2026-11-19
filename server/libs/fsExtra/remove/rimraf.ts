import fs from 'graceful-fs'
import path from 'node:path'
import assert from 'node:assert'
import type { PathLike, RmDirOptions } from 'node:fs'

type Done = (error?: NodeJS.ErrnoException | null) => void
type FileMethod = 'unlink' | 'chmod' | 'stat' | 'lstat' | 'rmdir' | 'readdir'
type Options = Pick<typeof fs, FileMethod | `${FileMethod}Sync`> & RmDirOptions & { maxBusyTries: number }

const isWindows = (process.platform === 'win32')

function defaults (options: Partial<Options>): asserts options is Options {
  const methods = ['unlink', 'chmod', 'stat', 'lstat', 'rmdir', 'readdir'] as const
  function setDefault<K extends keyof typeof fs> (method: K) {
    const target: Partial<typeof fs> = options
    target[method] = target[method] || fs[method]
  }
  methods.forEach(method => {
    setDefault(method)
    setDefault(`${method}Sync`)
  })

  options.maxBusyTries = options.maxBusyTries || 3
}

function rimraf (p: PathLike, cb: Done): void
function rimraf (p: PathLike, options: Partial<Options>, cb: Done): void
function rimraf (p: PathLike, options: Partial<Options> | Done, cb?: Done): void {
  let busyTries = 0

  if (typeof options === 'function') {
    cb = options
    options = {}
  }

  assert(p, 'rimraf: missing path')
  assert.strictEqual(typeof p, 'string', 'rimraf: path should be a string')
  if (typeof p !== 'string') return
  assert.strictEqual(typeof cb, 'function', 'rimraf: callback function required')
  if (!cb) return
  assert(options, 'rimraf: invalid options argument provided')
  assert.strictEqual(typeof options, 'object', 'rimraf: options should be object')

  defaults(options)
  const resolvedOptions = options
  const callback = cb

  rimraf_(p, resolvedOptions, function CB (er) {
    if (er) {
      if ((er.code === 'EBUSY' || er.code === 'ENOTEMPTY' || er.code === 'EPERM') &&
          busyTries < resolvedOptions.maxBusyTries) {
        busyTries++
        const time = busyTries * 100
        // try again, with the same exact callback as this one.
        return setTimeout(() => rimraf_(p, resolvedOptions, CB), time)
      }

      // already gone
      if (er.code === 'ENOENT') er = null
    }

    callback(er)
  })
}

// Two possible strategies.
// 1. Assume it's a file.  unlink it, then do the dir stuff on EPERM or EISDIR
// 2. Assume it's a directory.  readdir, then do the file stuff on ENOTDIR
//
// Both result in an extra syscall when you guess wrong.  However, there
// are likely far more normal files in the world than directories.  This
// is based on the assumption that a the average number of files per
// directory is >= 1.
//
// If anyone ever complains about this, then I guess the strategy could
// be made configurable somehow.  But until then, YAGNI.
function rimraf_ (p: string, options: Options, cb: Done): void {
  assert(p)
  assert(options)
  assert(typeof cb === 'function')

  // sunos lets the root user unlink directories, which is... weird.
  // so we have to lstat here and make sure it's not a dir.
  options.lstat(p, (er, st) => {
    if (er && er.code === 'ENOENT') {
      return cb(null)
    }

    // Windows can EPERM on stat.  Life is suffering.
    if (er && er.code === 'EPERM' && isWindows) {
      return fixWinEPERM(p, options, er, cb)
    }

    if (st && st.isDirectory()) {
      return rmdir(p, options, er, cb)
    }

    options.unlink(p, er => {
      if (er) {
        if (er.code === 'ENOENT') {
          return cb(null)
        }
        if (er.code === 'EPERM') {
          return (isWindows)
            ? fixWinEPERM(p, options, er, cb)
            : rmdir(p, options, er, cb)
        }
        if (er.code === 'EISDIR') {
          return rmdir(p, options, er, cb)
        }
      }
      return cb(er)
    })
  })
}

function fixWinEPERM (p: string, options: Options, er: NodeJS.ErrnoException, cb: Done): void {
  assert(p)
  assert(options)
  assert(typeof cb === 'function')

  options.chmod(p, 0o666, er2 => {
    if (er2) {
      cb(er2.code === 'ENOENT' ? null : er)
    } else {
      options.stat(p, (er3, stats) => {
        if (er3) {
          cb(er3.code === 'ENOENT' ? null : er)
        } else if (stats.isDirectory()) {
          rmdir(p, options, er, cb)
        } else {
          options.unlink(p, cb)
        }
      })
    }
  })
}

function fixWinEPERMSync (p: string, options: Options, er: unknown): void {
  let stats

  assert(p)
  assert(options)

  try {
    options.chmodSync(p, 0o666)
  } catch (er2) {
    const code = er2 && typeof er2 === 'object' && 'code' in er2 ? er2.code : undefined
    if (code === 'ENOENT') {
      return
    } else {
      throw er
    }
  }

  try {
    stats = options.statSync(p)
  } catch (er3) {
    const code = er3 && typeof er3 === 'object' && 'code' in er3 ? er3.code : undefined
    if (code === 'ENOENT') {
      return
    } else {
      throw er
    }
  }

  if (stats.isDirectory()) {
    rmdirSync(p, options, er)
  } else {
    options.unlinkSync(p)
  }
}

function rmdir (p: string, options: Options, originalEr: NodeJS.ErrnoException | null, cb: Done): void {
  assert(p)
  assert(options)
  assert(typeof cb === 'function')

  // try to rmdir first, and only readdir on ENOTEMPTY or EEXIST (SunOS)
  // if we guessed wrong, and it's not a directory, then
  // raise the original error.
  options.rmdir(p, er => {
    if (er && (er.code === 'ENOTEMPTY' || er.code === 'EEXIST' || er.code === 'EPERM')) {
      rmkids(p, options, cb)
    } else if (er && er.code === 'ENOTDIR') {
      cb(originalEr)
    } else {
      cb(er)
    }
  })
}

function rmkids (p: string, options: Options, cb: Done): void {
  assert(p)
  assert(options)
  assert(typeof cb === 'function')

  options.readdir(p, (er, files) => {
    if (er) return cb(er)

    let n = files.length
    let errState: NodeJS.ErrnoException | undefined

    if (n === 0) return options.rmdir(p, cb)

    files.forEach(f => {
      rimraf(path.join(p, f), options, er => {
        if (errState) {
          return
        }
        if (er) return cb(errState = er)
        if (--n === 0) {
          options.rmdir(p, cb)
        }
      })
    })
  })
}

// this looks simpler, and is strictly *faster*, but will
// tie up the JavaScript thread and fail on excessively
// deep directory trees.
function rimrafSync (p: PathLike, options?: Partial<Options> | null): void {
  let st

  options = options || {}
  defaults(options)

  assert(p, 'rimraf: missing path')
  assert.strictEqual(typeof p, 'string', 'rimraf: path should be a string')
  if (typeof p !== 'string') return
  assert(options, 'rimraf: missing options')
  assert.strictEqual(typeof options, 'object', 'rimraf: options should be object')

  try {
    st = options.lstatSync(p)
  } catch (er) {
    const code = er && typeof er === 'object' && 'code' in er ? er.code : undefined
    if (code === 'ENOENT') {
      return
    }

    // Windows can EPERM on stat.  Life is suffering.
    if (code === 'EPERM' && isWindows) {
      fixWinEPERMSync(p, options, er)
    }
  }

  try {
    // sunos lets the root user unlink directories, which is... weird.
    if (st && st.isDirectory()) {
      rmdirSync(p, options, null)
    } else {
      options.unlinkSync(p)
    }
  } catch (er) {
    const code = er && typeof er === 'object' && 'code' in er ? er.code : undefined
    if (code === 'ENOENT') {
      return
    } else if (code === 'EPERM') {
      return isWindows ? fixWinEPERMSync(p, options, er) : rmdirSync(p, options, er)
    } else if (code !== 'EISDIR') {
      throw er
    }
    rmdirSync(p, options, er)
  }
}

function rmdirSync (p: string, options: Options, originalEr: unknown): void {
  assert(p)
  assert(options)

  try {
    options.rmdirSync(p)
  } catch (er) {
    const code = er && typeof er === 'object' && 'code' in er ? er.code : undefined
    if (code === 'ENOTDIR') {
      throw originalEr
    } else if (code === 'ENOTEMPTY' || code === 'EEXIST' || code === 'EPERM') {
      rmkidsSync(p, options)
    } else if (code !== 'ENOENT') {
      throw er
    }
  }
}

function rmkidsSync (p: string, options: Options): void {
  assert(p)
  assert(options)
  options.readdirSync(p).forEach(f => rimrafSync(path.join(p, f), options))

  if (isWindows) {
    // We only end up here once we got ENOTEMPTY at least once, and
    // at this point, we are guaranteed to have removed all the kids.
    // So, we know that it won't be ENOENT or ENOTDIR or anything else.
    // try really hard to delete stuff on windows, because it has a
    // PROFOUNDLY annoying habit of not closing handles promptly when
    // files are deleted, resulting in spurious ENOTEMPTY errors.
    const startTime = Date.now()
    do {
      try {
        const ret = options.rmdirSync(p, options)
        return ret
      } catch {}
    } while (Date.now() - startTime < 500) // give up after 500ms
  } else {
    const ret = options.rmdirSync(p, options)
    return ret
  }
}

export = Object.assign(rimraf, { sync: rimrafSync })
