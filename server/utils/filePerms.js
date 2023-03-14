const fs = require('../libs/fsExtra')
const Path = require('path')
const Logger = require('../Logger')

// Modified from:
// https://github.com/isaacs/chmodr/blob/master/chmodr.js

// If a party has r, add x
// so that dirs are listable
const dirMode = mode => {
  if (mode & 0o400)
    mode |= 0o100
  if (mode & 0o40)
    mode |= 0o10
  if (mode & 0o4)
    mode |= 0o1
  return mode
}

const chmodrKid = (p, child, mode, uid, gid, cb) => {
  if (typeof child === 'string')
    return fs.lstat(Path.resolve(p, child), (er, stats) => {
      if (er)
        return cb(er)
      stats.name = child
      chmodrKid(p, stats, mode, uid, gid, cb)
    })

  if (child.isDirectory()) {
    chmodr(Path.resolve(p, child.name), mode, uid, gid, er => {
      if (er)
        return cb(er)

      var _path = Path.resolve(p, child.name)
      fs.chmod(_path, dirMode(mode)).then(() => {
        fs.chown(_path, uid, gid, cb)
      })
    })
  } else {
    var _path = Path.resolve(p, child.name)
    fs.chmod(_path, mode).then(() => {
      fs.chown(_path, uid, gid, cb)
    })
  }
}


const chmodr = (p, mode, uid, gid, cb) => {
  fs.readdir(p, { withFileTypes: true }, (er, children) => {
    // any error other than ENOTDIR means it's not readable, or
    // doesn't exist.  give up.
    if (er && er.code !== 'ENOTDIR') return cb(er)
    if (er) { // Is a file
      return fs.chmod(p, mode).then(() => {
        fs.chown(p, uid, gid, cb)
      })
    }
    if (!children.length) {
      return fs.chmod(p, dirMode(mode)).then(() => {
        fs.chown(p, uid, gid, cb)
      })
    }

    let len = children.length
    let errState = null
    const then = er => {
      if (errState) return
      if (er) return cb(errState = er)
      if (--len === 0) {
        return fs.chmod(p, dirMode(mode)).then(() => {
          fs.chown(p, uid, gid, cb)
        })
      }
    }

    children.forEach(child => chmodrKid(p, child, mode, uid, gid, then))
  })
}

// Set custom permissions
module.exports.set = (path, mode, uid, gid, silent = false) => {
  return new Promise((resolve) => {
    if (!silent) Logger.debug(`[FilePerms] Setting permission "${mode}" for uid ${uid} and gid ${gid} | "${path}"`)
    chmodr(path, mode, uid, gid, resolve)
  })
}

// Default permissions 0o744 and global Uid/Gid
module.exports.setDefault = (path, silent = false) => {
  const mode = 0o744
  const uid = global.Uid
  const gid = global.Gid
  return new Promise((resolve) => {
    if (isNaN(uid) || isNaN(gid)) {
      if (!silent) Logger.debug('Not modifying permissions since no uid/gid is specified')
      return resolve()
    }
    if (!silent) Logger.debug(`Setting permission "${mode}" for uid ${uid} and gid ${gid} | "${path}"`)
    chmodr(path, mode, uid, gid, resolve)
  })
}

// Default permissions 0o744 and global Uid/Gid
//  Used for setting default permission to initial config/metadata directories
module.exports.setDefaultDirSync = (path, silent = false) => {
  const mode = 0o744
  const uid = global.Uid
  const gid = global.Gid
  if (isNaN(uid) || isNaN(gid)) {
    return true
  }
  if (!silent) Logger.debug(`[FilePerms] Setting dir permission "${mode}" for uid ${uid} and gid ${gid} | "${path}"`)
  try {
    fs.chmodSync(path, mode)
    fs.chownSync(path, uid, gid)
    return true
  } catch (error) {
    Logger.error(`[FilePerms] Error setting dir permissions for path "${path}"`, error)
    return false
  }
}