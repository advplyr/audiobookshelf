//
// used by async
// SOURCE: https://github.com/isaacs/isexe
//

import { createRequire } from 'node:module'
import type { Callback, Options } from './types'
type Core = typeof import('./mode') | typeof import('./windows')

const load = createRequire(__filename)
var core: Core
if (process.platform === 'win32' || global.TESTING_WINDOWS) {
  core = load('./windows.js') as typeof import('./windows')
} else {
  core = load('./mode.js') as typeof import('./mode')
}

isexe.sync = sync

function isexe(path: string, options?: Options): Promise<boolean | number>
function isexe(path: string, cb: Callback): void
function isexe(path: string, options: Options, cb: Callback): void
function isexe(path: string, options?: Options | Callback, cb?: Callback): Promise<boolean | number> | void {
  if (typeof options === 'function') {
    cb = options
    options = {}
  }

  if (!cb) {
    if (typeof Promise !== 'function') {
      throw new TypeError('callback not provided')
    }

    return new Promise<boolean | number>(function (resolve, reject) {
      isexe(path, options || {}, function (er, is) {
        if (er) {
          reject(er)
        } else {
          resolve(is)
        }
      })
    })
  }

  const callback = cb
  core(path, options || {}, function (er, is) {
    // ignore EACCES because that just means we aren't allowed to run it
    if (er) {
      if (er.code === 'EACCES' || options && options.ignoreErrors) {
        er = null
        is = false
      }
    }
    callback(er, is)
  })
}

function sync(path: string, options?: Options) {
  // my kingdom for a filtered catch
  try {
    return core.sync(path, options || {})
  } catch (er) {
    if (options && options.ignoreErrors || (typeof er === 'object' && er !== null && 'code' in er && er.code === 'EACCES')) {
      return false
    } else {
      throw er
    }
  }
}

export = isexe
