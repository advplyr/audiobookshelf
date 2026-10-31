import Path from 'path'
import Logger from '../../Logger'
import StreamZip from '../../libs/nodeStreamZip'
import type { EBookFileObject } from '../../models/Book'
import { xmlToJSON } from '../index'
import { parseOpfMetadataJson } from './parseOpfMetadata'
import type { EBookFileScanData } from './parseEbookMetadata'

type XmlAttrs = {
  name?: string
  content?: string
  id?: string
  href?: string
  properties?: string
  'media-type'?: string
  'full-path'?: string
}

type MetaItem = {
  $?: XmlAttrs
}

type PackageMetadata = {
  meta?: {
    find?: (predicate: (meta: MetaItem) => boolean) => MetaItem | undefined
  }
}

type ManifestItem = {
  $?: XmlAttrs
}

type EpubZip = {
  entryData(entry: string): Promise<Buffer>
  extract(entry: string, outPath: string): Promise<unknown>
  close(): Promise<void>
}

type EpubPackageJson = {
  container?: {
    rootfiles?: Array<{
      rootfile?: Array<{ $?: XmlAttrs }>
    }>
  }
  package?: {
    metadata?: PackageMetadata | PackageMetadata[]
    manifest?: Array<{
      item?: ManifestItem[]
    }>
  }
}

/**
 * Extract a file from an epub and return its string content.
 */
function openEpubZip(epubPath: string): EpubZip {
  return new StreamZip.async({ file: epubPath })
}

async function extractFileFromEpub(epubPath: string, filepath: string): Promise<string | undefined> {
  const zip = openEpubZip(epubPath)
  const data = await zip.entryData(filepath).catch((error: unknown) => {
    Logger.error(`[parseEpubMetadata] Failed to extract ${filepath} from epub at "${epubPath}"`, error)
  })
  const filedata = data?.toString('utf8')
  await zip.close().catch((error: unknown) => {
    Logger.error(`[parseEpubMetadata] Failed to close zip`, error)
  })

  return filedata
}

/**
 * Extract an XML file from an epub and return JSON.
 */
async function extractXmlToJson(epubPath: string, xmlFilepath: string): Promise<EpubPackageJson | null> {
  const filedata = await extractFileFromEpub(epubPath, xmlFilepath)
  if (!filedata) return null
  // Parsed XML is narrowed to the expected EPUB package shape here.
  return (await xmlToJSON(filedata)) as EpubPackageJson | null
}

/**
 * Extract a cover image from an epub. Returns true on success.
 */
export async function extractCoverImage(epubPath: string, epubImageFilepath: string, outputCoverPath: string): Promise<boolean> {
  const zip = openEpubZip(epubPath)

  const success = await zip
    .extract(epubImageFilepath, outputCoverPath)
    .then(() => true)
    .catch((error: unknown) => {
      Logger.error(`[parseEpubMetadata] Failed to extract image ${epubImageFilepath} from epub at "${epubPath}"`, error)
      return false
    })

  await zip.close().catch((error: unknown) => {
    Logger.error(`[parseEpubMetadata] Failed to close zip`, error)
  })

  return success
}

/**
 * Parse metadata from an epub.
 */
export async function parse(ebookFile: EBookFileObject): Promise<EBookFileScanData | null> {
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
  const opfMetadata = parseOpfMetadataJson(structuredClone(packageJson))
  if (!opfMetadata) {
    Logger.error(`Unable to parse metadata in package doc with json`, JSON.stringify(packageJson, null, 2))
    return null
  }

  const payload: EBookFileScanData = {
    path: epubPath,
    ebookFormat: 'epub',
    metadata: opfMetadata
  }

  // Attempt to find filepath to cover image:
  // Metadata may include <meta name="cover" content="id"/> where content is the id of the cover image in the manifest
  //  Otherwise find image in the manifest with cover-image property set
  //  As a fallback the first image in the manifest is used as the cover image
  const rawPackageMetadata = packageJson.package?.metadata
  const packageMetadata = Array.isArray(rawPackageMetadata) ? rawPackageMetadata[0] : rawPackageMetadata
  const metaCoverId = packageMetadata?.meta?.find?.((meta) => meta.$?.name === 'cover')?.$?.content

  let manifestFirstImage: ManifestItem | null | undefined = null
  if (metaCoverId) {
    manifestFirstImage = packageJson.package?.manifest?.[0]?.item?.find((item) => item.$?.id === metaCoverId)
  }
  if (!manifestFirstImage) {
    manifestFirstImage = packageJson.package?.manifest?.[0]?.item?.find((item) => item.$?.properties?.split(' ')?.includes('cover-image'))
  }
  if (!manifestFirstImage) {
    manifestFirstImage = packageJson.package?.manifest?.[0]?.item?.find((item) => item.$?.['media-type']?.startsWith('image/'))
  }

  const coverImagePath = manifestFirstImage?.$?.href
  if (coverImagePath) {
    const packageDirname = Path.dirname(packageDocPath)
    payload.ebookCoverPath = Path.posix.join(packageDirname, coverImagePath)
  } else {
    Logger.warn(`Cover image not found in manifest for epub at "${epubPath}"`)
  }

  return payload
}
