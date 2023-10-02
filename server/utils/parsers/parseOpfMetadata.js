const { xmlToJSON } = require('../index')
const htmlSanitizer = require('../htmlSanitizer')

function parseCreators(metadata) {
  if (!metadata['dc:creator']) return null
  const creators = metadata['dc:creator']
  if (!creators.length) return null
  return creators.map(c => {
    if (typeof c !== 'object' || !c['$'] || !c['_']) return false
    return {
      value: c['_'],
      role: c['$']['opf:role'] || null,
      fileAs: c['$']['opf:file-as'] || null
    }
  })
}

function fetchCreators(creators, role) {
  if (!creators?.length) return null
  return [...new Set(creators.filter(c => c.role === role && c.value).map(c => c.value))]
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

function fetchISBN(metadata) {
  if (!metadata['dc:identifier'] || !metadata['dc:identifier'].length) return null
  const identifiers = metadata['dc:identifier']
  const isbnObj = identifiers.find(i => i['$'] && i['$']['opf:scheme'] === 'ISBN')
  return isbnObj ? isbnObj['_'] || null : null
}

function fetchASIN(metadata) {
  if (!metadata['dc:identifier'] || !metadata['dc:identifier'].length) return null
  const identifiers = metadata['dc:identifier']
  const asinObj = identifiers.find(i => i['$'] && i['$']['opf:scheme'] === 'ASIN')
  return asinObj ? asinObj['_'] || null : null
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
  return htmlSanitizer.sanitize(description)
}

function fetchGenres(metadata) {
  if (!metadata['dc:subject'] || !metadata['dc:subject'].length) return []
  return [...new Set(metadata['dc:subject'].filter(g => g && typeof g === 'string'))]
}

function fetchLanguage(metadata) {
  return fetchTagString(metadata, 'dc:language')
}

function fetchSeries(metadataMeta) {
  if (!metadataMeta) return null
  return fetchTagString(metadataMeta, "calibre:series")
}

function fetchVolumeNumber(metadataMeta) {
  if (!metadataMeta) return null
  return fetchTagString(metadataMeta, "calibre:series_index")
}

function fetchNarrators(creators, metadata) {
  const narrators = fetchCreators(creators, 'nrt')
  if (narrators?.length) return narrators
  try {
    const narratorsJSON = JSON.parse(fetchTagString(metadata.meta, "calibre:user_metadata:#narrators").replace(/&quot;/g, '"'))
    return narratorsJSON["#value#"]
  } catch {
    return null
  }
}

function fetchTags(metadata) {
  if (!metadata['dc:tag'] || !metadata['dc:tag'].length) return []
  return [...new Set(metadata['dc:tag'].filter(tag => tag && typeof tag === 'string'))]
}

function stripPrefix(str) {
  if (!str) return ''
  return str.split(':').pop()
}

module.exports.parseOpfMetadataXML = async (xml) => {
  const json = await xmlToJSON(xml)

  if (!json) return null

  // Handle <package ...> or with prefix <ns0:package ...>
  const packageKey = Object.keys(json).find(key => stripPrefix(key) === 'package')
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
  const authors = (fetchCreators(creators, 'aut') || []).map(au => au?.trim()).filter(au => au)
  const narrators = (fetchNarrators(creators, metadata) || []).map(nrt => nrt?.trim()).filter(nrt => nrt)
  const data = {
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
    series: fetchSeries(metadata.meta),
    sequence: fetchVolumeNumber(metadata.meta),
    tags: fetchTags(metadata)
  }
  return data
}