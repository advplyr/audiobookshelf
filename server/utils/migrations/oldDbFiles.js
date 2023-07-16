const { once } = require('events')
const { createInterface } = require('readline')
const Path = require('path')
const Logger = require('../../Logger')
const fs = require('../../libs/fsExtra')
const archiver = require('../../libs/archiver')
const StreamZip = require('../../libs/nodeStreamZip')

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

module.exports.loadOldData = async (dbName) => {
  const dbPath = Path.join(global.ConfigPath, dbName, 'data')
  const dbData = await loadDbData(dbPath) || []
  Logger.info(`[oldDbFiles] ${dbData.length} ${dbName} loaded`)
  return dbData
}

module.exports.zipWrapOldDb = async () => {
  const dbs = {
    libraryItems: Path.join(global.ConfigPath, 'libraryItems'),
    users: Path.join(global.ConfigPath, 'users'),
    sessions: Path.join(global.ConfigPath, 'sessions'),
    libraries: Path.join(global.ConfigPath, 'libraries'),
    settings: Path.join(global.ConfigPath, 'settings'),
    collections: Path.join(global.ConfigPath, 'collections'),
    playlists: Path.join(global.ConfigPath, 'playlists'),
    authors: Path.join(global.ConfigPath, 'authors'),
    series: Path.join(global.ConfigPath, 'series'),
    feeds: Path.join(global.ConfigPath, 'feeds')
  }

  return new Promise((resolve) => {
    const oldDbPath = Path.join(global.ConfigPath, 'oldDb.zip')
    const output = fs.createWriteStream(oldDbPath)
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    })

    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    output.on('close', async () => {
      Logger.info(`[oldDbFiles] Old db files have been zipped in ${oldDbPath}. ${archive.pointer()} total bytes`)

      // Remove old db folders have successful zip
      for (const db in dbs) {
        await fs.remove(dbs[db])
      }

      resolve(true)
    })

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    output.on('end', () => {
      Logger.debug('[oldDbFiles] Data has been drained')
    })

    // good practice to catch this error explicitly
    archive.on('error', (err) => {
      Logger.error(`[oldDbFiles] Failed to zip old db folders`, err)
      resolve(false)
    })

    // pipe archive data to the file
    archive.pipe(output)

    for (const db in dbs) {
      archive.directory(dbs[db], db)
    }

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
    archive.finalize()
  })
}

module.exports.checkHasOldDb = async () => {
  const dbs = {
    libraryItems: Path.join(global.ConfigPath, 'libraryItems'),
    users: Path.join(global.ConfigPath, 'users'),
    sessions: Path.join(global.ConfigPath, 'sessions'),
    libraries: Path.join(global.ConfigPath, 'libraries'),
    settings: Path.join(global.ConfigPath, 'settings'),
    collections: Path.join(global.ConfigPath, 'collections'),
    playlists: Path.join(global.ConfigPath, 'playlists'),
    authors: Path.join(global.ConfigPath, 'authors'),
    series: Path.join(global.ConfigPath, 'series'),
    feeds: Path.join(global.ConfigPath, 'feeds')
  }
  for (const db in dbs) {
    if (await fs.pathExists(dbs[db])) {
      return true
    }
  }
  return false
}

module.exports.checkHasOldDbZip = async () => {
  const oldDbPath = Path.join(global.ConfigPath, 'oldDb.zip')
  if (!await fs.pathExists(oldDbPath)) {
    return false
  }

  // Extract oldDb.zip
  const zip = new StreamZip.async({ file: oldDbPath })
  await zip.extract(null, global.ConfigPath)
  await zip.close()

  return this.checkHasOldDb()
}

/**
 * Used for migration from 2.3.0 -> 2.3.1
 * @returns {boolean} true if extracted
 */
module.exports.checkExtractItemsUsersAndLibraries = async () => {
  const oldDbPath = Path.join(global.ConfigPath, 'oldDb.zip')

  const zip = new StreamZip.async({ file: oldDbPath })
  const libraryItemsPath = Path.join(global.ConfigPath, 'libraryItems')
  await zip.extract('libraryItems/', libraryItemsPath)

  if (!await fs.pathExists(libraryItemsPath)) {
    Logger.error(`[oldDbFiles] Failed to extract old libraryItems from oldDb.zip`)
    return false
  }

  const usersPath = Path.join(global.ConfigPath, 'users')
  await zip.extract('users/', usersPath)

  if (!await fs.pathExists(usersPath)) {
    Logger.error(`[oldDbFiles] Failed to extract old users from oldDb.zip`)
    await fs.remove(libraryItemsPath) // Remove old library items folder
    return false
  }

  const librariesPath = Path.join(global.ConfigPath, 'libraries')
  await zip.extract('libraries/', librariesPath)

  if (!await fs.pathExists(librariesPath)) {
    Logger.error(`[oldDbFiles] Failed to extract old libraries from oldDb.zip`)
    await fs.remove(usersPath) // Remove old users folder
    await fs.remove(libraryItemsPath) // Remove old library items folder
    return false
  }

  await zip.close()

  return true
}

/**
 * Used for migration from 2.3.0 -> 2.3.1
 */
module.exports.removeOldItemsUsersAndLibrariesFolders = async () => {
  const libraryItemsPath = Path.join(global.ConfigPath, 'libraryItems')
  const usersPath = Path.join(global.ConfigPath, 'users')
  const librariesPath = Path.join(global.ConfigPath, 'libraries')
  await fs.remove(libraryItemsPath)
  await fs.remove(usersPath)
  await fs.remove(librariesPath)
}