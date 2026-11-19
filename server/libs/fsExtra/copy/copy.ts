import fs from 'graceful-fs'
import path from 'node:path'
import type { BigIntStats, Stats } from 'node:fs'
import mkdirsModule from '../mkdirs'
import pathExistsModule from '../path-exists'
import utimesMillisModule from '../util/utimes'
import stat from '../util/stat'
import type { CopyOptions, CopyFilter } from './types'

const { mkdirs } = mkdirsModule
const { pathExists } = pathExistsModule
const { utimesMillis } = utimesMillisModule

type Done = (error?: unknown) => void

function copy (src: string, dest: string, opts?: CopyOptions | CopyFilter | Done | null, cb?: Done): void {
  // A function in the options position is a filter only when a callback follows it.
  let options: CopyOptions
  if (typeof opts === 'function') {
    if (cb) {
      options = { filter: opts as CopyFilter }
    } else {
      cb = opts as Done
      options = {}
    }
  } else {
    options = opts || {}
  }
  const done = cb || function () { /* Callback is optional when called directly. */ }

  options.clobber = 'clobber' in options ? !!options.clobber : true // default to true for now
  options.overwrite = 'overwrite' in options ? !!options.overwrite : options.clobber // overwrite falls back to clobber

  // Warn about using preserveTimestamps on 32-bit node
  if (options.preserveTimestamps && process.arch === 'ia32') {
    process.emitWarning(
      'Using the preserveTimestamps option in 32-bit node is not recommended;\n\n' +
      '\tsee https://github.com/jprichardson/node-fs-extra/issues/269',
      'Warning', 'fs-extra-WARN0001'
    )
  }

  stat.checkPaths(src, dest, 'copy', options, (err, stats) => {
    if (err || !stats) return done(err)
    const { srcStat, destStat } = stats
    stat.checkParentPaths(src, srcStat, dest, 'copy', err => {
      if (err) return done(err)
      if (options.filter) return handleFilter(options.filter, checkParentDir, destStat, src, dest, options, done)
      return checkParentDir(destStat, src, dest, options, done)
    })
  })
}

function checkParentDir (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  const destParent = path.dirname(dest)
  pathExists(destParent, (err, dirExists) => {
    if (err) return cb(err)
    if (dirExists) return getStats(destStat, src, dest, opts, cb)
    mkdirs(destParent, undefined, err => {
      if (err) return cb(err)
      return getStats(destStat, src, dest, opts, cb)
    })
  })
}

function handleFilter (filter: CopyFilter, onInclude: typeof getStats, destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  void Promise.resolve(filter.call(opts, src, dest)).then(include => {
    if (include) return onInclude(destStat, src, dest, opts, cb)
    return cb()
  }, error => cb(error))
}

function startCopy (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  if (opts.filter) return handleFilter(opts.filter, getStats, destStat, src, dest, opts, cb)
  return getStats(destStat, src, dest, opts, cb)
}

function getStats (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  const stat = opts.dereference ? fs.stat : fs.lstat
  stat(src, (err, srcStat) => {
    if (err) return cb(err)

    if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts, cb)
    else if (srcStat.isFile() ||
             srcStat.isCharacterDevice() ||
             srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts, cb)
    else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts, cb)
    else if (srcStat.isSocket()) return cb(new Error(`Cannot copy a socket file: ${src}`))
    else if (srcStat.isFIFO()) return cb(new Error(`Cannot copy a FIFO pipe: ${src}`))
    return cb(new Error(`Unknown file: ${src}`))
  })
}

function onFile (srcStat: Stats, destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  if (!destStat) return copyFile(srcStat, src, dest, opts, cb)
  return mayCopyFile(srcStat, src, dest, opts, cb)
}

function mayCopyFile (srcStat: Stats, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  if (opts.overwrite) {
    fs.unlink(dest, err => {
      if (err) return cb(err)
      return copyFile(srcStat, src, dest, opts, cb)
    })
  } else if (opts.errorOnExist) {
    return cb(new Error(`'${dest}' already exists`))
  } else return cb()
}

function copyFile (srcStat: Stats, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  fs.copyFile(src, dest, err => {
    if (err) return cb(err)
    if (opts.preserveTimestamps) return handleTimestampsAndMode(srcStat.mode, src, dest, cb)
    return setDestMode(dest, srcStat.mode, cb)
  })
}

