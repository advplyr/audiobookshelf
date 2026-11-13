import type { PathLike } from 'node:fs'
import { createRequire } from 'node:module'
import universalify from '../../universalify'

// The embedded fs adapter provides the Promise overload for access.
const fs = createRequire(__filename)('../fs') as {
  access(path: PathLike): Promise<void>
  existsSync(this: void, path: PathLike): boolean
}

function pathExists(path: PathLike) {
  return fs.access(path).then(() => true).catch(() => false)
}

export = {
  pathExists: universalify.fromPromise(pathExists),
  pathExistsSync: fs.existsSync
}
