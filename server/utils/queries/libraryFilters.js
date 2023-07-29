const libraryItemsBookFilters = require('./libraryItemsBookFilters')

module.exports = {
  decode(text) {
    return Buffer.from(decodeURIComponent(text), 'base64').toString()
  },

  async getFilteredLibraryItems(libraryId, filterBy, sortBy, sortDesc, limit, offset, userId) {
    let filterValue = null
    let filterGroup = null
    if (filterBy) {
      const searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators', 'publishers', 'missing', 'languages', 'tracks', 'ebooks']
      const group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
      filterGroup = group || filterBy
      filterValue = group ? this.decode(filterBy.replace(`${group}.`, '')) : null
    }

    // TODO: Handle podcast filters
    return libraryItemsBookFilters.getFilteredLibraryItems(libraryId, userId, filterGroup, filterValue, sortBy, sortDesc, limit, offset)
  }
}