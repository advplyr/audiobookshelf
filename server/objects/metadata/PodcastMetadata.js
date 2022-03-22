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
      language: this.language
    }
  }

  toJSONExpanded() {
    return this.toJSON()
  }

  clone() {
    return new PodcastMetadata(this.toJSON())
  }

  searchQuery(query) { // Returns key if match is found
    var keysToCheck = ['title', 'author', 'itunesId', 'itunesArtistId']
    for (var key of keysToCheck) {
      if (this[key] && String(this[key]).toLowerCase().includes(query)) {
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
    if (mediaMetadata.genres && mediaMetadata.genres.length) {
      this.genres = [...mediaMetadata.genres]
    }
  }
}
module.exports = PodcastMetadata