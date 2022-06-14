const { xmlToJSON } = require('../index')
const htmlSanitizer = require('../htmlSanitizer')

function parseCreators(metadata) {
  if (!metadata['dc:creator']) return null
  var creators = metadata['dc:creator']
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

function fetchCreator(creators, role) {
  if (!creators || !creators.length) return null
  var creator = creators.find(c => c.role === role)
  return creator ? creator.value : null
}

function fetchTagString(metadata, tag) {
  if (!metadata[tag] || !metadata[tag].length) return null
  var tag = metadata[tag][0]
  if (typeof tag !== 'string') return null
  return tag
}

function fetchDate(metadata) {
  var date = fetchTagString(metadata, 'dc:date')
  if (!date) return null
  var dateSplit = date.split('-')
  if (!dateSplit.length || dateSplit[0].length !== 4 || isNaN(dateSplit[0])) return null
  return dateSplit[0]
}

function fetchPublisher(metadata) {
  return fetchTagString(metadata, 'dc:publisher')
}

function fetchISBN(metadata) {
  if (!metadata['dc:identifier'] || !metadata['dc:identifier'].length) return null
  var identifiers = metadata['dc:identifier']
  var isbnObj = identifiers.find(i => i['$'] && i['$']['opf:scheme'] === 'ISBN')
  return isbnObj ? isbnObj['_'] || null : null
}

function fetchTitle(metadata) {
  return fetchTagString(metadata, 'dc:title')
}

function fetchDescription(metadata) {
  var description = fetchTagString(metadata, 'dc:description')
  if (!description) return null
  // check if description is HTML or plain text. only plain text allowed
  // calibre stores < and > as &lt; and &gt;
  description = description.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  return htmlSanitizer.stripAllTags(description)
}

function fetchGenres(metadata) {
  if (!metadata['dc:subject'] || !metadata['dc:subject'].length) return []
  return metadata['dc:subject'].map(g => typeof g === 'string' ? g : null).filter(g => !!g)
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
  var roleNrt = fetchCreator(creators, 'nrt')
  if (typeof metadata.meta == "undefined" || roleNrt != null) return roleNrt
  try {
    var narratorsJSON = JSON.parse(fetchTagString(metadata.meta, "calibre:user_metadata:#narrators").replace(/&quot;/g, '"'))
    return narratorsJSON["#value#"].join(", ")
  } catch {
    return null
  }
}

function fetchTags(metadata) {
  if (!metadata['dc:tag'] || !metadata['dc:tag'].length) return []
  return metadata['dc:tag'].filter(tag => (typeof tag === 'string'))
}

function stripPrefix(str) {
  if (!str) return ''
  return str.split(':').pop()
}

module.exports.parseOpfMetadataXML = async (xml) => {
  var json = await xmlToJSON(xml)

  if (!json) return null

  // Handle <package ...> or with prefix <ns0:package ...>
  const packageKey = Object.keys(json).find(key => stripPrefix(key) === 'package')
  if (!packageKey) return null
  const prefix = packageKey.split(':').shift()
  var metadata = prefix ? json[packageKey][`${prefix}:metadata`] || json[packageKey].metadata : json[packageKey].metadata
  if (!metadata) return null

  if (Array.isArray(metadata)) {
    if (!metadata.length) return null
    metadata = metadata[0]
  }

  const metadataMeta = prefix ? metadata[`${prefix}:meta`] || metadata.meta : metadata.meta

  metadata.meta = {}
  if (metadataMeta && metadataMeta.length) {
    metadataMeta.forEach((meta) => {
      if (meta && meta['$'] && meta['$'].name) {
        metadata.meta[meta['$'].name] = [meta['$'].content || '']
      }
    })
  }

  var creators = parseCreators(metadata)
  var data = {
    title: fetchTitle(metadata),
    author: fetchCreator(creators, 'aut'),
    narrator: fetchNarrators(creators, metadata),
    publishedYear: fetchDate(metadata),
    publisher: fetchPublisher(metadata),
    isbn: fetchISBN(metadata),
    description: fetchDescription(metadata),
    genres: fetchGenres(metadata),
    language: fetchLanguage(metadata),
    series: fetchSeries(metadata.meta),
    sequence: fetchVolumeNumber(metadata.meta),
    tags: fetchTags(metadata)
  }
  return data
}