import { createRequire } from 'node:module'
import path from 'node:path'
import universalify from '../../universalify'
import mkdir from '../mkdirs'
import remove from '../remove'

const fs = createRequire(__filename)('../fs') as {
  readdir(dir: string): Promise<string[]>
  readdirSync(dir: string): string[]
}

const emptyDir = universalify.fromPromise(async function emptyDir(dir: string) {
  let items
  try {
    items = await fs.readdir(dir)
  } catch {
    return mkdir.mkdirs(dir)
  }

  return Promise.all(items.map(item => remove.remove(path.join(dir, item))))
})

function emptyDirSync(dir: string) {
  let items
  try {
    items = fs.readdirSync(dir)
  } catch {
    return mkdir.mkdirsSync(dir)
  }

  items.forEach(item => {
    item = path.join(dir, item)
    remove.removeSync(item)
  })
}

export = {
  emptyDirSync,
  emptydirSync: emptyDirSync,
  emptyDir,
  emptydir: emptyDir
}
