import fs from 'node:fs'
import type { Stats } from 'node:fs'
import type { Callback, Options } from './types'

function checkPathExt(path: string, options: Options) {
  var pathext: string | string[] | undefined = options.pathExt !== undefined ?
    options.pathExt : process.env.PATHEXT

  if (!pathext) {
    return true
  }

  pathext = pathext.split(';')
  if (pathext.indexOf('') !== -1) {
    return true
  }
  for (var i = 0; i < pathext.length; i++) {
    var p = pathext[i].toLowerCase()
    if (p && path.substr(-p.length).toLowerCase() === p) {
      return true
    }
  }
  return false
}

function checkStat(stat: Stats, path: string, options: Options) {
  if (!stat.isSymbolicLink() && !stat.isFile()) {
    return false
  }
  return checkPathExt(path, options)
}

function isexe(path: string, options: Options, cb: Callback) {
  fs.stat(path, function (er, stat) {
    cb(er, er ? false : checkStat(stat, path, options))
  })
}

function sync(path: string, options: Options) {
  return checkStat(fs.statSync(path), path, options)
}
export = Object.assign(isexe, { sync })
