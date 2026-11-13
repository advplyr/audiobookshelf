import universalify from '../../universalify'
import { makeDir as _makeDir, makeDirSync } from './make-dir'
const makeDir = universalify.fromPromise(_makeDir)

export = {
  mkdirs: makeDir,
  mkdirsSync: makeDirSync,
  // alias
  mkdirp: makeDir,
  mkdirpSync: makeDirSync,
  ensureDir: makeDir,
  ensureDirSync: makeDirSync
}
