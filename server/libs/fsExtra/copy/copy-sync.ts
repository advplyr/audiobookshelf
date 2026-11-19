import fs from 'graceful-fs'
import path from 'node:path'
import type { BigIntStats, Stats } from 'node:fs'
import mkdirsSyncModule from '../mkdirs'
import utimesMillisSyncModule from '../util/utimes'
import stat from '../util/stat'
import type { CopyOptions, SyncCopyFilter } from './types'

const { mkdirsSync } = mkdirsSyncModule
const { utimesMillisSync } = utimesMillisSyncModule

function copySync (src: string, dest: string, opts?: CopyOptions<SyncCopyFilter> | SyncCopyFilter | null) {
  if (typeof opts === 'function') {
    opts = { filter: opts }
  }

  opts = opts || {}
  opts.clobber = 'clobber' in opts ? !!opts.clobber : true // default to true for now
  opts.overwrite = 'overwrite' in opts ? !!opts.overwrite : opts.clobber // overwrite falls back to clobber

  // Warn about using preserveTimestamps on 32-bit node
  if (opts.preserveTimestamps && process.arch === 'ia32') {
    process.emitWarning(
      'Using the preserveTimestamps option in 32-bit node is not recommended;\n\n' +
      '\tsee https://github.com/jprichardson/node-fs-extra/issues/269',
      'Warning', 'fs-extra-WARN0002'
    )
  }

  const { srcStat, destStat } = stat.checkPathsSync(src, dest, 'copy', opts)
  stat.checkParentPathsSync(src, srcStat, dest, 'copy')
  return handleFilterAndCopy(destStat, src, dest, opts)
}

function handleFilterAndCopy (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>): void {
  if (opts.filter && !opts.filter(src, dest)) return
  const destParent = path.dirname(dest)
  if (!fs.existsSync(destParent)) mkdirsSync(destParent)
  return getStats(destStat, src, dest, opts)
}

function startCopy (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>): void {
  if (opts.filter && !opts.filter(src, dest)) return
  return getStats(destStat, src, dest, opts)
}

function getStats (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>): void {
  const statSync = opts.dereference ? fs.statSync : fs.lstatSync
  const srcStat = statSync(src)

  if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts)
  else if (srcStat.isFile() ||
           srcStat.isCharacterDevice() ||
           srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts)
  else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts)
  else if (srcStat.isSocket()) throw new Error(`Cannot copy a socket file: ${src}`)
  else if (srcStat.isFIFO()) throw new Error(`Cannot copy a FIFO pipe: ${src}`)
  throw new Error(`Unknown file: ${src}`)
}

function onFile (srcStat: Stats, destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>) {
  if (!destStat) return copyFile(srcStat, src, dest, opts)
  return mayCopyFile(srcStat, src, dest, opts)
}

function mayCopyFile (srcStat: Stats, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>) {
  if (opts.overwrite) {
    fs.unlinkSync(dest)
    return copyFile(srcStat, src, dest, opts)
  } else if (opts.errorOnExist) {
    throw new Error(`'${dest}' already exists`)
  }
}

function copyFile (srcStat: Stats, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>) {
  fs.copyFileSync(src, dest)
  if (opts.preserveTimestamps) handleTimestamps(srcStat.mode, src, dest)
  return setDestMode(dest, srcStat.mode)
}

function handleTimestamps (srcMode: number, src: string, dest: string) {
  // Make sure the file is writable before setting the timestamp
  // otherwise open fails with EPERM when invoked with 'r+'
  // (through utimes call)
  if (fileIsNotWritable(srcMode)) makeFileWritable(dest, srcMode)
  return setDestTimestamps(src, dest)
}

function fileIsNotWritable (srcMode: number) {
  return (srcMode & 0o200) === 0
}

function makeFileWritable (dest: string, srcMode: number) {
  return setDestMode(dest, srcMode | 0o200)
}

function setDestMode (dest: string, srcMode: number) {
  return fs.chmodSync(dest, srcMode)
}

function setDestTimestamps (src: string, dest: string) {
  // The initial srcStat.atime cannot be trusted
  // because it is modified by the read(2) system call
  // (See https://nodejs.org/api/fs.html#fs_stat_time_values)
  const updatedSrcStat = fs.statSync(src)
  return utimesMillisSync(dest, updatedSrcStat.atime, updatedSrcStat.mtime)
}

function onDir (srcStat: Stats, destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>): void {
  if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts)
  return copyDir(src, dest, opts)
}

function mkDirAndCopy (srcMode: number, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>): void {
  fs.mkdirSync(dest)
  copyDir(src, dest, opts)
  return setDestMode(dest, srcMode)
}

function copyDir (src: string, dest: string, opts: CopyOptions<SyncCopyFilter>): void {
  fs.readdirSync(src).forEach(item => copyDirItem(item, src, dest, opts))
}

function copyDirItem (item: string, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>): void {
  const srcItem = path.join(src, item)
  const destItem = path.join(dest, item)
  const { destStat } = stat.checkPathsSync(srcItem, destItem, 'copy', opts)
  return startCopy(destStat, srcItem, destItem, opts)
}

function onLink (destStat: BigIntStats | null, src: string, dest: string, opts: CopyOptions<SyncCopyFilter>) {
  let resolvedSrc = fs.readlinkSync(src)
  if (opts.dereference) {
    resolvedSrc = path.resolve(process.cwd(), resolvedSrc)
  }

  if (!destStat) {
    return fs.symlinkSync(resolvedSrc, dest)
  } else {
    let resolvedDest
    try {
      resolvedDest = fs.readlinkSync(dest)
    } catch (err) {
      // dest exists and is a regular file or directory,
      // Windows may throw UNKNOWN error. If dest already exists,
      // fs throws error anyway, so no need to guard against it here.
      if (err && typeof err === 'object' && 'code' in err && (err.code === 'EINVAL' || err.code === 'UNKNOWN')) return fs.symlinkSync(resolvedSrc, dest)
      throw err
    }
    if (opts.dereference) {
      resolvedDest = path.resolve(process.cwd(), resolvedDest)
    }
    if (stat.isSrcSubdir(resolvedSrc, resolvedDest)) {
      throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`)
    }

    // prevent copy if src is a subdir of dest since unlinking
    // dest in this case would result in removing src contents
    // and therefore a broken symlink would be created.
    if (fs.statSync(dest).isDirectory() && stat.isSrcSubdir(resolvedDest, resolvedSrc)) {
      throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`)
    }
    return copyLink(resolvedSrc, dest)
  }
}

function copyLink (resolvedSrc: string, dest: string) {
  fs.unlinkSync(dest)
  return fs.symlinkSync(resolvedSrc, dest)
}

export = copySync
