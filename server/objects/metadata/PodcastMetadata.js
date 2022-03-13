class PodcastMetadata {
  constructor(metadata) {
    this.title = null
    this.artist = null
    this.description = null
    this.releaseDate = null
    this.genres = []
    this.feedUrl = null
    this.itunesPageUrl = null
    this.itunesId = null
    this.itunesArtistId = null
    this.explicit = false

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.artist = metadata.artist
    this.description = metadata.description
    this.releaseDate = metadata.releaseDate
    this.genres = [...metadata.genres]
    this.feedUrl = metadata.feedUrl
    this.itunesPageUrl = metadata.itunesPageUrl
    this.itunesId = metadata.itunesId
    this.itunesArtistId = metadata.itunesArtistId
    this.explicit = metadata.explicit
  }

  toJSON() {
    return {
      title: this.title,
      artist: this.artist,
      description: this.description,
      releaseDate: this.releaseDate,
      genres: [...this.genres],
      feedUrl: this.feedUrl,
      itunesPageUrl: this.itunesPageUrl,
      itunesId: this.itunesId,
      itunesArtistId: this.itunesArtistId,
      explicit: this.explicit
    }
  }

  toJSONExpanded() {
    return this.toJSON()
  }

  searchQuery(query) { // Returns key if match is found
    var keysToCheck = ['title', 'artist', 'itunesId', 'itunesArtistId']
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
}
module.exports = PodcastMetadata