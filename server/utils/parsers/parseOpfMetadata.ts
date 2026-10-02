import { xmlToJSON } from '../index'
import htmlSanitizer from '../htmlSanitizer'

type XmlAttrs = Record<string, string | undefined>

type CreatorNode = {
  _?: string
  $?: XmlAttrs
}

type Creator = {
  value: string
  role: string | null
  fileAs: string | null
}

type RefineMeta = {
  value?: string
  refines?: string
  property?: string
}

type SeriesMeta = {
  _?: string
  $?: {
    name?: string
    content?: string
    refines?: string
    property?: string
  }
}

type SeriesItem = {
  name: string
  sequence: string | null
}

type BuiltMeta = {
  refines?: RefineMeta[]
  [name: string]: unknown
}

type OpfMetadata = {
  meta: BuiltMeta
  [key: string]: unknown
}

export type OpfMetadataResult = {
  title: string | null
  subtitle: string | null
  authors: string[]
  narrators: string[]
  publishedYear: string | null
  publisher: string | null
  isbn: string | null
  asin: string | null
  description: string | null
  genres: string[]
  language: string | null
  series: SeriesItem[]
  tags: string[]
}

/**
 * @example
 * <dc:creator xmlns:ns0="http://www.idpf.org/2007/opf" ns0:role="aut" ns0:file-as="Steinbeck, John">John Steinbeck</dc:creator>
 * <dc:creator opf:role="aut" opf:file-as="Orwell, George">George Orwell</dc:creator>
 */
function parseCreators(metadata: OpfMetadata): Array<Creator | false> | null {
  const creatorNodes = metadata['dc:creator'] as CreatorNode[] | undefined
  if (!creatorNodes?.length) return null
  return creatorNodes.map((creatorNode) => {
    const c = creatorNode
    if (typeof c !== 'object' || !c['$'] || !c['_']) return false
    const namespace =
      Object.keys(c['$'])
        .find((key) => key.startsWith('xmlns:'))
        ?.split(':')[1] || 'opf'
    const creator: Creator = {
      value: c['_'],
      role: c['$'][`${namespace}:role`] || null,
      fileAs: c['$'][`${namespace}:file-as`] || null
    }

    const id = c['$']['id']
    if (id && metadata.meta.refines?.some((r) => r.refines === `#${id}`)) {
      const creatorMeta = metadata.meta.refines.filter((r) => r.refines === `#${id}`)
      if (creatorMeta) {
        creator.role = creatorMeta.find((r) => r.property === 'role')?.value || creator.role || null
        creator.fileAs = creatorMeta.find((r) => r.property === 'file-as')?.value || creator.fileAs || null
      }
    }

    return creator
  })
}

function fetchCreators(creators: Array<Creator | false> | null, role: string): string[] | null {
  if (!creators?.length) return null
  return [...new Set(creators.filter((c) => (c as Creator).role === role && (c as Creator).value).map((c) => (c as Creator).value))]
}

function fetchTagString(metadata: { [key: string]: unknown }, tag: string): string | null {
  const tagValues = metadata[tag]
  if (!Array.isArray(tagValues) || !tagValues.length) return null
  let value: unknown = tagValues[0]

  if (typeof value === 'object') value = (value as { _: unknown })._
  if (typeof value !== 'string') return null
  return value
}

function fetchDate(metadata: OpfMetadata): string | null {
  const date = fetchTagString(metadata, 'dc:date')
  if (!date) return null
  const dateSplit = date.split('-')
  const year = dateSplit[0]
  const yearIsNaN: unknown = Reflect.apply(isNaN, undefined, [year])
  if (!dateSplit.length || year.length !== 4 || yearIsNaN === true) return null
  return year
}

function fetchPublisher(metadata: OpfMetadata): string | null {
  return fetchTagString(metadata, 'dc:publisher')
}

/**
 * @example
 * <dc:identifier xmlns:ns4="http://www.idpf.org/2007/opf" ns4:scheme="ISBN">9781440633904</dc:identifier>
 * <dc:identifier opf:scheme="ISBN">9780141187761</dc:identifier>
 */
function fetchIdentifier(metadata: OpfMetadata, scheme: string): string | null {
  const identifiers = metadata['dc:identifier'] as CreatorNode[] | undefined
  if (!identifiers?.length) return null
  const identifierObj = identifiers.find((identifier) => {
    const i = identifier
    if (!i['$']) return false
    const namespace =
      Object.keys(i['$'])
        .find((key) => key.startsWith('xmlns:'))
        ?.split(':')[1] || 'opf'
    return i['$'][`${namespace}:scheme`] === scheme
  })
  return identifierObj?.['_'] || null
}

function fetchISBN(metadata: OpfMetadata): string | null {
  return fetchIdentifier(metadata, 'ISBN')
}

function fetchASIN(metadata: OpfMetadata): string | null {
  return fetchIdentifier(metadata, 'ASIN')
}

function fetchTitle(metadata: OpfMetadata): string | null {
  return fetchTagString(metadata, 'dc:title')
}

function fetchSubtitle(metadata: OpfMetadata): string | null {
  return fetchTagString(metadata, 'dc:subtitle')
}

function fetchDescription(metadata: OpfMetadata): string | null {
  let description = fetchTagString(metadata, 'dc:description')
  if (!description) return null
  // check if description is HTML or plain text. only plain text allowed
  // calibre stores < and > as &lt; and &gt;
  description = description.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  return htmlSanitizer.stripAllTags(description)
}

