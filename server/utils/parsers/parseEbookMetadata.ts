import type { EBookFileObject } from '../../models/Book'
import type { ComicInfoMetadata } from './parseComicInfoMetadata'
import type { OpfMetadataResult } from './parseOpfMetadata'
import { extractCoverImage as extractComicCoverImage, parse as parseComicMetadata } from './parseComicMetadata'
import { extractCoverImage as extractEpubCoverImage, parse as parseEpubMetadata } from './parseEpubMetadata'

/**
 * Parsed ebook file used by scanners and cover extraction.
 */
export type EBookFileScanData = {
  path: string
  ebookFormat: string
  /** Internal image path. Omitted when no cover image was found. */
  ebookCoverPath?: string
  metadata: OpfMetadataResult | ComicInfoMetadata | null
}

/**
 * Parse metadata from an ebook file.
 * Returns null when the file is missing or the format is not epub, cbz, or cbr.
 */
export async function parse(ebookFile: EBookFileObject | null | undefined): Promise<EBookFileScanData | null> {
  if (!ebookFile) return null

  if (ebookFile.ebookFormat === 'epub') {
    return parseEpubMetadata(ebookFile)
  } else if (['cbz', 'cbr'].includes(ebookFile.ebookFormat)) {
    return parseComicMetadata(ebookFile)
  }
  return null
}

/**
 * Extract a cover image from an ebook file.
 */
export async function extractCoverImage(ebookFileScanData: EBookFileScanData | null | undefined, outputCoverPath: string): Promise<boolean> {
  if (!ebookFileScanData?.ebookCoverPath) return false

  if (ebookFileScanData.ebookFormat === 'epub') {
    return extractEpubCoverImage(ebookFileScanData.path, ebookFileScanData.ebookCoverPath, outputCoverPath)
  } else if (['cbz', 'cbr'].includes(ebookFileScanData.ebookFormat)) {
    return extractComicCoverImage(ebookFileScanData.path, ebookFileScanData.ebookCoverPath, outputCoverPath)
  }
  return false
}
