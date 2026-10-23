import Logger from '../../Logger'
import { parse } from '../parsers/parseSeriesString'

type ExpectedType = 'string' | 'boolean' | 'stringArray'
type MetadataScalar = string | null | boolean | string[]
type ParsedSeries = NonNullable<ReturnType<typeof parse>>
type MetadataChapter = {
  id: number
  start: unknown
  end: unknown
  title: string
}
type MetadataValue = MetadataScalar | ParsedSeries[] | MetadataChapter[]
type AbMetadata = Record<string, MetadataValue | undefined>

const mediaTypeKeys: Record<string, Record<string, ExpectedType> | undefined> = {
  book: {
    tags: 'stringArray',
    title: 'string',
    subtitle: 'string',
    authors: 'stringArray',
    narrators: 'stringArray',
    series: 'stringArray',
    genres: 'stringArray',
    publishedYear: 'string',
    publishedDate: 'string',
    publisher: 'string',
    description: 'string',
    isbn: 'string',
    asin: 'string',
    language: 'string',
    explicit: 'boolean',
    abridged: 'boolean'
  },
  podcast: {
    tags: 'stringArray',
    title: 'string',
    author: 'string',
    description: 'string',
    releaseDate: 'string',
    genres: 'stringArray',
    feedURL: 'string',
    imageURL: 'string',
    itunesPageURL: 'string',
    itunesId: 'string',
    itunesArtistId: 'string',
    asin: 'string',
    language: 'string',
    explicit: 'boolean',
    podcastType: 'string'
  }
}

/**
 * Parse metadata.json text into validated book or podcast metadata.
 * Returns null when the text or media type is invalid.
 */
function parseJsonMetadataText(text: string, mediaType: string): AbMetadata | null {
  try {
    const parsed: unknown = JSON.parse(text)
    const abmetadataData = parsed as Record<string, unknown>

    // Old metadata.json used nested "metadata"
    const nestedMetadata = abmetadataData.metadata
    if (nestedMetadata && typeof nestedMetadata === 'object') {
      const nestedRecord = nestedMetadata as Record<string, unknown>
      for (const key in nestedRecord) {
        if (nestedRecord[key] === undefined) continue
        let newModelKey = key
        if (key === 'feedUrl') newModelKey = 'feedURL'
        else if (key === 'imageUrl') newModelKey = 'imageURL'
        else if (key === 'itunesPageUrl') newModelKey = 'itunesPageURL'
        else if (key === 'type') newModelKey = 'podcastType'
        abmetadataData[newModelKey] = nestedRecord[key]
      }
    }
    delete abmetadataData.metadata

    const expectedKeys = mediaTypeKeys[mediaType]
    if (!expectedKeys) {
      Logger.error(`[abmetadataGenerator] Invalid media type "${mediaType}"`)
      return null
    }

    const validated: AbMetadata = {}
    for (const key in expectedKeys) {
      const expectedType = expectedKeys[key]
      if (!(key in abmetadataData)) continue

      const validatedValue = validateMetadataValue(key, abmetadataData[key], expectedType)
      if (validatedValue !== undefined) {
        validated[key] = validatedValue
      }
    }

    const series = validated.series
    if (isNonEmptyArray(series)) {
      validated.series = series.map((seriesName) => parse(seriesName)).filter((seriesName): seriesName is ParsedSeries => Boolean(seriesName))
    }

    if (mediaType === 'book' && 'chapters' in abmetadataData) {
      if (abmetadataData.chapters === null) {
        validated.chapters = []
      } else if (isUnknownArray(abmetadataData.chapters)) {
        const cleanedChapters = cleanChaptersArray(abmetadataData.chapters, validated.title ?? abmetadataData.title)
        if (cleanedChapters) {
          validated.chapters = cleanedChapters
        }
      } else {
        Logger.warn(`[abmetadataGenerator] Invalid metadata key "chapters" expected array, got ${typeof abmetadataData.chapters}`)
      }
    }

    return validated
  } catch (error) {
    Logger.error(`[abmetadataGenerator] Invalid metadata.json JSON`, error)
    return null
  }
}
export { parseJsonMetadataText as parseJson }

/**
 * @returns undefined excludes the key
 */
function validateMetadataValue(key: string, value: unknown, expectedType: string): MetadataScalar | undefined {
  if (expectedType === 'string') {
    if (value === null) return null
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') return value
    Logger.warn(`[abmetadataGenerator] Invalid metadata key "${key}" expected string, got ${typeof value}`)
    return undefined
  }

  if (expectedType === 'boolean') {
    if (value === null) return null
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (lower === 'true') return true
      if (lower === 'false') return false
    }
    Logger.warn(`[abmetadataGenerator] Invalid metadata key "${key}" expected boolean, got ${typeof value}`)
    return undefined
  }

  // Filter empty strings and deduplicate
  if (expectedType === 'stringArray') {
    if (value === null) return []
    if (!Array.isArray(value)) {
      Logger.warn(`[abmetadataGenerator] Invalid metadata key "${key}" expected string array, got ${typeof value}`)
      return undefined
    }

    const cleanedArray = value.filter((item): item is string => typeof item === 'string')
    return [...new Set(cleanedArray.map((item) => item.trim()).filter((item) => item))]
  }

  Logger.warn(`[abmetadataGenerator] Unknown expected type "${expectedType}" for key "${key}"`)
  return undefined
}

function cleanChaptersArray(chaptersArray: unknown[], mediaTitle: unknown): MetadataChapter[] | null {
  const chapters: MetadataChapter[] = []
  let index = 0
  for (const chap of chaptersArray) {
    const start = readProperty(chap, 'start')
    const end = readProperty(chap, 'end')
    const title = readProperty(chap, 'title')
    if (start === null || valueIsNaN(start)) {
      Logger.error(`[abmetadataGenerator] Invalid chapter start time ${logText(start)} for "${logText(mediaTitle)}" metadata file`)
      return null
    }
    if (end === null || valueIsNaN(end)) {
      Logger.error(`[abmetadataGenerator] Invalid chapter end time ${logText(end)} for "${logText(mediaTitle)}" metadata file`)
      return null
    }
    if (!title || typeof title !== 'string') {
      Logger.error(`[abmetadataGenerator] Invalid chapter title ${logText(title)} for "${logText(mediaTitle)}" metadata file`)
      return null
    }

    chapters.push({
      id: index++,
      start,
      end,
      title
    })
  }
  return chapters
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isNonEmptyArray(value: MetadataValue | undefined): value is string[] | ParsedSeries[] | MetadataChapter[] {
  return Array.isArray(value) && value.length > 0
}

function readProperty(value: unknown, key: 'start' | 'end' | 'title'): unknown {
  if (typeof value === 'object' || typeof value === 'function') {
    return (value as Record<string, unknown>)[key]
  }
  return undefined
}

// Native isNaN accepts arbitrary values and throws for symbols and bigints.
function valueIsNaN(value: unknown): boolean {
  const result: unknown = Reflect.apply(isNaN, undefined, [value])
  return result === true
}

function logText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || value == null) {
    return `${value}`
  }
  if (typeof value === 'symbol' || typeof value === 'function') return value.toString()
  if (Array.isArray(value)) {
    return value.map((item) => (item == null ? '' : logText(item))).join(',')
  }
  // Match template-literal stringification, including a custom toString.
  return `${value as unknown as string}`
}
