// Structural boundaries for expanded book models and legacy JSON consumed by series collapsing.
export interface BookSeries {
  id: string
  name: string
  bookSeries: { sequence: string | null }
}

export interface CollapsedSeriesJSON {
  id: string
  name: string
  nameIgnorePrefix: string
  libraryItemIds: string[]
  numBooks: number
  seriesSequenceList?: string
}

export interface LibraryItemJSON {
  [key: string]: unknown
  id: string
  sequence?: string | null
  filterSeriesSequence?: string | null
  media: {
    [key: string]: unknown
    duration?: unknown
    metadata: {
      [key: string]: unknown
      series?: { id: string; name: string; sequence: string | null } | Array<{ id: string; name: string; sequence: string | null }> | null
    }
  }
  collapsedSeries?: CollapsedSeriesJSON
}

export interface ExpandedBook {
  series: BookSeries[]
  title: string | null
  titleIgnorePrefix: string | null
  libraryItem?: ExpandedLibraryItem
}

export interface ExpandedLibraryItem {
  id: string
  mediaType: string
  media: ExpandedBook
  authorNamesFirstLast?: string | null
  authorNamesLastFirst?: string | null
  collapsedSeries?: SeriesGroup
  toOldJSONMinified(): LibraryItemJSON
}

export interface SeriesGroup {
  id: string
  name: string
  nameIgnorePrefix: string
  nameIgnorePrefixSort: string
  type: 'series'
  books: LibraryItemJSON[]
  totalDuration: number
}

export interface CollapsePayload {
  sortBy?: string
  sortDesc?: boolean
  total?: number
  limit: number | string
  page: number | string
}

export interface CollapseUser {
  checkCanAccessLibraryItem(item: ExpandedLibraryItem): boolean
}

export interface CollapseLibrary {
  settings: { hideSingleBookSeries: boolean }
}

export interface SeriesWithBooks {
  books: Array<ExpandedBook & { libraryItem?: ExpandedLibraryItem }>
}
