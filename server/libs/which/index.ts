//
// used by fluentFfmpeg
// SOURCE: https://github.com/isaacs/isexe
//

import path from 'node:path'
import isexe from '../isexe'

interface Options {
  colon?: string
  path?: string
  pathExt?: string
  all?: boolean
  nothrow?: boolean
}

type Callback<Result> = (error: NodeJS.ErrnoException | null, result?: Result) => void

const isWindows = process.platform === 'win32' ||
  process.env.OSTYPE === 'cygwin' ||
  process.env.OSTYPE === 'msys'

const COLON = isWindows ? ';' : ':'

const getNotFoundError = (cmd: string) =>
  Object.assign(new Error(`not found: ${cmd}`), { code: 'ENOENT' })

const getPathInfo = (cmd: string, opt: Options) => {
  const colon = opt.colon || COLON

  // If it has a slash, then we don't bother searching the pathenv.
  // just check the file itself, and that's it.
  const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? ['']
    : (
      [
        // windows always checks the cwd first
        ...(isWindows ? [process.cwd()] : []),
        ...(opt.path || process.env.PATH ||
          /* istanbul ignore next: very unusual */ '').split(colon),
      ]
    )
  const pathExtExe = isWindows
    ? opt.pathExt || process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM'
    : ''
  const pathExt = isWindows ? pathExtExe.split(colon) : ['']

  if (isWindows) {
    if (cmd.indexOf('.') !== -1 && pathExt[0] !== '')
      pathExt.unshift('')
  }

  return {
    pathEnv,
    pathExt,
    pathExtExe,
  }
}

function which(cmd: string, opt: Options & { all: true }): Promise<string[]>
function which(cmd: string, opt?: Options & { all?: false }): Promise<string>
function which(cmd: string, opt?: Options): Promise<string | string[]>
function which(cmd: string, cb: Callback<string>): Promise<void>
function which(cmd: string, opt: Options & { all: true }, cb: Callback<string[]>): Promise<void>
function which(cmd: string, opt: Options & { all?: false }, cb: Callback<string>): Promise<void>
function which(cmd: string, opt: Options, cb: Callback<string | string[]>): Promise<void>
function which(cmd: string, opt?: Options | Callback<string>, cb?: Callback<string> | Callback<string[]> | Callback<string | string[]>): Promise<string | string[] | void> {
  if (typeof opt === 'function') {
    cb = opt
    opt = {}
  }
  const options = opt || {}

  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, options)
  const found: string[] = []

  const step = (i: number): Promise<string | string[]> => new Promise((resolve, reject) => {
    if (i === pathEnv.length)
      return options.all && found.length ? resolve(found)
        : reject(getNotFoundError(cmd))

    const ppRaw = pathEnv[i]
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw

    const pCmd = path.join(pathPart, cmd)
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd
      : pCmd

    resolve(subStep(p, i, 0))
  })

  const subStep = (p: string, i: number, ii: number): Promise<string | string[]> => new Promise((resolve) => {
    if (ii === pathExt.length)
      return resolve(step(i + 1))
    const ext = pathExt[ii]
    isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
      if (!er && is) {
        if (options.all)
          found.push(p + ext)
        else
          return resolve(p + ext)
      }
      return resolve(subStep(p, i, ii + 1))
    })
  })

  // The callback overload matches the result selected by options.all.
  const callback = cb as Callback<string | string[]> | undefined
  return callback ? step(0).then(res => callback(null, res), (error: NodeJS.ErrnoException) => callback(error)) : step(0)
}

function whichSync(cmd: string, opt: Options & { all: true; nothrow: true }): string[] | null
function whichSync(cmd: string, opt: Options & { all: true; nothrow?: false }): string[]
function whichSync(cmd: string, opt: Options & { all?: false; nothrow: true }): string | null
function whichSync(cmd: string, opt?: Options & { all?: false; nothrow?: false }): string
function whichSync(cmd: string, opt?: Options): string | string[] | null
function whichSync(cmd: string, opt?: Options): string | string[] | null {
  opt = opt || {}

  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt)
  const found: string[] = []

  for (let i = 0; i < pathEnv.length; i++) {
    const ppRaw = pathEnv[i]
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw

    const pCmd = path.join(pathPart, cmd)
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd
      : pCmd

    for (let j = 0; j < pathExt.length; j++) {
      const cur = p + pathExt[j]
      try {
        const is = isexe.sync(cur, { pathExt: pathExtExe })
        if (is) {
          if (opt.all)
            found.push(cur)
          else
            return cur
        }
      } catch {
        // Continue searching when the candidate cannot be accessed.
      }
    }
  }

  if (opt.all && found.length)
    return found

  if (opt.nothrow)
    return null

  throw getNotFoundError(cmd)
}

export = Object.assign(which, { sync: whichSync })