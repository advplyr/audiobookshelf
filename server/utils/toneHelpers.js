const tone = require('node-tone')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')

function getToneMetadataObject(libraryItem, chapters, trackTotal) {
  const bookMetadata = libraryItem.media.metadata
  const coverPath = libraryItem.media.coverPath

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
    metadataObject['comment'] = bookMetadata.description
    metadataObject['description'] = bookMetadata.description
  }
  if (bookMetadata.narratorName) {
    metadataObject['narrator'] = bookMetadata.narratorName
    metadataObject['composer'] = bookMetadata.narratorName
  }
  if (bookMetadata.firstSeriesName) {
    metadataObject['movementName'] = bookMetadata.firstSeriesName
  }
  if (bookMetadata.firstSeriesSequence) {
    metadataObject['movement'] = bookMetadata.firstSeriesSequence
  }
  if (bookMetadata.genres.length) {
    metadataObject['genre'] = bookMetadata.genres.join('/')
  }
  if (bookMetadata.publisher) {
    metadataObject['publisher'] = bookMetadata.publisher
  }
  if (bookMetadata.asin) {
    metadataObject.additionalFields['asin'] = bookMetadata.asin
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

module.exports.writeToneMetadataJsonFile = (libraryItem, chapters, filePath, trackTotal) => {
  const metadataObject = getToneMetadataObject(libraryItem, chapters, trackTotal)
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