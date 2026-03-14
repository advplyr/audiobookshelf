function getTitleCursorKey() {
  return global.ServerSettings && global.ServerSettings.sortingIgnorePrefix ? 'titleIgnorePrefix' : 'title'
}

function getKeysetCursorKeys(sortBy, collapseseries) {
  if (sortBy === 'media.metadata.title' && collapseseries) {
    return []
  }

  if (sortBy === 'media.metadata.title') {
    return [getTitleCursorKey(), 'id']
  }

  if (sortBy === 'media.metadata.authorName') {
    return ['authorNamesFirstLast', getTitleCursorKey(), 'id']
  }

  if (sortBy === 'media.metadata.authorNameLF') {
    return ['authorNamesLastFirst', getTitleCursorKey(), 'id']
  }

  if (sortBy === 'addedAt') {
    return ['createdAt', 'id']
  }

  if (sortBy === 'updatedAt') {
    return ['updatedAt', 'id']
  }

  return []
}

function getPaginationMode(pageMode, sortBy, collapseseries) {
  if (pageMode !== 'endless') {
    return 'offset'
  }

  return getKeysetCursorKeys(sortBy, collapseseries).length ? 'keyset' : 'offset'
}

function getFamily({ mediaType, sortBy, filterGroup, collapseseries }) {
  if (sortBy === 'random') return 'random-browse'
  if (mediaType === 'podcast') return 'podcast-browse'
  if (collapseseries && filterGroup === 'series') return 'collapsed-series-browse'
  if (filterGroup === 'series') return 'series-browse'
  if (filterGroup === 'progress') return 'progress-browse'
  if (filterGroup === 'recent' || sortBy === 'addedAt') return 'recent-browse'
  if (sortBy === 'media.metadata.authorName' || sortBy === 'media.metadata.authorNameLF') return 'author-browse'
  if (filterGroup) return 'filtered-browse'
  return 'plain-browse'
}

function getLibraryBrowseStrategy({ mediaType, sortBy, filterGroup, pageMode, collapseseries } = {}) {
  const normalizedSort = sortBy || 'media.metadata.title'
  const paginationMode = getPaginationMode(pageMode, normalizedSort, collapseseries)

  if (normalizedSort === 'random') {
    return {
      family: 'random-browse',
      paginationMode: 'offset',
      countMode: 'exact-on-initial-page',
      deepScrollAllowed: false,
      tieBreaker: 'id',
      cursorKeys: []
    }
  }

  return {
    family: getFamily({ mediaType, sortBy: normalizedSort, filterGroup, collapseseries }),
    paginationMode,
    countMode: paginationMode === 'keyset' ? 'deferred-exact' : 'exact-on-initial-page',
    deepScrollAllowed: paginationMode === 'keyset',
    tieBreaker: 'id',
    cursorKeys: getKeysetCursorKeys(normalizedSort, collapseseries)
  }
}

module.exports = {
  getLibraryBrowseStrategy
}
