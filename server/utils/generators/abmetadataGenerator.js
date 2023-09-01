const fs = require('../../libs/fsExtra')
const filePerms = require('../filePerms')
const package = require('../../../package.json')
const Logger = require('../../Logger')
const { getId } = require('../index')
const areEquivalent = require('../areEquivalent')


const CurrentAbMetadataVersion = 2
// abmetadata v1 key map
// const bookKeyMap = {
//   title: 'title',
//   subtitle: 'subtitle',
//   author: 'authorFL',
//   narrator: 'narratorFL',
//   publishedYear: 'publishedYear',
//   publisher: 'publisher',
//   description: 'description',
//   isbn: 'isbn',
//   asin: 'asin',
//   language: 'language',
//   genres: 'genresCommaSeparated'
// }

const commaSeparatedToArray = (v) => {
  if (!v) return []
  return [...new Set(v.split(',').map(_v => _v.trim()).filter(_v => _v))]
}

const podcastMetadataMapper = {
  title: {
    to: (m) => m.title || '',
    from: (v) => v || ''
  },
  author: {
    to: (m) => m.author || '',
    from: (v) => v || null
  },
  language: {
    to: (m) => m.language || '',
    from: (v) => v || null
  },
  genres: {
    to: (m) => m.genres.join(', '),
    from: (v) => commaSeparatedToArray(v)
  },
  feedUrl: {
    to: (m) => m.feedUrl || '',
    from: (v) => v || null
  },
  itunesId: {
    to: (m) => m.itunesId || '',
    from: (v) => v || null
  },
  explicit: {
    to: (m) => m.explicit ? 'Y' : 'N',
    from: (v) => v && v.toLowerCase() == 'y'
  }
}

