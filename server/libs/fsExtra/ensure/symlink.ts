import { createRequire } from 'node:module'
import type { lstat, lstatSync, statSync, existsSync, symlink, symlinkSync, Stats } from 'node:fs'
import path from 'node:path'
import universalify from '../../universalify'
import mkdir from '../mkdirs'
import pathExistence from '../path-exists'
import stat from '../util/stat'
import paths from './symlink-paths'
import types from './symlink-type'

const { mkdirs, mkdirsSync } = mkdir
const { symlinkPaths, symlinkPathsSync } = paths
const { symlinkType, symlinkTypeSync } = types
const { pathExists } = pathExistence
const { areIdentical } = stat
const fs = createRequire(__filename)('../fs') as {
  lstat: typeof lstat
  lstatSync: typeof lstatSync
  stat(file: string): Promise<Stats>
  statSync: typeof statSync
  existsSync: typeof existsSync
  symlink: typeof symlink
  symlinkSync: typeof symlinkSync
}
type LinkType = 'file' | 'dir' | 'junction' | false | null | undefined
type Done = (error?: unknown) => void

function createSymlink(srcpath: string, dstpath: string, type: LinkType | Done, callback?: Done) {
  const done = typeof type === 'function' ? type : callback
  const requestedType = typeof type === 'function' ? false : type
  if (!done) throw new TypeError('Expected a symlink callback')

  fs.lstat(dstpath, (err, stats) => {
    if (!err && stats.isSymbolicLink()) {
      void Promise.all([
        fs.stat(srcpath),
        fs.stat(dstpath)
      ]).then(([srcStat, dstStat]) => {
        if (areIdentical(srcStat, dstStat)) return done(null)
        _createSymlink(srcpath, dstpath, requestedType, done)
      })
    } else _createSymlink(srcpath, dstpath, requestedType, done)
  })
}

function _createSymlink(srcpath: string, dstpath: string, type: LinkType, callback: Done) {
  symlinkPaths(srcpath, dstpath, (err, relative) => {
    if (err || !relative) return callback(err)
    srcpath = relative.toDst
    symlinkType(relative.toCwd, type, (err, type) => {
      if (err) return callback(err)
      const dir = path.dirname(dstpath)
      pathExists(dir, (err, dirExists) => {
        if (err) return callback(err)
        if (dirExists) return fs.symlink(srcpath, dstpath, type, callback)
        mkdirs(dir, undefined, err => {
          if (err) return callback(err)
          fs.symlink(srcpath, dstpath, type, callback)
        })
      })
    })
  })
}

function createSymlinkSync(srcpath: string, dstpath: string, type?: LinkType) {
  let stats
  try {
    stats = fs.lstatSync(dstpath)
  } catch {
    // A missing destination can be linked below.
  }
  if (stats && stats.isSymbolicLink()) {
    const srcStat = fs.statSync(srcpath)
    const dstStat = fs.statSync(dstpath)
    if (areIdentical(srcStat, dstStat)) return
  }

  const relative = symlinkPathsSync(srcpath, dstpath)
  srcpath = relative.toDst
  type = symlinkTypeSync(relative.toCwd, type)
  const dir = path.dirname(dstpath)
  const exists = fs.existsSync(dir)
  if (exists) return fs.symlinkSync(srcpath, dstpath, type)
  mkdirsSync(dir)
  return fs.symlinkSync(srcpath, dstpath, type)
}

interface CreateSymlink {
  (src: string, dst: string, type?: LinkType): Promise<void>
  (src: string, dst: string, callback: Done): void
  (src: string, dst: string, type: LinkType, callback: Done): void
}

// The callback also occupies the optional type position when callers omit it.
const wrappedSymlink = universalify.fromCallback<unknown, [string, string, LinkType], void>(createSymlink) as CreateSymlink

export = {
  createSymlink: wrappedSymlink,
  createSymlinkSync
}
