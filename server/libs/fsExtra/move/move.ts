import fs from 'graceful-fs'
import path from 'node:path'
import copyModule from '../copy'
import removeModule from '../remove'
import mkdir from '../mkdirs'
import pathExistence from '../path-exists'
import stat from '../util/stat'
import type { MoveOptions } from './types'

const { copy } = copyModule
const { remove } = removeModule
const { mkdirp } = mkdir
const { pathExists } = pathExistence
type Done = (error?: unknown) => void

function move (src: string, dest: string, opts: MoveOptions | Done | null | undefined, callback?: Done) {
  const cb = typeof opts === 'function' ? opts : callback
  if (!cb) throw new TypeError('Expected a move callback')
  opts = typeof opts === 'function' ? {} : opts || {}

  const overwrite = opts.overwrite || opts.clobber || false

  stat.checkPaths(src, dest, 'move', opts, (err, stats) => {
    if (err || !stats) return cb(err)
    const { srcStat, isChangingCase = false } = stats
    stat.checkParentPaths(src, srcStat, dest, 'move', err => {
      if (err) return cb(err)
      if (isParentRoot(dest)) return doRename(src, dest, overwrite, isChangingCase, cb)
      mkdirp(path.dirname(dest), undefined, err => {
        if (err) return cb(err)
        return doRename(src, dest, overwrite, isChangingCase, cb)
      })
    })
  })
}

function isParentRoot (dest: string) {
  const parent = path.dirname(dest)
  const parsedPath = path.parse(parent)
  return parsedPath.root === parent
}

function doRename (src: string, dest: string, overwrite: boolean, isChangingCase: boolean, cb: Done) {
  if (isChangingCase) return rename(src, dest, overwrite, cb)
  if (overwrite) {
    return remove(dest, (err: unknown) => {
      if (err) return cb(err)
      return rename(src, dest, overwrite, cb)
    })
  }
  pathExists(dest, (err, destExists) => {
    if (err) return cb(err)
    if (destExists) return cb(new Error('dest already exists.'))
    return rename(src, dest, overwrite, cb)
  })
}

function rename (src: string, dest: string, overwrite: boolean, cb: Done) {
  fs.rename(src, dest, err => {
    if (!err) return cb()
    if (err.code !== 'EXDEV') return cb(err)
    return moveAcrossDevice(src, dest, overwrite, cb)
  })
}

function moveAcrossDevice (src: string, dest: string, overwrite: boolean, cb: Done) {
  const opts = {
    overwrite,
    errorOnExist: true
  }
  copy(src, dest, opts, (err: unknown) => {
    if (err) return cb(err)
    return remove(src, cb)
  })
}

export = move
