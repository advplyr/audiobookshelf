export interface RssXmlNode {
  [key: string]: unknown
  _?: string
  $?: Record<string, string>
}

export type RssMetadataValue = string | RssXmlNode | null | undefined

export interface RssPodcastChapter {
  id: number
  title: string
  start: number
  end: number
}

export interface RssEnclosure {
  [key: string]: string | undefined
  url: string
  type?: string
  length?: string
}

export interface RssPodcastEpisode {
  title: string
  subtitle: string
  description: string
  descriptionPlain: string
  pubDate: string
  episodeType: string
  season: string
  episode: string
  author: string
  duration: string
  durationSeconds: number | null
  explicit: string
  publishedAt: number | null
  enclosure: RssEnclosure
  guid: string | null
  chaptersUrl: string | null
  chaptersType: string | null
  chapters: RssPodcastChapter[]
}

// Channel text can retain nested XML nodes; migration does not add validation/coercion.
export interface RssPodcastMetadata {
  [key: string]: RssMetadataValue | string[]
  title?: RssMetadataValue
  language?: RssMetadataValue
  explicit?: RssMetadataValue
  author?: RssMetadataValue
  pubDate?: RssMetadataValue
  link?: RssMetadataValue
  image: string | null
  categories: string[]
  feedUrl: RssMetadataValue
  description: string | null
  descriptionPlain: string | null
  type: RssMetadataValue
}

export type RssPodcast = {
  metadata: RssPodcastMetadata
} & ({ episodes: RssPodcastEpisode[]; numEpisodes?: never } | { episodes?: never; numEpisodes: number })

export interface RssItem extends RssXmlNode {
  enclosure?: Array<{ $?: Partial<RssEnclosure> }>
  'media:content'?: Array<{ $?: Partial<RssEnclosure> }>
  'podcast:chapters'?: Array<{ $?: { url?: string; type?: string } }>
  'psc:chapters'?: Array<{ 'psc:chapter'?: Array<{ $?: { title?: string; start?: string } }> }>
}

export interface RssCategory extends RssXmlNode {
  'itunes:category'?: RssCategory[]
}

export interface RssChannel extends RssCategory {
  image?: { url?: string[] }
  'itunes:image'?: RssXmlNode[]
  'atom:link'?: RssXmlNode[]
  item?: RssItem[]
}

export interface RssXmlDocument {
  rss?: { channel?: RssChannel[] }
}

export interface ParsedPodcastFeed {
  podcast: RssPodcast
  rawJson?: RssXmlDocument
}

export type EpisodeMatch = { episode: RssPodcastEpisode }

export interface RedirectRequestError {
  code?: string
  cause: { code?: string }
  request: { _options: { protocol?: string; href?: string } }
}
