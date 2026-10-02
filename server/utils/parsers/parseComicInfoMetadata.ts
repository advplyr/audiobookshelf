
/**
 * TODO: Add more fields
 * @see https://anansi-project.github.io/docs/comicinfo/intro
 * 
 * @param {Object} comicInfoJson 
 * @returns {import('../../scanner/BookScanner').BookMetadataObject}
 */
module.exports.parse = (comicInfoJson) => {
  if (!comicInfoJson?.ComicInfo) return null

  const ComicSeries = comicInfoJson.ComicInfo.Series?.[0]?.trim() || null
  const ComicNumber = comicInfoJson.ComicInfo.Number?.[0]?.trim() || null
  const ComicSummary = comicInfoJson.ComicInfo.Summary?.[0]?.trim() || null

  let title = null
  const series = []
  if (ComicSeries) {
    series.push({
      name: ComicSeries,
      sequence: ComicNumber
    })

    title = ComicSeries
    if (ComicNumber) {
      title += ` ${ComicNumber}`
    }
  }

  return {
    title,
    series,
    description: ComicSummary
  }
}