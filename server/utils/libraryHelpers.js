module.exports = {
  async toCollapsedSeriesPayload(libraryItems, seriesId) {
    return Promise.all(
      libraryItems.map(async (libraryItem) => {
        const filteredSeries = libraryItem.media.series.find((series) => series.id === seriesId)
        const json = libraryItem.toOldJSONMinified()

        if (filteredSeries) {
          json.media.metadata.series = {
            id: filteredSeries.id,
            name: filteredSeries.name,
            sequence: filteredSeries.bookSeries.sequence
          }
        }

        return json
      })
    )
  }
}
