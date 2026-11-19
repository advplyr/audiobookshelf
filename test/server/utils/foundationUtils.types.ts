import type * as constants from '../../../server/utils/constants'
import type globals from '../../../server/utils/globals'
import type areEquivalent from '../../../server/utils/areEquivalent'
import type { parse } from '../../../server/utils/parsers/parseSeriesString'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

// Exact types keep the exports mutable and detect missing or weakened types.
export type FoundationUtilsContract = [
  Assert<Equal<keyof typeof constants, 'ScanResult' | 'BookCoverAspectRatio' | 'BookshelfView' | 'LogLevel' | 'PlayMethod' | 'AudioMimeType'>>,
  Assert<Equal<typeof constants.ScanResult, { NOTHING: number; ADDED: number; UPDATED: number; REMOVED: number; UPTODATE: number }>>,
  Assert<Equal<typeof constants.BookCoverAspectRatio, { STANDARD: number; SQUARE: number }>>,
  Assert<Equal<typeof constants.BookshelfView, { STANDARD: number; DETAIL: number }>>,
  Assert<Equal<typeof constants.LogLevel, { TRACE: number; DEBUG: number; INFO: number; WARN: number; ERROR: number; FATAL: number; NOTE: number }>>,
  Assert<Equal<typeof constants.PlayMethod, { DIRECTPLAY: number; DIRECTSTREAM: number; TRANSCODE: number; LOCAL: number }>>,
  Assert<Equal<typeof constants.AudioMimeType, {
    MP3: string; M4B: string; M4A: string; MP4: string; OGG: string; OGA: string; OPUS: string
    AAC: string; FLAC: string; WMA: string; AIFF: string; AIF: string; WEBM: string; WEBMA: string
    MKA: string; AWB: string; CAF: string; MPEG: string; MPG: string
  }>>,
  Assert<Equal<typeof globals, {
    SupportedImageTypes: string[]
    SupportedAudioTypes: string[]
    SupportedEbookTypes: string[]
    TextFileTypes: string[]
    MetadataFileTypes: string[]
  }>>,
  Assert<Equal<Parameters<typeof areEquivalent>, [value1: unknown, value2: unknown, numToString?: boolean, stack?: unknown[]]>>,
  Assert<Equal<ReturnType<typeof areEquivalent>, boolean>>,
  Assert<Equal<Parameters<typeof parse>, [seriesString: unknown]>>,
  Assert<Equal<ReturnType<typeof parse>, { name: string; sequence: string | null } | null>>
]
