const Logger = require('../../Logger')
const { areEquivalent, copyValue, cleanStringForSearch, getTitleIgnorePrefix, getTitlePrefixAtEnd } = require('../../utils/index')

class MusicMetadata {
  constructor(metadata) {
    this.title = null
    this.artist = null
    this.album = null
    this.genres = [] // Array of strings
    this.releaseDate = null
    this.language = null
    this.explicit = false

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.artist = metadata.artist
    this.album = metadata.album
    this.genres = metadata.genres ? [...metadata.genres] : []
    this.releaseDate = metadata.releaseDate || null
    this.language = metadata.language
    this.explicit = !!metadata.explicit
  }

  toJSON() {
    return {
      title: this.title,
      artist: this.artist,
      album: this.album,
      genres: [...this.genres],
      releaseDate: this.releaseDate,
      language: this.language,
      explicit: this.explicit
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titlePrefixAtEnd,
      artist: this.artist,
      album: this.album,
      genres: [...this.genres],
      releaseDate: this.releaseDate,
      language: this.language,
      explicit: this.explicit
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
    const keysToCheck = ['title', 'artist', 'album']
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
}
module.exports = MusicMetadata