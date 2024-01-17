const Logger = require('../Logger')
const fsPromises = require('fs/promises')
const MediaInfoFactory = require('mediainfo.js').default

// File chunking logic pulled from the official cli example
// https://github.com/buzz/mediainfo.js/blob/main/src/cli.ts

/**
 * Uses mediainfo.js to dump a file's data
 * @param {string} filepath
 * @returns {Promise<import("mediainfo.js").MediaInfoType | null>}
 */
const mediaInfoDump = async (filepath) => {
  let fileHandle
  let fileSize
  let mediaInfo

  /** @type {import('mediainfo.js').ReadChunkFunc} */
  const readChunk = async (size, offset) => {
    if (fileHandle === undefined) throw new Error('File unavailable for Mediainfo reading')
    const buffer = new Uint8Array(size)
    await fileHandle.read(buffer, 0, size, offset)
    return buffer
  }

  try {
    fileHandle = await fsPromises.open(filepath, 'r')
    fileSize = (await fileHandle.stat()).size
    mediaInfo = await MediaInfoFactory({
      format: 'object',
      coverData: false,
      full: false,
    })
    if (mediaInfo === undefined) {
      Logger.warn('[MediaInfo] Failed to initialize MediaInfo parser for scanning media file', {
        filepath,
      })

      return null
    }
    const result = await mediaInfo.analyzeData(() => fileSize, readChunk)

    return result
  } catch (error) {
    Logger.error(`[MediaInfo] MediaInfo failed while scanning media file`, error)
  } finally {
    fileHandle && (await fileHandle.close())
    mediaInfo && mediaInfo.close()
  }
  return null
}

/**
 * Extracts tags from a MediaInfoType object into a predictable internal object type
 *
 * Currently only returns "extra" fields as defined by mediainfo, but can easily consume normal tags too
 *
 * @param {import("mediainfo.js").MediaInfoType | null} mediaInfo
 * @returns {{ fields: Record<string, string>, lowerCaseFields: Record<string, string> }} Object containing all lower-case
 */
const extractTags = (mediaInfo) => {
  const defaultEmpty = { fields: {}, lowerCaseFields: {} }
  if (!mediaInfo || !mediaInfo.media) return defaultEmpty

  const generalTrack = mediaInfo.media.track?.find((track) => track['@type'] === 'General')

  if (!generalTrack) return defaultEmpty

  const fields = {}
  const lowerCaseFields = {}

  Object.entries(generalTrack.extra || {}).forEach(([key, value]) => {
    // Lets keep it predictable... only supporting numbers and strings for now.
    let cleanValue
    if (typeof value === 'string') {
      cleanValue = value.trim()
    }
    if (typeof value === 'number' && !isNaN(value)) {
      cleanValue = number.toString()
    }

    if (cleanValue) {
      fields[key] = cleanValue
      lowerCaseFields[key.toLowerCase()] = key
    }
  })

  return {
    fields,
    lowerCaseFields,
  }
}

module.exports = {
  mediaInfoDump,
  extractTags,
}
