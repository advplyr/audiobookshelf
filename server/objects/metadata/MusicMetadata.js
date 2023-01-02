const Logger = require('../../Logger')
const { areEquivalent, copyValue, cleanStringForSearch, getTitleIgnorePrefix, getTitlePrefixAtEnd } = require('../../utils/index')

class MusicMetadata {
  constructor(metadata) {
    this.title = null
    this.artists = [] // Array of strings
    this.album = null
    this.albumArtist = null
    this.genres = [] // Array of strings
    this.composer = null
    this.originalYear = null
    this.releaseDate = null
    this.releaseCountry = null
    this.releaseType = null
    this.releaseStatus = null
    this.recordLabel = null
    this.language = null
    this.explicit = false

    this.discNumber = null
    this.discTotal = null
    this.trackNumber = null
    this.trackTotal = null

    this.isrc = null
    this.musicBrainzTrackId = null
    this.musicBrainzAlbumId = null
    this.musicBrainzAlbumArtistId = null
    this.musicBrainzArtistId = null

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.artists = metadata.artists ? [...metadata.artists] : []
    this.album = metadata.album
    this.albumArtist = metadata.albumArtist
    this.genres = metadata.genres ? [...metadata.genres] : []
    this.composer = metadata.composer || null
    this.originalYear = metadata.originalYear || null
    this.releaseDate = metadata.releaseDate || null
    this.releaseCountry = metadata.releaseCountry || null
    this.releaseType = metadata.releaseType || null
    this.releaseStatus = metadata.releaseStatus || null
    this.recordLabel = metadata.recordLabel || null
    this.language = metadata.language || null
    this.explicit = !!metadata.explicit
    this.discNumber = metadata.discNumber || null
    this.discTotal = metadata.discTotal || null
    this.trackNumber = metadata.trackNumber || null
    this.trackTotal = metadata.trackTotal || null
    this.isrc = metadata.isrc || null
    this.musicBrainzTrackId = metadata.musicBrainzTrackId || null
    this.musicBrainzAlbumId = metadata.musicBrainzAlbumId || null
    this.musicBrainzAlbumArtistId = metadata.musicBrainzAlbumArtistId || null
    this.musicBrainzArtistId = metadata.musicBrainzArtistId || null
  }

  toJSON() {
    return {
      title: this.title,
      artists: [...this.artists],
      album: this.album,
      albumArtist: this.albumArtist,
      genres: [...this.genres],
      composer: this.composer,
      originalYear: this.originalYear,
      releaseDate: this.releaseDate,
      releaseCountry: this.releaseCountry,
      releaseType: this.releaseType,
      releaseStatus: this.releaseStatus,
      recordLabel: this.recordLabel,
      language: this.language,
      explicit: this.explicit,
      discNumber: this.discNumber,
      discTotal: this.discTotal,
      trackNumber: this.trackNumber,
      trackTotal: this.trackTotal,
      isrc: this.isrc,
      musicBrainzTrackId: this.musicBrainzTrackId,
      musicBrainzAlbumId: this.musicBrainzAlbumId,
      musicBrainzAlbumArtistId: this.musicBrainzAlbumArtistId,
      musicBrainzArtistId: this.musicBrainzArtistId
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titlePrefixAtEnd,
      artists: [...this.artists],
      album: this.album,
      albumArtist: this.albumArtist,
      genres: [...this.genres],
      composer: this.composer,
      originalYear: this.originalYear,
      releaseDate: this.releaseDate,
      releaseCountry: this.releaseCountry,
      releaseType: this.releaseType,
      releaseStatus: this.releaseStatus,
      recordLabel: this.recordLabel,
      language: this.language,
      explicit: this.explicit,
      discNumber: this.discNumber,
      discTotal: this.discTotal,
      trackNumber: this.trackNumber,
      trackTotal: this.trackTotal,
      isrc: this.isrc,
      musicBrainzTrackId: this.musicBrainzTrackId,
      musicBrainzAlbumId: this.musicBrainzAlbumId,
      musicBrainzAlbumArtistId: this.musicBrainzAlbumArtistId,
      musicBrainzArtistId: this.musicBrainzArtistId
    }
  }

  toJSONExpanded() {
    return this.toJSONMinified()
  }

  clone() {
    return new MusicMetadata(this.toJSON())
  }

  get titleIgnorePrefix() {
    return getTitleIgnorePrefix(this.title)
  }

  get titlePrefixAtEnd() {
    return getTitlePrefixAtEnd(this.title)
  }

