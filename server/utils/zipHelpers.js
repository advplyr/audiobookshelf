const Path = require('path')
const { Response } = require('express')
const Logger = require('../Logger')
const archiver = require('../libs/archiver')

module.exports.zipDirectoryPipe = (path, filename, res) => {
  return new Promise((resolve, reject) => {
    // create a file to stream archive data to
    res.attachment(filename)

    const archive = archiver('zip', {
      zlib: { level: 0 } // Sets the compression level.
    })

    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    res.on('close', () => {
      Logger.info(archive.pointer() + ' total bytes')
      Logger.debug('archiver has been finalized and the output file descriptor has closed.')
      resolve()
    })

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    res.on('end', () => {
      Logger.debug('Data has been drained')
    })

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log warning
        Logger.warn(`[DownloadManager] Archiver warning: ${err.message}`)
      } else {
        // throw error
        Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
        // throw err
        reject(err)
      }
    })
    archive.on('error', function (err) {
      Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
      reject(err)
    })

    // pipe archive data to the file
    archive.pipe(res)

    archive.directory(path, false)

    archive.finalize()
  })
}

/**
 * Creates a zip archive containing multiple directories and streams it to the response.
 *
 * @param {{ path: string, isFile: boolean }[]} pathObjects
 * @param {string} filename - Name of the zip file to be sent as attachment.
 * @param {Response} res - Response object to pipe the archive data to.
 * @returns {Promise<void>} - Promise that resolves when the zip operation completes.
 */
module.exports.zipDirectoriesPipe = (pathObjects, filename, res) => {
  return new Promise((resolve, reject) => {
    // create a file to stream archive data to
    res.attachment(filename)

    const archive = archiver('zip', {
      zlib: { level: 0 } // Sets the compression level.
    })

    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    res.on('close', () => {
      Logger.info(archive.pointer() + ' total bytes')
      Logger.debug('archiver has been finalized and the output file descriptor has closed.')
      resolve()
    })

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    res.on('end', () => {
      Logger.debug('Data has been drained')
    })

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log warning
        Logger.warn(`[DownloadManager] Archiver warning: ${err.message}`)
      } else {
        // throw error
        Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
        // throw err
        reject(err)
      }
    })
    archive.on('error', function (err) {
      Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
      reject(err)
    })

    // pipe archive data to the file
    archive.pipe(res)

    // Add each path as a directory in the zip
    pathObjects.forEach((pathObject) => {
      if (!pathObject.isFile) {
        // Add the directory to the archive with its name as the root folder
        archive.directory(pathObject.path, Path.basename(pathObject.path))
      } else {
        archive.file(pathObject.path, { name: Path.basename(pathObject.path) })
      }
    })

    archive.finalize()
  })
}

/**
 * Handles errors that occur during the download process.
 *
 * @param {*} error
 * @param {Response} res
 * @returns {*}
 */
module.exports.handleDownloadError = (error, res) => {
  if (!res.headersSent) {
    if (error.code === 'ENOENT') {
      return res.status(404).send('File not found')
    } else {
      return res.status(500).send('Download failed')
    }
  }
}
