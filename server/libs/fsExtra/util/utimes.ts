import fs from 'graceful-fs'
import type { PathLike, TimeLike, NoParamCallback } from 'node:fs'

function utimesMillis (path: PathLike, atime: TimeLike, mtime: TimeLike, callback: NoParamCallback) {
  // if (!HAS_MILLIS_RES) return fs.utimes(path, atime, mtime, callback)
  fs.open(path, 'r+', (err, fd) => {
    if (err) return callback(err)
    fs.futimes(fd, atime, mtime, futimesErr => {
      fs.close(fd, closeErr => {
        if (callback) callback(futimesErr || closeErr)
      })
    })
  })
}

function utimesMillisSync (path: PathLike, atime: TimeLike, mtime: TimeLike) {
  const fd = fs.openSync(path, 'r+')
  fs.futimesSync(fd, atime, mtime)
  return fs.closeSync(fd)
}

export = {
  utimesMillis,
  utimesMillisSync
}