  searchQuery(query) { // Returns key if match is found
    const keysToCheck = ['title', 'album']
    for (const key of keysToCheck) {
      if (this[key] && cleanStringForSearch(String(this[key])).includes(query)) {
        return {
          matchKey: key,
          matchText: this[key]
        }
      }
    }
    return null
  }

  setData(mediaMetadata = {}) {
    this.title = mediaMetadata.title || null
    this.artist = mediaMetadata.artist || null
    this.album = mediaMetadata.album || null
  }

  update(payload) {
    const json = this.toJSON()
    let hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[MusicMetadata] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  parseArtistsTag(artistsTag) {
    if (!artistsTag || !artistsTag.length) return []
    const separators = ['/', '//', ';']
    for (let i = 0; i < separators.length; i++) {
      if (artistsTag.includes(separators[i])) {
        return artistsTag.split(separators[i]).map(artist => artist.trim()).filter(a => !!a)
      }
    }
    return [artistsTag]
  }

  parseGenresTag(genreTag) {
    if (!genreTag || !genreTag.length) return []
    const separators = ['/', '//', ';']
    for (let i = 0; i < separators.length; i++) {
      if (genreTag.includes(separators[i])) {
        return genreTag.split(separators[i]).map(genre => genre.trim()).filter(g => !!g)
      }
    }
    return [genreTag]
  }

  setDataFromAudioMetaTags(audioFileMetaTags, overrideExistingDetails = false) {
    const MetadataMapArray = [
      {
        tag: 'tagTitle',
        key: 'title',
      },
      {
        tag: 'tagArtist',
        key: 'artists'
      },
      {
        tag: 'tagAlbumArtist',
        key: 'albumArtist'
      },
      {
        tag: 'tagAlbum',
        key: 'album',
      },
      {
        tag: 'tagPublisher',
        key: 'recordLabel'
      },
      {
        tag: 'tagComposer',
        key: 'composer'
      },
      {
        tag: 'tagDate',
        key: 'releaseDate'
      },
      {
        tag: 'tagReleaseCountry',
        key: 'releaseCountry'
      },
      {
        tag: 'tagReleaseType',
        key: 'releaseType'
      },
      {
        tag: 'tagReleaseStatus',
        key: 'releaseStatus'
      },
      {
        tag: 'tagOriginalYear',
        key: 'originalYear'
      },
      {
        tag: 'tagGenre',
        key: 'genres'
      },
      {
        tag: 'tagLanguage',
        key: 'language'
      },
      {
        tag: 'tagLanguage',
        key: 'language'
      },
      {
        tag: 'tagISRC',
        key: 'isrc'
      },
      {
        tag: 'tagMusicBrainzTrackId',
        key: 'musicBrainzTrackId'
      },
      {
        tag: 'tagMusicBrainzAlbumId',
        key: 'musicBrainzAlbumId'
      },
      {
        tag: 'tagMusicBrainzAlbumArtistId',
        key: 'musicBrainzAlbumArtistId'
      },
      {
        tag: 'tagMusicBrainzArtistId',
        key: 'musicBrainzArtistId'
      },
      {
        tag: 'trackNumber',
        key: 'trackNumber'
      },
      {
        tag: 'trackTotal',
        key: 'trackTotal'
      },
      {
        tag: 'discNumber',
        key: 'discNumber'
      },
      {
        tag: 'discTotal',
        key: 'discTotal'
      }
    ]

    const updatePayload = {}

    // Metadata is only mapped to the music track if it is empty
    MetadataMapArray.forEach((mapping) => {
      let value = audioFileMetaTags[mapping.tag]
      // let tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        value = audioFileMetaTags[mapping.altTag]
        // tagToUse = mapping.altTag
      }

      if (value && typeof value === 'string') {
        value = value.trim() // Trim whitespace

        if (mapping.key === 'artists' && (!this.artists.length || overrideExistingDetails)) {
          updatePayload.artists = this.parseArtistsTag(value)
        } else if (mapping.key === 'genres' && (!this.genres.length || overrideExistingDetails)) {
          updatePayload.genres = this.parseGenresTag(value)
        } else if (!this[mapping.key] || overrideExistingDetails) {
          updatePayload[mapping.key] = value
          // Logger.debug(`[Book] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${updatePayload[mapping.key]}`)
        }
      }
    })

    if (Object.keys(updatePayload).length) {
      return this.update(updatePayload)
    }
    return false
  }
}
module.exports = MusicMetadata