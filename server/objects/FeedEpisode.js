class FeedEpisode {
  constructor(episode) {
    this.id = null

    this.title = null
    this.description = null
    this.enclosure = null
    this.pubDate = null
    this.link = null
    this.author = null
    this.explicit = null
    this.duration = null
    this.season = null
    this.episode = null
    this.episodeType = null

    this.libraryItemId = null
    this.episodeId = null
    this.trackIndex = null
    this.fullPath = null

    if (episode) {
      this.construct(episode)
    }
  }

  construct(episode) {
    this.id = episode.id
    this.title = episode.title
    this.description = episode.description
    this.enclosure = episode.enclosure ? { ...episode.enclosure } : null
    this.pubDate = episode.pubDate
    this.link = episode.link
    this.author = episode.author
    this.explicit = episode.explicit
    this.duration = episode.duration
    this.season = episode.season
    this.episode = episode.episode
    this.episodeType = episode.episodeType
    this.libraryItemId = episode.libraryItemId
    this.episodeId = episode.episodeId || null
    this.trackIndex = episode.trackIndex || 0
    this.fullPath = episode.fullPath
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      enclosure: this.enclosure ? { ...this.enclosure } : null,
      pubDate: this.pubDate,
      link: this.link,
      author: this.author,
      explicit: this.explicit,
      duration: this.duration,
      season: this.season,
      episode: this.episode,
      episodeType: this.episodeType,
      libraryItemId: this.libraryItemId,
      episodeId: this.episodeId,
      trackIndex: this.trackIndex,
      fullPath: this.fullPath
    }
  }
}
module.exports = FeedEpisode
