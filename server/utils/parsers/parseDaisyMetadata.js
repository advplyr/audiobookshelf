const h = require('htmlparser2')
const parseNameString = require('./parseNameString')

function getValues(metaTags, tagName) {
  return metaTags[tagName]?.filter((v) => v) || []
}

function getFirstValue(metaTags, tagNames) {
  for (const tagName of tagNames) {
    const values = getValues(metaTags, tagName)
    if (values.length) return values[0]
  }
  return null
}

function parseNameValues(values) {
  const names = []
  values.forEach((value) => {
    const parsedNames = parseNameString.parse(value)?.names || value.split(/\s*;\s*/).filter((n) => n)
    parsedNames.forEach((name) => {
      if (!names.includes(name)) names.push(name)
    })
  })
  return names
}

function parseStringList(values) {
  const items = []
  values.forEach((value) => {
    value.split(/\s*[;,]\s*/).forEach((item) => {
      if (item && !items.includes(item)) {
        items.push(item)
      }
    })
  })
  return items
}

function extractYear(str) {
  if (!str) return null
  const match = str.match(/\d{4}/)
  return match ? match[0] : null
}

function extractIdentifierValue(identifier, identifierType) {
  if (!identifier) return null

  const value = identifier.trim()
  const expression = identifierType === 'isbn'
    ? /(?:^|[^a-z0-9])(97[89][\d\- ]{9,16}[\dx]|[\d\- ]{9,14}[\dx])(?:$|[^a-z0-9])/i
    : /(?:^|[^a-z0-9])([a-z0-9]{10})(?:$|[^a-z0-9])/i

  const match = value.match(expression)
  if (!match) return null
  return (match[1] || match[0]).replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').trim()
}

function parseIdentifier(metaTags, identifierType) {
  const typeTag = identifierType === 'isbn' ? 'dc:identifier:isbn' : 'dc:identifier:asin'
  const typedIdentifier = getFirstValue(metaTags, [typeTag, identifierType])
  if (typedIdentifier) {
    const extracted = extractIdentifierValue(typedIdentifier, identifierType)
    if (extracted) return extracted
  }

  const identifierValues = [
    ...getValues(metaTags, 'dc:identifier'),
    ...getValues(metaTags, 'ncc:identifier'),
    ...(identifierType === 'isbn' ? getValues(metaTags, 'dc:source') : [])
  ]
  for (const identifier of identifierValues) {
    if (identifierType === 'isbn' && /isbn/i.test(identifier)) {
      const extracted = extractIdentifierValue(identifier, identifierType)
      if (extracted) return extracted
    }
    if (identifierType === 'asin' && /asin/i.test(identifier)) {
      const extracted = extractIdentifierValue(identifier, identifierType)
      if (extracted) return extracted
    }
  }

  for (const identifier of identifierValues) {
    const extracted = extractIdentifierValue(identifier, identifierType)
    if (extracted) return extracted
  }
  return null
}

function parseDaisyMetadata(htmlText) {
  if (!htmlText) return null

  const metaTags = {}
  let titleText = ''
  let inTitle = false
  let currentHeadingName = null
  let currentHeadingText = ''
  const chapterTitles = []

  const parser = new h.Parser(
    {
      onopentag: (name, attribs) => {
        if (name === 'title') {
          inTitle = true
        }
        if (/^h[1-6]$/.test(name)) {
          currentHeadingName = name
          currentHeadingText = ''
        }
        if (name !== 'meta') return

        const tagName = attribs.name?.trim().toLowerCase()
        const content = attribs.content?.trim()
        if (!tagName || !content) return

        if (!metaTags[tagName]) metaTags[tagName] = []
        metaTags[tagName].push(content)
      },
      ontext: (text) => {
        if (inTitle) titleText += text
        if (currentHeadingName) currentHeadingText += text
      },
      onclosetag: (name) => {
        if (name === 'title') {
          inTitle = false
        }
        if (name === currentHeadingName) {
          const chapterTitle = currentHeadingText.replace(/\s+/g, ' ').trim()
          if (chapterTitle) {
            chapterTitles.push(chapterTitle)
          }
          currentHeadingName = null
          currentHeadingText = ''
        }
      }
    },
    { decodeEntities: true }
  )

  parser.write(htmlText)
  parser.end()

  const creators = parseNameValues(getValues(metaTags, 'dc:creator'))
  const narrators = parseNameValues(getValues(metaTags, 'ncc:narrator'))
  const subjects = parseStringList([
    ...getValues(metaTags, 'dc:subject'),
    ...getValues(metaTags, 'ncc:subject')
  ])
  const tags = parseStringList([
    ...getValues(metaTags, 'ncc:keywords'),
    ...getValues(metaTags, 'dc:tag')
  ])

  const metadata = {
    title: getFirstValue(metaTags, ['dc:title']) || titleText.trim() || null,
    authors: creators,
    narrators,
    publishedYear: extractYear(getFirstValue(metaTags, ['dc:date', 'ncc:revisiondate'])),
    publisher: getFirstValue(metaTags, ['dc:publisher']),
    description: getFirstValue(metaTags, ['dc:description']),
    language: getFirstValue(metaTags, ['dc:language']),
    genres: subjects,
    tags,
    isbn: parseIdentifier(metaTags, 'isbn'),
    asin: parseIdentifier(metaTags, 'asin'),
    chapters: chapterTitles.map((title) => ({ title }))
  }

  for (const key in metadata) {
    if (metadata[key] === null) {
      delete metadata[key]
    }
  }

  return metadata
}

module.exports = { parseDaisyMetadata }