function handleTimestampsAndMode (srcMode: number, src: string, dest: string, cb: Done): void {
  // Make sure the file is writable before setting the timestamp
  // otherwise open fails with EPERM when invoked with 'r+'
  // (through utimes call)
  if (fileIsNotWritable(srcMode)) {
    return makeFileWritable(dest, srcMode, err => {
      if (err) return cb(err)
      return setDestTimestampsAndMode(srcMode, src, dest, cb)
    })
  }
  return setDestTimestampsAndMode(srcMode, src, dest, cb)
}

function fileIsNotWritable (srcMode: number) {
  return (srcMode & 0o200) === 0
}

function makeFileWritable (dest: string, srcMode: number, cb: Done): void {
  return setDestMode(dest, srcMode | 0o200, cb)
}

function setDestTimestampsAndMode (srcMode: number, src: string, dest: string, cb: Done): void {
  setDestTimestamps(src, dest, err => {
    if (err) return cb(err)
    return setDestMode(dest, srcMode, cb)
  })
}

function setDestMode (dest: string, srcMode: number, cb: Done): void {
  return fs.chmod(dest, srcMode, cb)
}

function setDestTimestamps (src: string, dest: string, cb: Done): void {
  // The initial srcStat.atime cannot be trusted
  // because it is modified by the read(2) system call
  // (See https://nodejs.org/api/fs.html#fs_stat_time_values)
  fs.stat(src, (err, updatedSrcStat) => {
    if (err) return cb(err)
    return utimesMillis(dest, updatedSrcStat.atime, updatedSrcStat.mtime, cb)
  })
}

function onDir (srcStat: Stats, destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts, cb)
  return copyDir(src, dest, opts, cb)
}

function mkDirAndCopy (srcMode: number, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  fs.mkdir(dest, err => {
    if (err) return cb(err)
    copyDir(src, dest, opts, err => {
      if (err) return cb(err)
      return setDestMode(dest, srcMode, cb)
    })
  })
}

function copyDir (src: string, dest: string, opts: CopyOptions, cb: Done): void {
  fs.readdir(src, (err, items) => {
    if (err) return cb(err)
    return copyDirItems(items, src, dest, opts, cb)
  })
}

function copyDirItems (items: string[], src: string, dest: string, opts: CopyOptions, cb: Done): void {
  const item = items.pop()
  if (!item) return cb()
  return copyDirItem(items, item, src, dest, opts, cb)
}

function copyDirItem (items: string[], item: string, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  const srcItem = path.join(src, item)
  const destItem = path.join(dest, item)
  stat.checkPaths(srcItem, destItem, 'copy', opts, (err, stats) => {
    if (err || !stats) return cb(err)
    const { destStat } = stats
    startCopy(destStat, srcItem, destItem, opts, err => {
      if (err) return cb(err)
      return copyDirItems(items, src, dest, opts, cb)
    })
  })
}

function onLink (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions, cb: Done): void {
  fs.readlink(src, (err, resolvedSrc) => {
    if (err) return cb(err)
    if (opts.dereference) {
      resolvedSrc = path.resolve(process.cwd(), resolvedSrc)
    }

    if (!destStat) {
      return fs.symlink(resolvedSrc, dest, cb)
    } else {
      fs.readlink(dest, (err, resolvedDest) => {
        if (err) {
          // dest exists and is a regular file or directory,
          // Windows may throw UNKNOWN error. If dest already exists,
          // fs throws error anyway, so no need to guard against it here.
          if (err.code === 'EINVAL' || err.code === 'UNKNOWN') return fs.symlink(resolvedSrc, dest, cb)
          return cb(err)
        }
        if (opts.dereference) {
          resolvedDest = path.resolve(process.cwd(), resolvedDest)
        }
        if (stat.isSrcSubdir(resolvedSrc, resolvedDest)) {
          return cb(new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`))
        }

        // do not copy if src is a subdir of dest since unlinking
        // dest in this case would result in removing src contents
        // and therefore a broken symlink would be created.
        if (destStat.isDirectory() && stat.isSrcSubdir(resolvedDest, resolvedSrc)) {
          return cb(new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`))
        }
        return copyLink(resolvedSrc, dest, cb)
      })
    }
  })
}

function copyLink (resolvedSrc: string, dest: string, cb: Done): void {
  fs.unlink(dest, err => {
    if (err) return cb(err)
    return fs.symlink(resolvedSrc, dest, cb)
  })
}

export = copy
