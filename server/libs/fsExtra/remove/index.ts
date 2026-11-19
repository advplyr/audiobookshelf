import fs from 'graceful-fs'
import type { PathLike } from 'node:fs'
import universalify from '../../universalify'
import rimraf from './rimraf'

type Done = (error?: NodeJS.ErrnoException | null) => void
const { fromCallback } = universalify

function remove(path: PathLike, callback: Done) {
  // Node 14.14.0+
  if (fs.rm) return fs.rm(path, { recursive: true, force: true }, callback)
  rimraf(path, callback)
}

function removeSync(path: PathLike) {
  // Node 14.14.0+
  if (fs.rmSync) return fs.rmSync(path, { recursive: true, force: true })
  rimraf.sync(path)
}

export = {
  remove: fromCallback(remove),
  removeSync
}
