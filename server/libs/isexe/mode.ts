import fs from 'node:fs'
import type { Stats } from 'node:fs'
import type { Callback, Options } from './types'

function isexe(path: string, options: Options, cb: Callback) {
  fs.stat(path, function (er, stat) {
    cb(er, er ? false : checkStat(stat, options))
  })
}

function sync(path: string, options: Options) {
  return checkStat(fs.statSync(path), options)
}

function checkStat(stat: Stats, options: Options) {
  return stat.isFile() && checkMode(stat, options)
}

function checkMode(stat: Stats, options: Options) {
  var mod = stat.mode
  var uid = stat.uid
  var gid = stat.gid

  var myUid = options.uid !== undefined ?
    options.uid : process.getuid && process.getuid()
  var myGid = options.gid !== undefined ?
    options.gid : process.getgid && process.getgid()

  var u = parseInt('100', 8)
  var g = parseInt('010', 8)
  var o = parseInt('001', 8)
  var ug = u | g

  var ret = (mod & o) ||
    (mod & g) && gid === myGid ||
    (mod & u) && uid === myUid ||
    (mod & ug) && myUid === 0

  return ret
}
export = Object.assign(isexe, { sync })
