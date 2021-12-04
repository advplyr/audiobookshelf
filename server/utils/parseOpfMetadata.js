const { xmlToJSON } = require('./index')
const { stripHtml } = require("string-strip-html")

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
  if (description.match(/<!DOCTYPE html>|<\/?\s*[a-z-][^>]*\s*>|(\&(?:[\w\d]+|#\d+|#x[a-f\d]+);)/)) return stripHtml(description).result
  return description
}

function fetchGenres(metadata) {
  if (!metadata['dc:subject'] || !metadata['dc:subject'].length) return []
  return metadata['dc:subject'].map(g => typeof g === 'string' ? g : null).filter(g => !!g)
}

function fetchLanguage(metadata) {
  return fetchTagString(metadata, 'dc:language')
}

function fetchSeries(metadata) {
  if(typeof metadata.meta == "undefined") return null
  return fetchTagString(metadata.meta, "calibre:series")
}

function fetchVolumeNumber(metadata) {
  if(typeof metadata.meta == "undefined") return null
  return fetchTagString(metadata.meta, "calibre:series_index")
}

module.exports.parseOpfMetadataXML = async (xml) => {
  var json = await xmlToJSON(xml)
  if (!json || !json.package || !json.package.metadata) return null
  var metadata = json.package.metadata

  if (Array.isArray(metadata)) {
    if (!metadata.length) return null
    metadata = metadata[0]
  }

  if (typeof metadata.meta != "undefined") {
    metadata.meta = {}
    for(var match of xml.matchAll(/<meta name="(?<name>.+)" content="(?<content>.+)"\/>/g)) {
      metadata.meta[match.groups['name']] = [match.groups['content']]
    }
  }

  var creators = parseCreators(metadata)
  var data = {
    title: fetchTitle(metadata),
    author: fetchCreator(creators, 'aut'),
    narrator: fetchCreator(creators, 'nrt'),
    publishYear: fetchDate(metadata),
    publisher: fetchPublisher(metadata),
    isbn: fetchISBN(metadata),
    description: fetchDescription(metadata),
    genres: fetchGenres(metadata),
    language: fetchLanguage(metadata),
    series: fetchSeries(metadata),
    volumeNumber: fetchVolumeNumber(metadata)
  }
  return data
}