const Logger = require('../../Logger')
const { areEquivalent, copyValue, cleanStringForSearch, getTitleIgnorePrefix, getTitlePrefixAtEnd } = require('../../utils/index')

class PodcastMetadata {
  constructor(metadata) {
    this.title = null
    this.author = null
    this.description = null
    this.releaseDate = null
    this.genres = []
    this.feedUrl = null
    this.imageUrl = null
    this.itunesPageUrl = null
    this.itunesId = null
    this.itunesArtistId = null
    this.explicit = false
    this.language = null
    this.type = null

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.author = metadata.author
    this.description = metadata.description
    this.releaseDate = metadata.releaseDate
    this.genres = [...metadata.genres]
    this.feedUrl = metadata.feedUrl
    this.imageUrl = metadata.imageUrl
    this.itunesPageUrl = metadata.itunesPageUrl
    this.itunesId = metadata.itunesId
    this.itunesArtistId = metadata.itunesArtistId
    this.explicit = metadata.explicit
    this.language = metadata.language || null
    this.type = metadata.type || 'episodic'
  }

  toJSON() {
    return {
      title: this.title,
      author: this.author,
      description: this.description,
      releaseDate: this.releaseDate,
      genres: [...this.genres],
      feedUrl: this.feedUrl,
      imageUrl: this.imageUrl,
      itunesPageUrl: this.itunesPageUrl,
      itunesId: this.itunesId,
      itunesArtistId: this.itunesArtistId,
      explicit: this.explicit,
      language: this.language,
      type: this.type
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titlePrefixAtEnd,
      author: this.author,
      description: this.description,
      releaseDate: this.releaseDate,
      genres: [...this.genres],
      feedUrl: this.feedUrl,
      imageUrl: this.imageUrl,
      itunesPageUrl: this.itunesPageUrl,
      itunesId: this.itunesId,
      itunesArtistId: this.itunesArtistId,
      explicit: this.explicit,
      language: this.language,
      type: this.type
    }
  }

  toJSONExpanded() {
    return this.toJSONMinified()
  }

  clone() {
    return new PodcastMetadata(this.toJSON())
  }

  get titleIgnorePrefix() {
    return getTitleIgnorePrefix(this.title)
  }

  get titlePrefixAtEnd() {
    return getTitlePrefixAtEnd(this.title)
  }

  searchQuery(query) { // Returns key if match is found
    const keysToCheck = ['title', 'author', 'itunesId', 'itunesArtistId']
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
    this.author = mediaMetadata.author || null
    this.description = mediaMetadata.description || null
    this.releaseDate = mediaMetadata.releaseDate || null
    this.feedUrl = mediaMetadata.feedUrl || null
    this.imageUrl = mediaMetadata.imageUrl || null
    this.itunesPageUrl = mediaMetadata.itunesPageUrl || null
    this.itunesId = mediaMetadata.itunesId || null
    this.itunesArtistId = mediaMetadata.itunesArtistId || null
    this.explicit = !!mediaMetadata.explicit
    this.language = mediaMetadata.language || null
    this.type = mediaMetadata.type || null
    if (mediaMetadata.genres && mediaMetadata.genres.length) {
      this.genres = [...mediaMetadata.genres]
    }
  }

  update(payload) {
    const json = this.toJSON()
    let hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[PodcastMetadata] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  setDataFromAudioMetaTags(audioFileMetaTags, overrideExistingDetails = false) {
    const MetadataMapArray = [
      {
        tag: 'tagAlbum',
        altTag: 'tagSeries',
        key: 'title'
      },
      {
        tag: 'tagArtist',
        key: 'author'
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
        tag: 'tagItunesId',
        key: 'itunesId'
      },
      {
        tag: 'tagPodcastType',
        key: 'type',
      }
    ]

    const updatePayload = {}

    MetadataMapArray.forEach((mapping) => {
      let value = audioFileMetaTags[mapping.tag]
      let tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        value = audioFileMetaTags[mapping.altTag]
        tagToUse = mapping.altTag
      }

      if (value && typeof value === 'string') {
        value = value.trim() // Trim whitespace

        if (mapping.key === 'genres' && (!this.genres.length || overrideExistingDetails)) {
          updatePayload.genres = this.parseGenresTag(value)
          Logger.debug(`[Podcast] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${updatePayload.genres.join(', ')}`)
        } else if (!this[mapping.key] || overrideExistingDetails) {
          updatePayload[mapping.key] = value
          Logger.debug(`[Podcast] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${updatePayload[mapping.key]}`)
        }
      }
    })

    if (Object.keys(updatePayload).length) {
      return this.update(updatePayload)
    }
    return false
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
}
module.exports = PodcastMetadata
