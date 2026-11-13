import fs from 'graceful-fs'
import path from 'node:path'
import copyModule from '../copy'
import removeModule from '../remove'
import mkdir from '../mkdirs'
import stat from '../util/stat'
import type { MoveOptions } from './types'

const { copySync } = copyModule
const { removeSync } = removeModule
const { mkdirpSync } = mkdir

function moveSync (src: string, dest: string, opts?: MoveOptions | null) {
  opts = opts || {}
  const overwrite = opts.overwrite || opts.clobber || false

  const { srcStat, isChangingCase = false } = stat.checkPathsSync(src, dest, 'move', opts)
  stat.checkParentPathsSync(src, srcStat, dest, 'move')
  if (!isParentRoot(dest)) mkdirpSync(path.dirname(dest))
  return doRename(src, dest, overwrite, isChangingCase)
}

function isParentRoot (dest: string) {
  const parent = path.dirname(dest)
  const parsedPath = path.parse(parent)
  return parsedPath.root === parent
}

function doRename (src: string, dest: string, overwrite: boolean, isChangingCase: boolean) {
  if (isChangingCase) return rename(src, dest, overwrite)
  if (overwrite) {
    removeSync(dest)
    return rename(src, dest, overwrite)
  }
  if (fs.existsSync(dest)) throw new Error('dest already exists.')
  return rename(src, dest, overwrite)
}

function rename (src: string, dest: string, overwrite: boolean) {
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    if (!err || typeof err !== 'object' || !('code' in err) || err.code !== 'EXDEV') throw err
    return moveAcrossDevice(src, dest, overwrite)
  }
}

function moveAcrossDevice (src: string, dest: string, overwrite: boolean) {
  const opts = {
    overwrite,
    errorOnExist: true
  }
  copySync(src, dest, opts)
  return removeSync(src)
}

export = moveSync
