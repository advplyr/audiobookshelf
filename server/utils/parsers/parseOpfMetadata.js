const { xmlToJSON } = require('../index')
const htmlSanitizer = require('../htmlSanitizer')

/**
 * @typedef MetadataCreatorObject
 * @property {string} value
 * @property {string} role
 * @property {string} fileAs
 *
 * @example
 * <dc:creator xmlns:ns0="http://www.idpf.org/2007/opf" ns0:role="aut" ns0:file-as="Steinbeck, John">John Steinbeck</dc:creator>
 * <dc:creator opf:role="aut" opf:file-as="Orwell, George">George Orwell</dc:creator>
 *
 * @param {Object} metadata
 * @returns {MetadataCreatorObject[]}
 */
function parseCreators(metadata) {
  if (!metadata['dc:creator']?.length) return null
  return metadata['dc:creator'].map((c) => {
    if (typeof c !== 'object' || !c['$'] || !c['_']) return false
    const namespace =
      Object.keys(c['$'])
        .find((key) => key.startsWith('xmlns:'))
        ?.split(':')[1] || 'opf'
    return {
      value: c['_'],
      role: c['$'][`${namespace}:role`] || null,
      fileAs: c['$'][`${namespace}:file-as`] || null
    }
  })
}

function fetchCreators(creators, role) {
  if (!creators?.length) return null
  return [...new Set(creators.filter((c) => c.role === role && c.value).map((c) => c.value))]
}

function fetchTagString(metadata, tag) {
  if (!metadata[tag] || !metadata[tag].length) return null
  let value = metadata[tag][0]

  /*
    EXAMPLES:

    "dc:title": [
      {
        "_": "The Quest for Character",
        "$": {
          "opf:file-as": "Quest for Character What the Story of Socrates and Alcibiades"
        }
      }
    ]

    OR

    "dc:title": [
      "The Quest for Character"
    ]
  */
  if (typeof value === 'object') value = value._
  if (typeof value !== 'string') return null
  return value
}

function fetchDate(metadata) {
  const date = fetchTagString(metadata, 'dc:date')
  if (!date) return null
  const dateSplit = date.split('-')
  if (!dateSplit.length || dateSplit[0].length !== 4 || isNaN(dateSplit[0])) return null
  return dateSplit[0]
}

function fetchPublisher(metadata) {
  return fetchTagString(metadata, 'dc:publisher')
}

/**
 * @example
 * <dc:identifier xmlns:ns4="http://www.idpf.org/2007/opf" ns4:scheme="ISBN">9781440633904</dc:identifier>
 * <dc:identifier opf:scheme="ISBN">9780141187761</dc:identifier>
 *
 * @param {Object} metadata
 * @param {string} scheme
 * @returns {string}
 */
function fetchIdentifier(metadata, scheme) {
  if (!metadata['dc:identifier']?.length) return null
  const identifierObj = metadata['dc:identifier'].find((i) => {
    if (!i['$']) return false
    const namespace =
      Object.keys(i['$'])
        .find((key) => key.startsWith('xmlns:'))
        ?.split(':')[1] || 'opf'
    return i['$'][`${namespace}:scheme`] === scheme
  })
  return identifierObj?.['_'] || null
}

function fetchISBN(metadata) {
  return fetchIdentifier(metadata, 'ISBN')
}

function fetchASIN(metadata) {
  return fetchIdentifier(metadata, 'ASIN')
}

function fetchTitle(metadata) {
  return fetchTagString(metadata, 'dc:title')
}

function fetchSubtitle(metadata) {
  return fetchTagString(metadata, 'dc:subtitle')
}

function fetchDescription(metadata) {
  let description = fetchTagString(metadata, 'dc:description')
  if (!description) return null
  // check if description is HTML or plain text. only plain text allowed
  // calibre stores < and > as &lt; and &gt;
  description = description.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  return htmlSanitizer.stripAllTags(description)
}

function fetchGenres(metadata) {
  if (!metadata['dc:subject'] || !metadata['dc:subject'].length) return []
  return [...new Set(metadata['dc:subject'].filter((g) => g && typeof g === 'string'))]
}

