const tone = require('node-tone')
const fs = require('../libs/fsExtra')
const htmlSanitizer = require('../utils/htmlSanitizer')
const Logger = require('../Logger')

function getToneMetadataObject(libraryItem, chapters, trackTotal, mimeType = null) {
  const bookMetadata = libraryItem.media.metadata
  const coverPath = libraryItem.media.coverPath

  const isMp4 = mimeType === 'audio/mp4'
  const isMp3 = mimeType === 'audio/mpeg'

  const metadataObject = {
    'album': bookMetadata.title || '',
    'title': bookMetadata.title || '',
    'trackTotal': trackTotal,
    'additionalFields': {}
  }
  if (bookMetadata.subtitle) {
    metadataObject['subtitle'] = bookMetadata.subtitle
  }
  if (bookMetadata.authorName) {
    metadataObject['artist'] = bookMetadata.authorName
    metadataObject['albumArtist'] = bookMetadata.authorName
  }
  if (bookMetadata.description) {
    metadataObject['comment'] = htmlSanitizer.stripAllTags(bookMetadata.description)
    metadataObject['description'] = htmlSanitizer.stripAllTags(bookMetadata.description)
  }
  if (bookMetadata.narratorName) {
    metadataObject['narrator'] = bookMetadata.narratorName
    metadataObject['composer'] = bookMetadata.narratorName
  }
  if (bookMetadata.firstSeriesName) {
    if (!isMp3) {
      metadataObject.additionalFields['----:com.pilabor.tone:SERIES'] = bookMetadata.firstSeriesName
    }
    metadataObject['movementName'] = bookMetadata.firstSeriesName
  }
  if (bookMetadata.firstSeriesSequence) {
    // Non-mp3 
    if (!isMp3) {
      metadataObject.additionalFields['----:com.pilabor.tone:PART'] = bookMetadata.firstSeriesSequence
    }
    // MP3 Files with non-integer sequence
    const isNonIntegerSequence = String(bookMetadata.firstSeriesSequence).includes('.') || isNaN(bookMetadata.firstSeriesSequence)
    if (isMp3 && isNonIntegerSequence) {
      metadataObject.additionalFields['PART'] = bookMetadata.firstSeriesSequence
    }
    if (!isNonIntegerSequence) {
      metadataObject['movement'] = bookMetadata.firstSeriesSequence
    }
  }
  if (bookMetadata.genres.length) {
    metadataObject['genre'] = bookMetadata.genres.join('/')
  }
  if (bookMetadata.publisher) {
    metadataObject['publisher'] = bookMetadata.publisher
  }
  if (bookMetadata.asin) {
    if (!isMp3) {
      metadataObject.additionalFields['----:com.pilabor.tone:AUDIBLE_ASIN'] = bookMetadata.asin
    }
    if (!isMp4) {
      metadataObject.additionalFields['asin'] = bookMetadata.asin
    }
  }
  if (bookMetadata.isbn) {
    metadataObject.additionalFields['isbn'] = bookMetadata.isbn
  }
  if (coverPath) {
    metadataObject['coverFile'] = coverPath
  }
  if (parsePublishedYear(bookMetadata.publishedYear)) {
    metadataObject['publishingDate'] = parsePublishedYear(bookMetadata.publishedYear)
  }
  if (chapters && chapters.length > 0) {
    let metadataChapters = []
    for (const chapter of chapters) {
      metadataChapters.push({
        start: Math.round(chapter.start * 1000),
        length: Math.round((chapter.end - chapter.start) * 1000),
        title: chapter.title,
      })
    }
    metadataObject['chapters'] = metadataChapters
  }

  return metadataObject
}
module.exports.getToneMetadataObject = getToneMetadataObject

module.exports.writeToneMetadataJsonFile = (libraryItem, chapters, filePath, trackTotal, mimeType) => {
  const metadataObject = getToneMetadataObject(libraryItem, chapters, trackTotal, mimeType)
  return fs.writeFile(filePath, JSON.stringify({ meta: metadataObject }, null, 2))
}

module.exports.tagAudioFile = (filePath, payload) => {
  if (process.env.TONE_PATH) {
    tone.TONE_PATH = process.env.TONE_PATH
  }

  return tone.tag(filePath, payload).then((data) => {
    return true
  }).catch((error) => {
    Logger.error(`[toneHelpers] tagAudioFile: Failed for "${filePath}"`, error)
    return false
  })
}

function parsePublishedYear(publishedYear) {
  if (isNaN(publishedYear) || !publishedYear || Number(publishedYear) <= 0) return null
  return `01/01/${publishedYear}`
}