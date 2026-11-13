import path from 'node:path'
import fs from 'graceful-fs'
import universalify from '../../universalify'
import mkdir from '../mkdirs'
import pathExistence from '../path-exists'
import stat from '../util/stat'

const { pathExists } = pathExistence
const { areIdentical } = stat
type Done = (error?: unknown) => void

function createLink(srcpath: string, dstpath: string, callback: Done) {
  function makeLink(srcpath: string, dstpath: string) {
    fs.link(srcpath, dstpath, err => {
      if (err) return callback(err)
      callback(null)
    })
  }

  fs.lstat(dstpath, (_, dstStat) => {
    fs.lstat(srcpath, (err, srcStat) => {
      if (err) {
        err.message = err.message.replace('lstat', 'ensureLink')
        return callback(err)
      }
      if (dstStat && areIdentical(srcStat, dstStat)) return callback(null)

      const dir = path.dirname(dstpath)
      pathExists(dir, (err, dirExists) => {
        if (err) return callback(err)
        if (dirExists) return makeLink(srcpath, dstpath)
        mkdir.mkdirs(dir, undefined, err => {
          if (err) return callback(err)
          makeLink(srcpath, dstpath)
        })
      })
    })
  })
}

function createLinkSync(srcpath: string, dstpath: string) {
  let dstStat
  try {
    dstStat = fs.lstatSync(dstpath)
  } catch {
    // A missing destination can be linked below.
  }

  try {
    const srcStat = fs.lstatSync(srcpath)
    if (dstStat && areIdentical(srcStat, dstStat)) return
  } catch (err) {
    if (err instanceof Error) err.message = err.message.replace('lstat', 'ensureLink')
    throw err
  }

  const dir = path.dirname(dstpath)
  const dirExists = fs.existsSync(dir)
  if (dirExists) return fs.linkSync(srcpath, dstpath)
  mkdir.mkdirsSync(dir)

  return fs.linkSync(srcpath, dstpath)
}

export = {
  createLink: universalify.fromCallback<unknown, [string, string], void>(createLink),
  createLinkSync
}
