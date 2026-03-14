function getTitleCursorKey() {
  return global.ServerSettings && global.ServerSettings.sortingIgnorePrefix ? 'titleIgnorePrefix' : 'title'
}

function getProgressCursorKeys(sortBy, filterValue) {
  const supportedFilters = ['finished', 'in-progress', 'audio-in-progress', 'ebook-in-progress', 'ebook-finished']
  const supportedFinishedAtFilters = ['finished', 'ebook-finished']

  if (sortBy === 'progress' && supportedFilters.includes(filterValue)) {
    return ['mediaProgresses.updatedAt', 'id']
  }

  if (sortBy === 'progress.createdAt' && supportedFilters.includes(filterValue)) {
    return ['mediaProgresses.createdAt', 'id']
  }

  if (sortBy === 'progress.finishedAt' && supportedFinishedAtFilters.includes(filterValue)) {
    return ['mediaProgresses.finishedAt', 'id']
  }

  return []
}

function getKeysetCursorKeys({ mediaType, sortBy, filterGroup, filterValue, collapseseries }) {
  if (mediaType === 'podcast') {
    return []
  }

  if (sortBy === 'media.metadata.title' && collapseseries) {
    return []
  }

  if (filterGroup === 'progress') {
    return getProgressCursorKeys(sortBy, filterValue)
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

function getPaginationMode({ mediaType, pageMode, sortBy, filterGroup, filterValue, collapseseries }) {
  if (pageMode !== 'endless') {
    return 'offset'
  }

  return getKeysetCursorKeys({ mediaType, sortBy, filterGroup, filterValue, collapseseries }).length ? 'keyset' : 'offset'
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

function getLibraryBrowseStrategy({ mediaType, sortBy, filterGroup, filterValue, pageMode, collapseseries } = {}) {
  const normalizedSort = sortBy || 'media.metadata.title'
  const cursorKeys = getKeysetCursorKeys({ mediaType, sortBy: normalizedSort, filterGroup, filterValue, collapseseries })
  const paginationMode = getPaginationMode({ mediaType, pageMode, sortBy: normalizedSort, filterGroup, filterValue, collapseseries })

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
    cursorKeys
  }
}

module.exports = {
  getLibraryBrowseStrategy
}