function fetchLanguage(metadata) {
  return fetchTagString(metadata, 'dc:language')
}

function fetchSeries(metadataMeta) {
  if (!metadataMeta) return []
  const result = []
  for (let i = 0; i < metadataMeta.length; i++) {
    if (metadataMeta[i].$?.name === 'calibre:series' && metadataMeta[i].$.content?.trim()) {
      const name = metadataMeta[i].$.content.trim()
      let sequence = null
      if (metadataMeta[i + 1]?.$?.name === 'calibre:series_index' && metadataMeta[i + 1].$?.content?.trim()) {
        sequence = metadataMeta[i + 1].$.content.trim()
      }
      result.push({ name, sequence })
    }
  }

  // If one series was found with no series_index then check if any series_index meta can be found
  //   this is to support when calibre:series_index is not directly underneath calibre:series
  if (result.length === 1 && !result[0].sequence) {
    const seriesIndexMeta = metadataMeta.find((m) => m.$?.name === 'calibre:series_index' && m.$.content?.trim())
    if (seriesIndexMeta) {
      result[0].sequence = seriesIndexMeta.$.content.trim()
    }
  }

  // Remove duplicates
  const dedupedResult = result.filter((se, idx) => result.findIndex((s) => s.name === se.name) === idx)

  return dedupedResult
}

function fetchNarrators(creators, metadata) {
  const narrators = fetchCreators(creators, 'nrt')
  if (narrators?.length) return narrators
  try {
    const narratorsJSON = JSON.parse(fetchTagString(metadata.meta, 'calibre:user_metadata:#narrators').replace(/&quot;/g, '"'))
    return narratorsJSON['#value#']
  } catch {
    return null
  }
}

function fetchTags(metadata) {
  if (!metadata['dc:tag'] || !metadata['dc:tag'].length) return []
  return [...new Set(metadata['dc:tag'].filter((tag) => tag && typeof tag === 'string'))]
}

function stripPrefix(str) {
  if (!str) return ''
  return str.split(':').pop()
}

module.exports.parseOpfMetadataJson = (json) => {
  // Handle <package ...> or with prefix <ns0:package ...>
  const packageKey = Object.keys(json).find((key) => stripPrefix(key) === 'package')
  if (!packageKey) return null
  const prefix = packageKey.split(':').shift()
  let metadata = prefix ? json[packageKey][`${prefix}:metadata`] || json[packageKey].metadata : json[packageKey].metadata
  if (!metadata) return null

  if (Array.isArray(metadata)) {
    if (!metadata.length) return null
    metadata = metadata[0]
  }

  const metadataMeta = prefix ? metadata[`${prefix}:meta`] || metadata.meta : metadata.meta

  metadata.meta = {}
  if (metadataMeta?.length) {
    metadataMeta.forEach((meta) => {
      if (meta && meta['$'] && meta['$'].name) {
        metadata.meta[meta['$'].name] = [meta['$'].content || '']
      }
    })
  }

  const creators = parseCreators(metadata)
  const authors = (fetchCreators(creators, 'aut') || []).map((au) => au?.trim()).filter((au) => au)
  const narrators = (fetchNarrators(creators, metadata) || []).map((nrt) => nrt?.trim()).filter((nrt) => nrt)
  return {
    title: fetchTitle(metadata),
    subtitle: fetchSubtitle(metadata),
    authors,
    narrators,
    publishedYear: fetchDate(metadata),
    publisher: fetchPublisher(metadata),
    isbn: fetchISBN(metadata),
    asin: fetchASIN(metadata),
    description: fetchDescription(metadata),
    genres: fetchGenres(metadata),
    language: fetchLanguage(metadata),
    series: fetchSeries(metadataMeta),
    tags: fetchTags(metadata)
  }
}

module.exports.parseOpfMetadataXML = async (xml) => {
  const json = await xmlToJSON(xml)
  if (!json) return null
  return this.parseOpfMetadataJson(json)
}
