function getCursorKeys(sortBy) {
  if (sortBy === 'media.metadata.authorName') {
    return ['authorNamesFirstLast', 'titleIgnorePrefix', 'id']
  }

  if (sortBy === 'media.metadata.authorNameLF') {
    return ['authorNamesLastFirst', 'titleIgnorePrefix', 'id']
  }

  if (sortBy === 'progress') {
    return ['mediaProgress.updatedAt', 'id']
  }

  if (sortBy === 'updatedAt') {
    return ['updatedAt', 'id']
  }

  if (sortBy === 'addedAt') {
    return ['createdAt', 'id']
  }

  return ['titleIgnorePrefix', 'id']
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
    paginationMode: pageMode === 'endless' ? 'keyset' : 'offset',
    countMode: 'deferred-exact',
    deepScrollAllowed: true,
    tieBreaker: 'id',
    cursorKeys: getCursorKeys(normalizedSort)
  }
}

module.exports = {
  getLibraryBrowseStrategy
}
