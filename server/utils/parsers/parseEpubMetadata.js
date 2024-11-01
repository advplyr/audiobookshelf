const Path = require('path')
const Logger = require('../../Logger')
const StreamZip = require('../../libs/nodeStreamZip')
const parseOpfMetadata = require('./parseOpfMetadata')
const { xmlToJSON } = require('../index')

/**
 * Extract file from epub and return string content
 *
 * @param {string} epubPath
 * @param {string} filepath
 * @returns {Promise<string>}
 */
async function extractFileFromEpub(epubPath, filepath) {
  const zip = new StreamZip.async({ file: epubPath })
  const data = await zip.entryData(filepath).catch((error) => {
    Logger.error(`[parseEpubMetadata] Failed to extract ${filepath} from epub at "${epubPath}"`, error)
  })
  const filedata = data?.toString('utf8')
  await zip.close().catch((error) => {
    Logger.error(`[parseEpubMetadata] Failed to close zip`, error)
  })

  return filedata
}

/**
 * Extract an XML file from epub and return JSON
 *
 * @param {string} epubPath
 * @param {string} xmlFilepath
 * @returns {Promise<Object>}
 */
async function extractXmlToJson(epubPath, xmlFilepath) {
  const filedata = await extractFileFromEpub(epubPath, xmlFilepath)
  if (!filedata) return null
  return xmlToJSON(filedata)
}

/**
 * Extract cover image from epub return true if success
 *
 * @param {string} epubPath
 * @param {string} epubImageFilepath
 * @param {string} outputCoverPath
 * @returns {Promise<boolean>}
 */
async function extractCoverImage(epubPath, epubImageFilepath, outputCoverPath) {
  const zip = new StreamZip.async({ file: epubPath })

  const success = await zip
    .extract(epubImageFilepath, outputCoverPath)
    .then(() => true)
    .catch((error) => {
      Logger.error(`[parseEpubMetadata] Failed to extract image ${epubImageFilepath} from epub at "${epubPath}"`, error)
      return false
    })

  await zip.close()

  return success
}
module.exports.extractCoverImage = extractCoverImage

/**
 * Parse metadata from epub
 *
 * @param {import('../../models/Book').EBookFileObject} ebookFile
 * @returns {Promise<import('./parseEbookMetadata').EBookFileScanData>}
 */
async function parse(ebookFile) {
  const epubPath = ebookFile.metadata.path
  Logger.debug(`Parsing metadata from epub at "${epubPath}"`)
  // Entrypoint of the epub that contains the filepath to the package document (opf file)
  const containerJson = await extractXmlToJson(epubPath, 'META-INF/container.xml')
  if (!containerJson) {
    return null
  }

  // Get package document opf filepath from container.xml
  const packageDocPath = containerJson.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path']
  if (!packageDocPath) {
    Logger.error(`Failed to get package doc path in Container.xml`, JSON.stringify(containerJson, null, 2))
    return null
  }

  // Extract package document to JSON
  const packageJson = await extractXmlToJson(epubPath, packageDocPath)
  if (!packageJson) {
    return null
  }

  // Parse metadata from package document opf file
  const opfMetadata = parseOpfMetadata.parseOpfMetadataJson(structuredClone(packageJson))
  if (!opfMetadata) {
    Logger.error(`Unable to parse metadata in package doc with json`, JSON.stringify(packageJson, null, 2))
    return null
  }

  const payload = {
    path: epubPath,
    ebookFormat: 'epub',
    metadata: opfMetadata
  }

  // Attempt to find filepath to cover image:
  // Metadata may include <meta name="cover" content="id"/> where content is the id of the cover image in the manifest
  //  Otherwise the first image in the manifest is used as the cover image
  let packageMetadata = packageJson.package?.metadata
  if (Array.isArray(packageMetadata)) {
    packageMetadata = packageMetadata[0]
  }
  const metaCoverId = packageMetadata?.meta?.find?.((meta) => meta.$?.name === 'cover')?.$?.content

  let manifestFirstImage = null
  if (metaCoverId) {
    manifestFirstImage = packageJson.package?.manifest?.[0]?.item?.find((item) => item.$?.id === metaCoverId)
  }
  if (!manifestFirstImage) {
    manifestFirstImage = packageJson.package?.manifest?.[0]?.item?.find((item) => item.$?.['media-type']?.startsWith('image/'))
  }

  let coverImagePath = manifestFirstImage?.$?.href
  if (coverImagePath) {
    const packageDirname = Path.dirname(packageDocPath)
    payload.ebookCoverPath = Path.posix.join(packageDirname, coverImagePath)
  } else {
    Logger.warn(`Cover image not found in manifest for epub at "${epubPath}"`)
  }

  return payload
}
module.exports.parse = parse
