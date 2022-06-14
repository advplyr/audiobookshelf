const fs = require('fs-extra')
const filePerms = require('./filePerms')
const package = require('../../package.json')
const Logger = require('../Logger')
const { getId } = require('./index')


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
  return v.split(',').map(_v => _v.trim()).filter(_v => _v)
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
        var sequence = null
        var name = series
        var matchResults = series.match(/ #((?:\d*\.?\d+)|(?:\.?\d*))$/) // Pull out sequence #
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
  }
}

const metadataMappers = {
  book: bookMetadataMapper,
  podcast: podcastMetadataMapper
}

function generate(libraryItem, outputPath) {
  var fileString = `;ABMETADATA${CurrentAbMetadataVersion}\n`
  fileString += `#audiobookshelf v${package.version}\n\n`

  const mediaType = libraryItem.mediaType

  fileString += `media=${mediaType}\n`

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

function parseAbMetadataText(text, mediaType) {
  if (!text) return null
  var lines = text.split(/\r?\n/)

  // Check first line and get abmetadata version number
  var firstLine = lines.shift().toLowerCase()
  if (!firstLine.startsWith(';abmetadata')) {
    Logger.error(`Invalid abmetadata file first line is not ;abmetadata "${firstLine}"`)
    return null
  }
  var abmetadataVersion = Number(firstLine.replace(';abmetadata', '').trim())
  if (isNaN(abmetadataVersion) || abmetadataVersion != CurrentAbMetadataVersion) {
    Logger.warn(`Invalid abmetadata version ${abmetadataVersion} - must use version ${CurrentAbMetadataVersion}`)
    return null
  }

  // Remove comments and empty lines
  const ignoreFirstChars = [' ', '#', ';'] // Ignore any line starting with the following
  lines = lines.filter(line => !!line.trim() && !ignoreFirstChars.includes(line[0]))

  // Get lines that map to book details (all lines before the first chapter or description section)
  var firstSectionLine = lines.findIndex(l => l.startsWith('['))
  var detailLines = firstSectionLine > 0 ? lines.slice(0, firstSectionLine) : lines
  var remainingLines = firstSectionLine > 0 ? lines.slice(firstSectionLine) : []

  if (!detailLines.length) {
    Logger.error(`Invalid abmetadata file no detail lines`)
    return null
  }

  // Check the media type saved for this abmetadata file show warning if not matching expected
  if (detailLines[0].toLowerCase().startsWith('media=')) {
    var mediaLine = detailLines.shift() // Remove media line
    var abMediaType = mediaLine.toLowerCase().split('=')[1].trim()
    if (abMediaType != mediaType) {
      Logger.warn(`Invalid media type in abmetadata file ${abMediaType} expecting ${mediaType}`)
    }
  } else {
    Logger.warn(`No media type found in abmetadata file - expecting ${mediaType}`)
  }

  const metadataMapper = metadataMappers[mediaType]
  // Put valid book detail values into map
  const mediaMetadataDetails = {}
  for (let i = 0; i < detailLines.length; i++) {
    var line = detailLines[i]
    var keyValue = line.split('=')
    if (keyValue.length < 2) {
      Logger.warn('abmetadata invalid line has no =', line)
    } else if (!metadataMapper[keyValue[0].trim()]) {
      Logger.warn(`abmetadata key "${keyValue[0].trim()}" is not a valid ${mediaType} metadata key`)
    } else {
      var key = keyValue.shift().trim()
      var value = keyValue.join('=').trim()
      mediaMetadataDetails[key] = metadataMapper[key].from(value)
    }
  }

  const chapters = []

  // Parse sections for description and chapters
  var sections = parseSections(remainingLines)
  sections.forEach((section) => {
    var sectionHeader = section.shift()
    if (sectionHeader.toLowerCase().startsWith('[description]')) {
      mediaMetadataDetails.description = section.join('\n')
    } else if (sectionHeader.toLowerCase().startsWith('[chapter]')) {
      var chapter = parseChapterLines(section)
      if (chapter) {
        chapters.push(chapter)
      }
    }
  })

  chapters.sort((a, b) => a.start - b.start)

  return {
    metadata: mediaMetadataDetails,
    chapters
  }
}
module.exports.parse = parseAbMetadataText

function checkUpdatedBookAuthors(abmetadataAuthors, authors) {
  var finalAuthors = []
  var hasUpdates = false

  abmetadataAuthors.forEach((authorName) => {
    var findAuthor = authors.find(au => au.name.toLowerCase() == authorName.toLowerCase())
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

// Input text from abmetadata file and return object of metadata changes from media metadata
function parseAndCheckForUpdates(text, mediaMetadata, mediaType) {
  if (!text || !mediaMetadata || !mediaType) {
    Logger.error(`Invalid inputs to parseAndCheckForUpdates`)
    return null
  }

  var updatePayload = {} // Only updated key/values

  var abmetadataData = parseAbMetadataText(text, mediaType)
  if (!abmetadataData || !abmetadataData.metadata) {
    return null
  }

  var abMetadata = abmetadataData.metadata // Metadata from abmetadata file

  for (const key in abMetadata) {
    if (mediaMetadata[key] !== undefined) {
      if (key === 'authors') {
        var authorUpdatePayload = checkUpdatedBookAuthors(abMetadata[key], mediaMetadata[key])
        if (authorUpdatePayload.hasUpdates) updatePayload.authors = authorUpdatePayload.authors
      } else if (key === 'series') {
        var seriesUpdatePayload = checkUpdatedBookSeries(abMetadata[key], mediaMetadata[key])
        if (seriesUpdatePayload.hasUpdates) updatePayload.series = seriesUpdatePayload.series
      } else if (key === 'genres' || key === 'narrators') { // Compare array differences
        if (checkArraysChanged(abMetadata[key], mediaMetadata[key])) {
          updatePayload[key] = abMetadata[key]
        }
      } else if (abMetadata[key] !== mediaMetadata[key]) {
        updatePayload[key] = abMetadata[key]
      }
    } else {
      Logger.warn('[abmetadataGenerator] Invalid key', key)
    }
  }

  return updatePayload
}
module.exports.parseAndCheckForUpdates = parseAndCheckForUpdates