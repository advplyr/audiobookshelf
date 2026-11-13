import fs from 'graceful-fs'
import type { PathLike } from 'node:fs'

type LinkType = string
type TypeCallback = (error: null, type: LinkType) => void

function symlinkType (srcpath: PathLike, callback: TypeCallback): void
function symlinkType (srcpath: PathLike, type: LinkType | false | null | undefined, callback: TypeCallback): void
function symlinkType (srcpath: PathLike, type: LinkType | false | null | undefined | TypeCallback, callback?: TypeCallback) {
  const done = typeof type === 'function' ? type : callback
  const requestedType = typeof type === 'function' ? false : type
  if (!done) throw new TypeError('Expected a symlink type callback')
  if (requestedType) return done(null, requestedType)
  fs.lstat(srcpath, (err, stats) => {
    if (err) return done(null, 'file')
    done(null, (stats && stats.isDirectory()) ? 'dir' : 'file')
  })
}

function symlinkTypeSync (srcpath: PathLike, type?: LinkType | false | null) {
  let stats

  if (type) return type
  try {
    stats = fs.lstatSync(srcpath)
  } catch {
    return 'file'
  }
  return (stats && stats.isDirectory()) ? 'dir' : 'file'
}

export = {
  symlinkType,
  symlinkTypeSync
}
