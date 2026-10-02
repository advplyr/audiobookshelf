/** Audio tag field on AudioMetaTags -> key name of that tag in the data parsed by prober.js */
const PROBE_KEY_BY_TAG = {
  tagAlbum: 'file_tag_album',
  tagAlbumSort: 'file_tag_albumsort',
  tagArtist: 'file_tag_artist',
  tagArtistSort: 'file_tag_artistsort',
  tagGenre: 'file_tag_genre',
  tagTitle: 'file_tag_title',
  tagTitleSort: 'file_tag_titlesort',
  tagSeries: 'file_tag_series',
  tagSeriesPart: 'file_tag_seriespart',
  tagGrouping: 'file_tag_grouping',
  tagTrack: 'file_tag_track',
  tagDisc: 'file_tag_disc',
  tagSubtitle: 'file_tag_subtitle',
  tagAlbumArtist: 'file_tag_albumartist',
  tagDate: 'file_tag_date',
  tagComposer: 'file_tag_composer',
  tagPublisher: 'file_tag_publisher',
  tagComment: 'file_tag_comment',
  tagDescription: 'file_tag_description',
  tagEncoder: 'file_tag_encoder',
  tagEncodedBy: 'file_tag_encodedby',
  tagIsbn: 'file_tag_isbn',
  tagLanguage: 'file_tag_language',
  tagASIN: 'file_tag_asin',
  tagItunesId: 'file_tag_itunesid',
  tagPodcastType: 'file_tag_podcasttype',
  tagEpisodeType: 'file_tag_episodetype',
  tagOverdriveMediaMarker: 'file_tag_overdrive_media_marker',
  tagOriginalYear: 'file_tag_originalyear',
  tagReleaseCountry: 'file_tag_releasecountry',
  tagReleaseType: 'file_tag_releasetype',
  tagReleaseStatus: 'file_tag_releasestatus',
  tagISRC: 'file_tag_isrc',
  tagMusicBrainzTrackId: 'file_tag_musicbrainz_trackid',
  tagMusicBrainzAlbumId: 'file_tag_musicbrainz_albumid',
  tagMusicBrainzAlbumArtistId: 'file_tag_musicbrainz_albumartistid',
  tagMusicBrainzArtistId: 'file_tag_musicbrainz_artistid'
} as const

type TagKey = keyof typeof PROBE_KEY_BY_TAG
type ProbeKey = (typeof PROBE_KEY_BY_TAG)[TagKey]

const TAG_KEYS = Object.keys(PROBE_KEY_BY_TAG) as TagKey[]

type AudioMetaTagsData = { [K in TagKey]: string | null }

/** Tags as parsed by prober.js */
type ProbeTagPayload = { [K in ProbeKey]?: string | null }

interface NumberAndTotal {
  number: number | null
  total: number | null
}

/**
 * Parse a tag like "3/10" or "3" into number and total
 * Fractional numbers are not supported
 */
function parseNumberAndTotal(tag: string | null): NumberAndTotal {
  const data: NumberAndTotal = {
    number: null,
    total: null
  }

  if (tag) {
    const parts = tag.split('/').map((part) => Number(part))
    if (parts.length > 0) {
      data.number = !isNaN(parts[0]) ? Math.trunc(parts[0]) : null
    }
    if (parts.length > 1) {
      data.total = !isNaN(parts[1]) ? parts[1] : null
    }
  }

  return data
}

class AudioMetaTags implements AudioMetaTagsData {
  tagAlbum: string | null = null
  tagAlbumSort: string | null = null
  tagArtist: string | null = null
  tagArtistSort: string | null = null
  tagGenre: string | null = null
  tagTitle: string | null = null
  tagTitleSort: string | null = null
  tagSeries: string | null = null
  tagSeriesPart: string | null = null
  tagGrouping: string | null = null
  tagTrack: string | null = null
  tagDisc: string | null = null
  tagSubtitle: string | null = null
  tagAlbumArtist: string | null = null
  tagDate: string | null = null
  tagComposer: string | null = null
  tagPublisher: string | null = null
  tagComment: string | null = null
  tagDescription: string | null = null
  tagEncoder: string | null = null
  tagEncodedBy: string | null = null
  tagIsbn: string | null = null
  tagLanguage: string | null = null
  tagASIN: string | null = null
  tagItunesId: string | null = null
  tagPodcastType: string | null = null
  tagEpisodeType: string | null = null
  tagOverdriveMediaMarker: string | null = null
  tagOriginalYear: string | null = null
  tagReleaseCountry: string | null = null
  tagReleaseType: string | null = null
  tagReleaseStatus: string | null = null
  tagISRC: string | null = null
  tagMusicBrainzTrackId: string | null = null
  tagMusicBrainzAlbumId: string | null = null
  tagMusicBrainzAlbumArtistId: string | null = null
  tagMusicBrainzArtistId: string | null = null

  constructor(metadata?: Partial<AudioMetaTagsData> | null) {
    if (metadata) {
      this.construct(metadata)
    }
  }

  /** Only returns the tags that are actually set */
  toJSON(): Partial<AudioMetaTagsData> {
    const json: Partial<AudioMetaTagsData> = {}
    for (const key of TAG_KEYS) {
      if (this[key]) {
        json[key] = this[key]
      }
    }
    return json
  }

  get trackNumAndTotal(): NumberAndTotal {
    // Track ID3 tag might be "3/10" or just "3"
    return parseNumberAndTotal(this.tagTrack)
  }

  get discNumAndTotal(): NumberAndTotal {
    return parseNumberAndTotal(this.tagDisc)
  }

  get discNumber() {
    return this.discNumAndTotal.number
  }
  get discTotal() {
    return this.discNumAndTotal.total
  }
  get trackNumber() {
    return this.trackNumAndTotal.number
  }
  get trackTotal() {
    return this.trackNumAndTotal.total
  }

  construct(metadata: Partial<AudioMetaTagsData>) {
    for (const key of TAG_KEYS) {
      this[key] = metadata[key] || null
    }
  }

  /** Data parsed in prober.js */
  setData(payload: ProbeTagPayload) {
    for (const key of TAG_KEYS) {
      this[key] = payload[PROBE_KEY_BY_TAG[key]] || null
    }
  }

  /** @returns true if any tag changed */
  updateData(payload: ProbeTagPayload): boolean {
    let hasUpdates = false
    for (const key of TAG_KEYS) {
      const value = payload[PROBE_KEY_BY_TAG[key]] || null
      if (value !== this[key]) {
        this[key] = value
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  clone(): AudioMetaTags {
    return new AudioMetaTags(this.toJSON())
  }

  isEqual(audioFileMetadata: AudioMetaTags | null | undefined): boolean {
    if (!audioFileMetadata || !audioFileMetadata.toJSON) return false
    for (const key of Object.keys(audioFileMetadata.toJSON()) as TagKey[]) {
      if (audioFileMetadata[key] !== this[key]) return false
    }
    return true
  }
}

export = AudioMetaTags
