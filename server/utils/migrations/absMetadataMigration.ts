import Path from 'node:path'
import Logger from '../../Logger'
import fsExtra from '../../libs/fsExtra'
import fileUtils from '../fileUtils'
import LibraryFile from '../../objects/files/LibraryFile'
import type Database from '../../Database'
import type LibraryItem from '../../models/LibraryItem'

async function writeMetadataFileForItem(libraryItem: LibraryItem) {
  const storeMetadataWithItem = global.ServerSettings.storeMetadataWithItem && !libraryItem.isFile
  const basePath = storeMetadataWithItem ? libraryItem.path : global.MetadataPath
  if (typeof basePath !== 'string') throw new TypeError('Metadata directory is unavailable.')
  const metadataPath = storeMetadataWithItem ? basePath : Path.join(basePath, 'items', libraryItem.id)
  const metadataFilepath = fileUtils.filePathToPOSIX(Path.join(metadataPath, 'metadata.json'))
  if ((await fsExtra.pathExists(metadataFilepath))) {
    // Metadata file already exists do nothing
    return null
  }
  Logger.info(`[absMetadataMigration] metadata file not found at "${metadataFilepath}" - creating`)

  if (!storeMetadataWithItem) {
    // Ensure /metadata/items/<lid> dir
    await fsExtra.ensureDir(metadataPath)
  }

  if (!libraryItem.media) throw new TypeError('Library item media is unavailable.')
  const metadataJson = libraryItem.media.getAbsMetadataJson()

  // Save to file
  const success = await fsExtra.writeFile(metadataFilepath, JSON.stringify(metadataJson, null, 2)).then(() => true).catch((error: unknown) => {
    Logger.error(`[absMetadataMigration] failed to save metadata file at "${metadataFilepath}"`, (error instanceof Error ? error.message : undefined) || error)
    return false
  })

  if (!success) return false
  if (!storeMetadataWithItem) return true // No need to do anything else

  // Safety check to make sure library file with the same path isnt already there
  if (!libraryItem.libraryFiles) throw new TypeError('Library item files are unavailable.')
  libraryItem.libraryFiles = libraryItem.libraryFiles.filter(lf => lf.metadata?.path !== metadataFilepath)

  // Put new library file in library item
  const newLibraryFile = new LibraryFile()
  await newLibraryFile.setDataFromPath(metadataFilepath, 'metadata.json')
  libraryItem.libraryFiles.push(newLibraryFile.toJSON())

  // Update library item timestamps and total size
  const libraryItemDirTimestamps = await fileUtils.getFileTimestampsWithIno(basePath)
  if (libraryItemDirTimestamps) {
    libraryItem.mtime = libraryItemDirTimestamps.mtimeMs
    libraryItem.ctime = libraryItemDirTimestamps.ctimeMs
    let size = 0
    libraryItem.libraryFiles.forEach((lf) => size += (!isNaN(Number(lf.metadata?.size)) ? Number(lf.metadata?.size) : 0))
    libraryItem.size = size
  }

  libraryItem.changed('libraryFiles', true)
  return libraryItem.save().then(() => true).catch((error: unknown) => {
    Logger.error(`[absMetadataMigration] failed to save libraryItem "${libraryItem.id}"`, (error instanceof Error ? error.message : undefined) || error)
    return false
  })
}

async function runMigration(database: Pick<typeof Database, 'libraryItemModel'>, offset = 0, totalCreated = 0): Promise<number> {
  const libraryItems = await database.libraryItemModel.getLibraryItemsIncrement(offset, 500, { isMissing: false })
  if (!libraryItems.length) return totalCreated

  let numCreated = 0
  for (const libraryItem of libraryItems) {
    const success = await writeMetadataFileForItem(libraryItem)
    if (success) numCreated++
  }

  if (libraryItems.length < 500) {
    return totalCreated + numCreated
  }
  return runMigration(database, offset + libraryItems.length, totalCreated + numCreated)
}

async function migrate(database: Pick<typeof Database, 'libraryItemModel'>) {
  Logger.info(`[absMetadataMigration] Starting metadata.json migration`)
  const totalCreated = await runMigration(database)
  Logger.info(`[absMetadataMigration] Finished metadata.json migration (${totalCreated} files created)`)
}
export = { migrate }