function fetchGenres(metadata: OpfMetadata): string[] {
  const subjects = metadata['dc:subject'] as unknown[] | undefined
  if (!subjects || !subjects.length) return []
  return [...new Set(subjects.filter((g): g is string => Boolean(g) && typeof g === 'string'))]
}

function fetchLanguage(metadata: OpfMetadata): string | null {
  return fetchTagString(metadata, 'dc:language')
}

function fetchSeries(metadataMeta: SeriesMeta[] | null | undefined): SeriesItem[] {
  if (!metadataMeta) return []
  const result: SeriesItem[] = []
  for (let i = 0; i < metadataMeta.length; i++) {
    const name = metadataMeta[i].$?.content?.trim()
    if (metadataMeta[i].$?.name === 'calibre:series' && name) {
      let sequence: string | null = null
      const nextSequence = metadataMeta[i + 1]?.$?.content?.trim()
      if (metadataMeta[i + 1]?.$?.name === 'calibre:series_index' && nextSequence) {
        sequence = nextSequence
      }
      result.push({ name, sequence })
    }
  }

  // If one series was found with no series_index then check if any series_index meta can be found
  //   this is to support when calibre:series_index is not directly underneath calibre:series
  if (result.length === 1 && !result[0].sequence) {
    const seriesIndexMeta = metadataMeta.find((m) => m.$?.name === 'calibre:series_index' && m.$?.content?.trim())
    const seriesIndex = seriesIndexMeta?.$?.content?.trim()
    if (seriesIndex) {
      result[0].sequence = seriesIndex
    }
  }

  // Remove duplicates
  const dedupedResult = result.filter((se, idx) => result.findIndex((s) => s.name === se.name) === idx)

  return dedupedResult
}

function fetchNarrators(creators: Array<Creator | false> | null, metadata: OpfMetadata): string[] | null | undefined {
  const narrators = fetchCreators(creators, 'nrt')
  if (narrators?.length) return narrators
  try {
    const narratorsTag = fetchTagString(metadata.meta, 'calibre:user_metadata:#narrators')
    const narratorsJSON = JSON.parse((narratorsTag as string).replace(/&quot;/g, '"')) as { '#value#'?: string[] }
    return narratorsJSON['#value#']
  } catch {
    return null
  }
}

function fetchTags(metadata: OpfMetadata): string[] {
  const tags = metadata['dc:tag'] as unknown[] | undefined
  if (!tags || !tags.length) return []
  return [...new Set(tags.filter((tag): tag is string => Boolean(tag) && typeof tag === 'string'))]
}

function stripPrefix(str: string): string {
  if (!str) return ''
  return str.split(':').pop() || ''
}

export function parseOpfMetadataJson(json: Record<string, unknown>): OpfMetadataResult | null {
  // Handle <package ...> or with prefix <ns0:package ...>
  const packageKey = Object.keys(json).find((key) => stripPrefix(key) === 'package')
  if (!packageKey) return null
  const prefix = packageKey.split(':').shift()
  const packageNode = json[packageKey] as Record<string, unknown>
  let metadata: unknown = prefix ? packageNode[`${prefix}:metadata`] || packageNode.metadata : packageNode.metadata
  if (!metadata) return null
  if (Array.isArray(metadata)) {
    if (!metadata.length) return null
    metadata = metadata[0]
  }

  const metadataRecord = metadata as OpfMetadata
  const metadataMeta = (prefix ? metadataRecord[`${prefix}:meta`] || metadataRecord.meta : metadataRecord.meta) as SeriesMeta[] | undefined

  metadataRecord.meta = {}
  if (metadataMeta?.length) {
    metadataMeta.forEach((meta) => {
      if (meta?.['$']?.name) {
        metadataRecord.meta[meta['$'].name] = [meta['$'].content || '']
      } else if (meta?.['$']?.refines) {
        // https://www.w3.org/TR/epub-33/#sec-meta-elem

        if (!metadataRecord.meta.refines) {
          metadataRecord.meta.refines = []
        }
        metadataRecord.meta.refines.push({
          value: meta._,
          refines: meta.$.refines,
          property: meta.$.property
        })
      }
    })
  }
  const creators = parseCreators(metadataRecord)
  const authors = (fetchCreators(creators, 'aut') || []).map((au) => au?.trim()).filter((au): au is string => Boolean(au))
  const narrators = (fetchNarrators(creators, metadataRecord) || []).map((nrt) => nrt?.trim()).filter((nrt): nrt is string => Boolean(nrt))
  return {
    title: fetchTitle(metadataRecord),
    subtitle: fetchSubtitle(metadataRecord),
    authors,
    narrators,
    publishedYear: fetchDate(metadataRecord),
    publisher: fetchPublisher(metadataRecord),
    isbn: fetchISBN(metadataRecord),
    asin: fetchASIN(metadataRecord),
    description: fetchDescription(metadataRecord),
    genres: fetchGenres(metadataRecord),
    language: fetchLanguage(metadataRecord),
    series: fetchSeries(metadataMeta),
    tags: fetchTags(metadataRecord)
  }
}

export async function parseOpfMetadataXML(xml: string): Promise<OpfMetadataResult | null> {
  const json = (await xmlToJSON(xml)) as Record<string, unknown> | null
  if (!json) return null

  return parseOpfMetadataJson(json)
}
