const { once } = require('events')
const { createInterface } = require('readline')
const Path = require('path')
const Logger = require('../../Logger')
const fs = require('../../libs/fsExtra')

async function processDbFile(filepath) {
  if (!fs.pathExistsSync(filepath)) {
    Logger.error(`[oldDbFiles] Db file does not exist at "${filepath}"`)
    return []
  }

  const entities = []

  try {
    const fileStream = fs.createReadStream(filepath)

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    rl.on('line', (line) => {
      if (line && line.trim()) {
        try {
          const entity = JSON.parse(line)
          if (entity && Object.keys(entity).length) entities.push(entity)
        } catch (jsonParseError) {
          Logger.error(`[oldDbFiles] Failed to parse line "${line}" in db file "${filepath}"`, jsonParseError)
        }
      }
    })

    await once(rl, 'close')

    console.log(`[oldDbFiles] Db file "${filepath}" processed`)

    return entities
  } catch (error) {
    Logger.error(`[oldDbFiles] Failed to read db file "${filepath}"`, error)
    return []
  }
}

async function loadDbData(dbpath) {
  try {
    Logger.info(`[oldDbFiles] Loading db data at "${dbpath}"`)
    const files = await fs.readdir(dbpath)

    const entities = []
    for (const filename of files) {
      if (Path.extname(filename).toLowerCase() !== '.json') {
        Logger.warn(`[oldDbFiles] Ignoring filename "${filename}" in db folder "${dbpath}"`)
        continue
      }

      const filepath = Path.join(dbpath, filename)
      Logger.info(`[oldDbFiles] Loading db data file "${filepath}"`)
      const someEntities = await processDbFile(filepath)
      Logger.info(`[oldDbFiles] Processed db data file with ${someEntities.length} entities`)
      entities.push(...someEntities)
    }

    Logger.info(`[oldDbFiles] Finished loading db data with ${entities.length} entities`)
    return entities
  } catch (error) {
    Logger.error(`[oldDbFiles] Failed to load db data "${dbpath}"`, error)
    return null
  }
}

module.exports.init = async () => {
  const dbs = {
    libraryItems: Path.join(global.ConfigPath, 'libraryItems', 'data'),
    users: Path.join(global.ConfigPath, 'users', 'data'),
    sessions: Path.join(global.ConfigPath, 'sessions', 'data'),
    libraries: Path.join(global.ConfigPath, 'libraries', 'data'),
    settings: Path.join(global.ConfigPath, 'settings', 'data'),
    collections: Path.join(global.ConfigPath, 'collections', 'data'),
    playlists: Path.join(global.ConfigPath, 'playlists', 'data'),
    authors: Path.join(global.ConfigPath, 'authors', 'data'),
    series: Path.join(global.ConfigPath, 'series', 'data'),
    feeds: Path.join(global.ConfigPath, 'feeds', 'data')
  }

  const data = {}
  for (const key in dbs) {
    data[key] = await loadDbData(dbs[key])
    Logger.info(`[oldDbFiles] ${data[key].length} ${key} loaded`)
  }

  return data
}