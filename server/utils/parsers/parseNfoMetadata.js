function parseNfoMetadata(nfoText) {
  if (!nfoText) return null
  const lines = nfoText.split(/\r?\n/)
  const metadata = {}
  let insideBookDescription = false
  lines.forEach(line => {
    if (line.search(/^\s*book description\s*$/i) !== -1) {
      insideBookDescription = true
      return
    }
    if (insideBookDescription) {
      if (line.search(/^\s*=+\s*$/i) !== -1) return
      metadata.description = metadata.description || ''
      metadata.description += line + '\n'
      return
    }
    const match = line.match(/^(.*?):(.*)$/)
    if (match) {
      const key = match[1].toLowerCase().trim()
      const value = match[2].trim()
      if (!value) return
      switch (key) {
        case 'title':
          {
            const titleMatch = value.match(/^(.*?):(.*)$/)
            if (titleMatch) {
              metadata.title = titleMatch[1].trim()
              metadata.subtitle = titleMatch[2].trim()
            } else {
              metadata.title = value
            }
          }
          break
        case 'author':
          metadata.authors = value.split(/\s*,\s*/).filter(v => v)
          break
        case 'narrator':
        case 'read by':
          metadata.narrators = value.split(/\s*,\s*/).filter(v => v)
          break
        case 'series name':
          metadata.series = value
          break
        case 'genre':
          metadata.genres = value.split(/\s*,\s*/).filter(v => v)
          break
        case 'tags':
          metadata.tags = value.split(/\s*,\s*/).filter(v => v)
          break
        case 'copyright':
        case 'audible.com release':
        case 'audiobook copyright':
        case 'book copyright':
        case 'recording copyright':
        case 'release date':
        case 'date':
          {
            const year = extractYear(value)
            if (year) {
              metadata.publishedYear = year
            }
          }
          break
        case 'position in series':
          metadata.sequence = value
          break
        case 'unabridged':
          metadata.abridged = value.toLowerCase() === 'yes' ? false : true
          break
        case 'abridged':
          metadata.abridged = value.toLowerCase() === 'no' ? false : true
          break
        case 'publisher':
          metadata.publisher = value
          break
        case 'asin':
          metadata.asin = value
          break
        case 'isbn':
        case 'isbn-10':
        case 'isbn-13':
          metadata.isbn = value
          break
        case 'language':
        case 'lang':
          metadata.language = value
          break
      }
    }
  })

  // Trim leading/trailing whitespace for description
  if (metadata.description) {
    metadata.description = metadata.description.trim()
  }

  return metadata
}
module.exports = { parseNfoMetadata }

function extractYear(str) {
  const match = str.match(/\d{4}/g)
  return match ? match[match.length - 1] : null
}