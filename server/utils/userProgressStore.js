// server/utils/userProgressStore.js
const Path = require('path')
const fsx = require('../libs/fsExtra')

function dir () {
  // Persist under MetadataPath so it survives restarts/backups similar to other ABS data
  const root = global.MetadataPath || Path.join(process.cwd(), '.metadata')
  const p = Path.join(root, 'achievements')
  if (!fsx.pathExistsSync(p)) fsx.mkdirpSync(p)
  return p
}

function file (userId) {
  return Path.join(dir(), `${userId}.json`)
}

async function read (userId) {
  const f = file(userId)
  if (!fsx.pathExistsSync(f)) return null
  try {
    return JSON.parse(await fsx.readFile(f, 'utf8'))
  } catch {
    return null
  }
}

async function write (userId, data) {
  const f = file(userId)
  const payload = JSON.stringify(data, null, 2)

  // Your fs-extra wrapper doesn’t expose writeFileAtomic.
  // Use a safe fallback; prefer atomic (tmp + rename) when possible.
  try {
    if (typeof fsx.writeFileAtomic === 'function') {
      await fsx.writeFileAtomic(f, payload, 'utf8')
    } else {
      const tmp = f + '.tmp'
      await fsx.writeFile(tmp, payload, 'utf8')
      // Some wrappers expose rename, some move; fall back to writeFile
      if (typeof fsx.rename === 'function') {
        await fsx.rename(tmp, f)
      } else if (typeof fsx.move === 'function') {
        await fsx.move(tmp, f, { overwrite: true })
      } else {
        // last-resort non-atomic
        await fsx.writeFile(f, payload, 'utf8')
      }
    }
  } catch {
    // Non-atomic final fallback to guarantee progress is saved
    await fsx.writeFile(f, payload, 'utf8')
  }
}

module.exports = { read, write }