const bookMetadataMapper = {
  title: {
    to: (m) => m.title || '',
    from: (v) => v || ''
  },
  subtitle: {
    to: (m) => m.subtitle || '',
    from: (v) => v || null
  },
  authors: {
    to: (m) => m.authorName || '',
    from: (v) => commaSeparatedToArray(v)
  },
  narrators: {
    to: (m) => m.narratorName || '',
    from: (v) => commaSeparatedToArray(v)
  },
  publishedYear: {
    to: (m) => m.publishedYear || '',
    from: (v) => v || null
  },
  publisher: {
    to: (m) => m.publisher || '',
    from: (v) => v || null
  },
  isbn: {
    to: (m) => m.isbn || '',
    from: (v) => v || null
  },
  asin: {
    to: (m) => m.asin || '',
    from: (v) => v || null
  },
  language: {
    to: (m) => m.language || '',
    from: (v) => v || null
  },
  genres: {
    to: (m) => m.genres.join(', '),
    from: (v) => commaSeparatedToArray(v)
  },
  series: {
    to: (m) => m.seriesName,
    from: (v) => {
      return commaSeparatedToArray(v).map(series => { // Return array of { name, sequence }
        let sequence = null
        let name = series
        // Series sequence match any characters after " #" other than whitespace and another #
        //  e.g. "Name #1a" is valid. "Name #1#a" or "Name #1 a" is not valid.
        const matchResults = series.match(/ #([^#\s]+)$/) // Pull out sequence #
        if (matchResults && matchResults.length && matchResults.length > 1) {
          sequence = matchResults[1] // Group 1
          name = series.replace(matchResults[0], '')
        }
        return {
          name,
          sequence
        }
      })
    }
  },
  explicit: {
    to: (m) => m.explicit ? 'Y' : 'N',
    from: (v) => v && v.toLowerCase() == 'y'
  },
  abridged: {
    to: (m) => m.abridged ? 'Y' : 'N',
    from: (v) => v && v.toLowerCase() == 'y'
  }
}

const metadataMappers = {
  book: bookMetadataMapper,
  podcast: podcastMetadataMapper
}

function generate(libraryItem, outputPath) {
  let fileString = `;ABMETADATA${CurrentAbMetadataVersion}\n`
  fileString += `#audiobookshelf v${package.version}\n\n`

  const mediaType = libraryItem.mediaType

  fileString += `media=${mediaType}\n`
  fileString += `tags=${JSON.stringify(libraryItem.media.tags)}\n`

  const metadataMapper = metadataMappers[mediaType]
  var mediaMetadata = libraryItem.media.metadata
  for (const key in metadataMapper) {
    fileString += `${key}=${metadataMapper[key].to(mediaMetadata)}\n`
  }

  // Description block
  if (mediaMetadata.description) {
    fileString += '\n[DESCRIPTION]\n'
    fileString += mediaMetadata.description + '\n'
  }

  // Book chapters
  if (libraryItem.mediaType == 'book' && libraryItem.media.chapters.length) {
    fileString += '\n'
    libraryItem.media.chapters.forEach((chapter) => {
      fileString += `[CHAPTER]\n`
      fileString += `start=${chapter.start}\n`
      fileString += `end=${chapter.end}\n`
      fileString += `title=${chapter.title}\n`
    })
  }
  return fs.writeFile(outputPath, fileString).then(() => {
    return filePerms.setDefault(outputPath, true).then(() => true)
  }).catch((error) => {
    Logger.error(`[absMetaFileGenerator] Failed to save abs file`, error)
    return false
  })
}
module.exports.generate = generate

function parseSections(lines) {
  if (!lines || !lines.length || !lines[0].startsWith('[')) { // First line must be section start
    return []
  }

  var sections = []
  var currentSection = []
  lines.forEach(line => {
    if (!line || !line.trim()) return

    if (line.startsWith('[') && currentSection.length) { // current section ended
      sections.push(currentSection)
      currentSection = []
    }

    currentSection.push(line)
  })
  if (currentSection.length) sections.push(currentSection)
  return sections
}

// lines inside chapter section
function parseChapterLines(lines) {
  var chapter = {
    start: null,
    end: null,
    title: null
  }

  lines.forEach((line) => {
    var keyValue = line.split('=')
    if (keyValue.length > 1) {
      var key = keyValue[0].trim()
      var value = keyValue[1].trim()

      if (key === 'start' || key === 'end') {
        if (!isNaN(value)) {
          chapter[key] = Number(value)
        } else {
          Logger.warn(`[abmetadataGenerator] Invalid chapter value for ${key}: ${value}`)
        }
      } else if (key === 'title') {
        chapter[key] = value
      }
    }
  })

  if (chapter.start === null || chapter.end === null || chapter.end < chapter.start) {
    Logger.warn(`[abmetadataGenerator] Invalid chapter`)
    return null
  }
  return chapter
}

function parseTags(value) {
  if (!value) return null
  try {
    const parsedTags = []
    JSON.parse(value).forEach((loadedTag) => {
      if (loadedTag.trim()) parsedTags.push(loadedTag) // Only push tags that are non-empty
    })
    return parsedTags
  } catch (err) {
    Logger.error(`[abmetadataGenerator] Error parsing TAGS "${value}":`, err.message)
    return null
  }
}

function parseAbMetadataText(text, mediaType) {
  if (!text) return null
  let lines = text.split(/\r?\n/)

  // Check first line and get abmetadata version number
  const firstLine = lines.shift().toLowerCase()
  if (!firstLine.startsWith(';abmetadata')) {
    Logger.error(`Invalid abmetadata file first line is not ;abmetadata "${firstLine}"`)
    return null
  }
  const abmetadataVersion = Number(firstLine.replace(';abmetadata', '').trim())
  if (isNaN(abmetadataVersion) || abmetadataVersion != CurrentAbMetadataVersion) {
    Logger.warn(`Invalid abmetadata version ${abmetadataVersion} - must use version ${CurrentAbMetadataVersion}`)
    return null
  }

  // Remove comments and empty lines
  const ignoreFirstChars = [' ', '#', ';'] // Ignore any line starting with the following
  lines = lines.filter(line => !!line.trim() && !ignoreFirstChars.includes(line[0]))

  // Get lines that map to book details (all lines before the first chapter or description section)
  const firstSectionLine = lines.findIndex(l => l.startsWith('['))
  const detailLines = firstSectionLine > 0 ? lines.slice(0, firstSectionLine) : lines
  const remainingLines = firstSectionLine > 0 ? lines.slice(firstSectionLine) : []

  if (!detailLines.length) {
    Logger.error(`Invalid abmetadata file no detail lines`)
    return null
  }

  // Check the media type saved for this abmetadata file show warning if not matching expected
  if (detailLines[0].toLowerCase().startsWith('media=')) {
    const mediaLine = detailLines.shift() // Remove media line
    const abMediaType = mediaLine.toLowerCase().split('=')[1].trim()
    if (abMediaType != mediaType) {
      Logger.warn(`Invalid media type in abmetadata file ${abMediaType} expecting ${mediaType}`)
    }
  } else {
    Logger.warn(`No media type found in abmetadata file - expecting ${mediaType}`)
  }

  const metadataMapper = metadataMappers[mediaType]
  // Put valid book detail values into map
  const mediaDetails = {
    metadata: {},
    chapters: [],
    tags: null // When tags are null it will not be used
  }

  for (let i = 0; i < detailLines.length; i++) {
    const line = detailLines[i]
    const keyValue = line.split('=')
    if (keyValue.length < 2) {
      Logger.warn('abmetadata invalid line has no =', line)
    } else if (keyValue[0].trim() === 'tags') { // Parse tags
      const value = keyValue.slice(1).join('=').trim() // Everything after "tags="
      mediaDetails.tags = parseTags(value)
    } else if (!metadataMapper[keyValue[0].trim()]) { // Ensure valid media metadata key
      Logger.warn(`abmetadata key "${keyValue[0].trim()}" is not a valid ${mediaType} metadata key`)
    } else {
      const key = keyValue.shift().trim()
      const value = keyValue.join('=').trim()
      mediaDetails.metadata[key] = metadataMapper[key].from(value)
    }
  }

  // Parse sections for description and chapters
  const sections = parseSections(remainingLines)
  sections.forEach((section) => {
    const sectionHeader = section.shift()
    if (sectionHeader.toLowerCase().startsWith('[description]')) {
      mediaDetails.metadata.description = section.join('\n')
    } else if (sectionHeader.toLowerCase().startsWith('[chapter]')) {
      const chapter = parseChapterLines(section)
      if (chapter) {
        mediaDetails.chapters.push(chapter)
      }
    }
  })

  mediaDetails.chapters.sort((a, b) => a.start - b.start)

  return mediaDetails
}
module.exports.parse = parseAbMetadataText

function checkUpdatedBookAuthors(abmetadataAuthors, authors) {
  const finalAuthors = []
  let hasUpdates = false

  abmetadataAuthors.forEach((authorName) => {
    const findAuthor = authors.find(au => au.name.toLowerCase() == authorName.toLowerCase())
    if (!findAuthor) {
      hasUpdates = true
      finalAuthors.push({
        id: getId('new'), // New author gets created in Scanner.js after library scan
        name: authorName
      })
    } else {
      finalAuthors.push(findAuthor)
    }
  })

  var authorsRemoved = authors.filter(au => !abmetadataAuthors.some(auname => auname.toLowerCase() == au.name.toLowerCase()))
  if (authorsRemoved.length) {
    hasUpdates = true
  }

  return {
    authors: finalAuthors,
    hasUpdates
  }
}

function checkUpdatedBookSeries(abmetadataSeries, series) {
  var finalSeries = []
  var hasUpdates = false

  abmetadataSeries.forEach((seriesObj) => {
    var findSeries = series.find(se => se.name.toLowerCase() == seriesObj.name.toLowerCase())
    if (!findSeries) {
      hasUpdates = true
      finalSeries.push({
        id: getId('new'), // New series gets created in Scanner.js after library scan
        name: seriesObj.name,
        sequence: seriesObj.sequence
      })
    } else if (findSeries.sequence != seriesObj.sequence) { // Sequence was updated
      hasUpdates = true
      finalSeries.push({
        id: findSeries.id,
        name: findSeries.name,
        sequence: seriesObj.sequence
      })
    } else {
      finalSeries.push(findSeries)
    }
  })

  var seriesRemoved = series.filter(se => !abmetadataSeries.some(_se => _se.name.toLowerCase() == se.name.toLowerCase()))
  if (seriesRemoved.length) {
    hasUpdates = true
  }

  return {
    series: finalSeries,
    hasUpdates
  }
}

function checkArraysChanged(abmetadataArray, mediaArray) {
  if (!Array.isArray(abmetadataArray)) return false
  if (!Array.isArray(mediaArray)) return true
  return abmetadataArray.join(',') != mediaArray.join(',')
}

function parseJsonMetadataText(text) {
  try {
    const abmetadataData = JSON.parse(text)
    if (!abmetadataData.metadata) abmetadataData.metadata = {}

    if (abmetadataData.metadata.series?.length) {
      abmetadataData.metadata.series = [...new Set(abmetadataData.metadata.series.map(t => t?.trim()).filter(t => t))]
      abmetadataData.metadata.series = abmetadataData.metadata.series.map(series => {
        let sequence = null
        let name = series
        // Series sequence match any characters after " #" other than whitespace and another #
        //  e.g. "Name #1a" is valid. "Name #1#a" or "Name #1 a" is not valid.
        const matchResults = series.match(/ #([^#\s]+)$/) // Pull out sequence #
        if (matchResults && matchResults.length && matchResults.length > 1) {
          sequence = matchResults[1] // Group 1
          name = series.replace(matchResults[0], '')
        }
        return {
          name,
          sequence
        }
      })
    }
    // clean tags & remove dupes
    if (abmetadataData.tags?.length) {
      abmetadataData.tags = [...new Set(abmetadataData.tags.map(t => t?.trim()).filter(t => t))]
    }
    // TODO: Clean chapters
    if (abmetadataData.chapters?.length) {

    }
    // clean remove dupes
    if (abmetadataData.metadata.authors?.length) {
      abmetadataData.metadata.authors = [...new Set(abmetadataData.metadata.authors.map(t => t?.trim()).filter(t => t))]
    }
    if (abmetadataData.metadata.narrators?.length) {
      abmetadataData.metadata.narrators = [...new Set(abmetadataData.metadata.narrators.map(t => t?.trim()).filter(t => t))]
    }
    if (abmetadataData.metadata.genres?.length) {
      abmetadataData.metadata.genres = [...new Set(abmetadataData.metadata.genres.map(t => t?.trim()).filter(t => t))]
    }
    return abmetadataData
  } catch (error) {
    Logger.error(`[abmetadataGenerator] Invalid metadata.json JSON`, error)
    return null
  }
}
module.exports.parseJson = parseJsonMetadataText

function cleanChaptersArray(chaptersArray, mediaTitle) {
  const chapters = []
  let index = 0
  for (const chap of chaptersArray) {
    if (chap.start === null || isNaN(chap.start)) {
      Logger.error(`[abmetadataGenerator] Invalid chapter start time ${chap.start} for "${mediaTitle}" metadata file`)
      return null
    }
    if (chap.end === null || isNaN(chap.end)) {
      Logger.error(`[abmetadataGenerator] Invalid chapter end time ${chap.end} for "${mediaTitle}" metadata file`)
      return null
    }
    if (!chap.title || typeof chap.title !== 'string') {
      Logger.error(`[abmetadataGenerator] Invalid chapter title ${chap.title} for "${mediaTitle}" metadata file`)
      return null
    }

    chapters.push({
      id: index++,
      start: chap.start,
      end: chap.end,
      title: chap.title
    })
  }
  return chapters
}

// Input text from abmetadata file and return object of media changes
//  only returns object of changes. empty object means no changes
function parseAndCheckForUpdates(text, media, mediaType, isJSON) {
  if (!text || !media || !media.metadata || !mediaType) {
    Logger.error(`Invalid inputs to parseAndCheckForUpdates`)
    return null
  }

  const mediaMetadata = media.metadata
  const metadataUpdatePayload = {} // Only updated key/values

  let abmetadataData = null

  if (isJSON) {
    abmetadataData = parseJsonMetadataText(text)
  } else {
    abmetadataData = parseAbMetadataText(text, mediaType)
  }

  if (!abmetadataData || !abmetadataData.metadata) {
    Logger.error(`[abmetadataGenerator] Invalid metadata file`)
    return null
  }

  const abMetadata = abmetadataData.metadata // Metadata from abmetadata file
  for (const key in abMetadata) {
    if (mediaMetadata[key] !== undefined) {
      if (key === 'authors') {
        const authorUpdatePayload = checkUpdatedBookAuthors(abMetadata[key], mediaMetadata[key])
        if (authorUpdatePayload.hasUpdates) metadataUpdatePayload.authors = authorUpdatePayload.authors
      } else if (key === 'series') {
        const seriesUpdatePayload = checkUpdatedBookSeries(abMetadata[key], mediaMetadata[key])
        if (seriesUpdatePayload.hasUpdates) metadataUpdatePayload.series = seriesUpdatePayload.series
      } else if (key === 'genres' || key === 'narrators') { // Compare array differences
        if (checkArraysChanged(abMetadata[key], mediaMetadata[key])) {
          metadataUpdatePayload[key] = abMetadata[key]
        }
      } else if (abMetadata[key] !== mediaMetadata[key]) {
        metadataUpdatePayload[key] = abMetadata[key]
      }
    } else {
      Logger.warn('[abmetadataGenerator] Invalid key', key)
    }
  }

  const updatePayload = {} // Only updated key/values
  // Check update tags
  if (abmetadataData.tags) {
    if (checkArraysChanged(abmetadataData.tags, media.tags)) {
      updatePayload.tags = abmetadataData.tags
    }
  }

  if (abmetadataData.chapters && mediaType === 'book') {
    const abmetadataChaptersCleaned = cleanChaptersArray(abmetadataData.chapters)
    if (abmetadataChaptersCleaned) {
      if (!areEquivalent(abmetadataChaptersCleaned, media.chapters)) {
        updatePayload.chapters = abmetadataChaptersCleaned
      }
    }
  }

  if (Object.keys(metadataUpdatePayload).length) {
    updatePayload.metadata = metadataUpdatePayload
  }

  return updatePayload
}
module.exports.parseAndCheckForUpdates = parseAndCheckForUpdates
