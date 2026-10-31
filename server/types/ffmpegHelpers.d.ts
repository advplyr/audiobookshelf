// Structural boundaries for the media fields consumed by FFmpeg helpers.
export interface AudioTrack {
  index: number
  duration: number
  metadata: { path: string; ext: string }
}

export interface MetadataChapter {
  start: number
  end: number
  title?: string | null
}

export interface MetadataLibraryItem {
  media: {
    title?: string | null
    subtitle?: string | null
    authorName?: string | null
    genres?: string[] | null
    publishedYear?: string | null
    description?: string | null
    narrators?: string[] | null
    publisher?: string | null
    series?: { name: string; bookSeries: { sequence?: string | null } }[] | null
  }
}

export interface PodcastDownload {
  url: string
  targetPath: string
  pubYear: number | null
  libraryItem: {
    media: {
      title: string | null
      author: string | null
      genres: string[]
      language: string | null
      itunesId: string | null
      podcastType: string | null
    }
  }
  rssPodcastEpisode: {
    enclosure?: { length?: string | number | null }
    description?: string | null
    subtitle?: string | null
    season?: string | null
    episode?: string | null
    title?: string | null
    pubDate?: string | null
    episodeType?: string | null
  }
}

export interface MergeEncodeOptions {
  bitrate?: string | null
  codec?: string | null
  channels?: string | number | null
}

export interface DownloadResult {
  success: boolean
  isRequestError?: boolean
}
