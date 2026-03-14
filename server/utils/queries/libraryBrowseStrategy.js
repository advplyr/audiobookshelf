function getTitleCursorKey() {
  return global.ServerSettings && global.ServerSettings.sortingIgnorePrefix ? 'titleIgnorePrefix' : 'title'
}

function getKeysetCursorKeys(sortBy) {
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

  if (sortBy === 'progress') {
    return ['mediaProgresses.updatedAt', 'id']
  }

  if (sortBy === 'progress.createdAt') {
    return ['mediaProgresses.createdAt', 'id']
  }

  if (sortBy === 'progress.finishedAt') {
    return ['mediaProgresses.finishedAt', 'id']
  }

  return []
}

function getPaginationMode(pageMode, sortBy) {
  if (pageMode !== 'endless') {
    return 'offset'
  }

  return getKeysetCursorKeys(sortBy).length ? 'keyset' : 'offset'
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
    paginationMode: getPaginationMode(pageMode, normalizedSort),
    countMode: 'deferred-exact',
    deepScrollAllowed: true,
    tieBreaker: 'id',
    cursorKeys: getKeysetCursorKeys(normalizedSort)
  }
}

module.exports = {
  getLibraryBrowseStrategy
}
