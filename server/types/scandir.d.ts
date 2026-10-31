export interface BookFilenameMetadata {
  title: string
  subtitle: string | null
  asin: string | null
  authors: string[]
  narrators: string[]
  seriesName: string | null
  seriesSequence: string | null
  publishedYear: string | null
}

export type LibraryItemFilenameMetadata = BookFilenameMetadata | { title: string }
