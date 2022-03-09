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
    }
  }
}
module.exports = PodcastMetadata