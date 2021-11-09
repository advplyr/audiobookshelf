const { xmlToJSON } = require('./index')

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

function fetchDate(metadata) {
  if (!metadata['dc:date']) return null
  var dates = metadata['dc:date']
  if (!dates.length || typeof dates[0] !== 'string') return null
  var dateSplit = dates[0].split('-')
  if (!dateSplit.length || dateSplit[0].length !== 4 || isNaN(dateSplit[0])) return null
  return dateSplit[0]
}

function fetchPublisher(metadata) {
  if (!metadata['dc:publisher']) return null
  var publishers = metadata['dc:publisher']
  if (!publishers.length || typeof publishers[0] !== 'string') return null
  return publishers[0]
}

function fetchISBN(metadata) {
  if (!metadata['dc:identifier'] || !metadata['dc:identifier'].length) return null
  var identifiers = metadata['dc:identifier']
  var isbnObj = identifiers.find(i => i['$'] && i['$']['opf:scheme'] === 'ISBN')
  return isbnObj ? isbnObj['_'] || null : null
}

function fetchTitle(metadata) {
  if (!metadata['dc:title']) return null
  var titles = metadata['dc:title']
  if (!titles.length) return null
  if (typeof titles[0] === 'string') {
    return titles[0]
  }
  if (titles[0]['_']) {
    return titles[0]['_']
  }
  return null
}

module.exports.parseOpfMetadataXML = async (xml) => {
  var json = await xmlToJSON(xml)
  if (!json || !json.package || !json.package.metadata) return null
  var metadata = json.package.metadata
  if (Array.isArray(metadata)) {
    if (!metadata.length) return null
    metadata = metadata[0]
  }

  var creators = parseCreators(metadata)
  var data = {
    title: fetchTitle(metadata),
    author: fetchCreator(creators, 'aut'),
    narrator: fetchCreator(creators, 'nrt'),
    publishYear: fetchDate(metadata),
    publisher: fetchPublisher(metadata),
    isbn: fetchISBN(metadata)
  }
  return data
}