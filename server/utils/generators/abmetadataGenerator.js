const Logger = require('../../Logger')
const parseSeriesString = require('../parsers/parseSeriesString')

function parseJsonMetadataText(text) {
  try {
    const abmetadataData = JSON.parse(text)

    // Old metadata.json used nested "metadata"
    if (abmetadataData.metadata) {
      for (const key in abmetadataData.metadata) {
        if (abmetadataData.metadata[key] === undefined) continue
        let newModelKey = key
        if (key === 'feedUrl') newModelKey = 'feedURL'
        else if (key === 'imageUrl') newModelKey = 'imageURL'
        else if (key === 'itunesPageUrl') newModelKey = 'itunesPageURL'
        else if (key === 'type') newModelKey = 'podcastType'
        abmetadataData[newModelKey] = abmetadataData.metadata[key]
      }
    }
    delete abmetadataData.metadata

    if (abmetadataData.series?.length) {
      abmetadataData.series = [...new Set(abmetadataData.series.map((t) => t?.trim()).filter((t) => t))]
      abmetadataData.series = abmetadataData.series.map((series) => parseSeriesString.parse(series))
    }
    // clean tags & remove dupes
    if (abmetadataData.tags?.length) {
      abmetadataData.tags = [...new Set(abmetadataData.tags.map((t) => t?.trim()).filter((t) => t))]
    }
    if (abmetadataData.chapters?.length) {
      abmetadataData.chapters = cleanChaptersArray(abmetadataData.chapters, abmetadataData.title)
    }
    // clean remove dupes
    if (abmetadataData.authors?.length) {
      abmetadataData.authors = [...new Set(abmetadataData.authors.map((t) => t?.trim()).filter((t) => t))]
    }
    if (abmetadataData.narrators?.length) {
      abmetadataData.narrators = [...new Set(abmetadataData.narrators.map((t) => t?.trim()).filter((t) => t))]
    }
    if (abmetadataData.genres?.length) {
      abmetadataData.genres = [...new Set(abmetadataData.genres.map((t) => t?.trim()).filter((t) => t))]
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
