const Path = require('path')
const date = require('../libs/dateAndTime')
const { secondsToTimestamp } = require('../utils/index')

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

  setFromPodcastEpisode(libraryItem, serverAddress, slug, episode, meta) {
    const contentUrl = `/feed/${slug}/item/${episode.id}/${episode.audioFile.metadata.filename}`
    const media = libraryItem.media
    const mediaMetadata = media.metadata

    this.id = episode.id
    this.title = episode.title
    this.description = episode.description || ''
    this.enclosure = {
      url: `${serverAddress}${contentUrl}`,
      type: episode.audioTrack.mimeType,
      size: episode.size
    }
    this.pubDate = episode.pubDate
    this.link = meta.link
    this.author = meta.author
    this.explicit = mediaMetadata.explicit
    this.duration = episode.duration
    this.season = episode.season
    this.episode = episode.episode
    this.episodeType = episode.episodeType
    this.libraryItemId = libraryItem.id
    this.episodeId = episode.id
    this.trackIndex = 0
    this.fullPath = episode.audioFile.metadata.path
  }

  setFromAudiobookTrack(libraryItem, serverAddress, slug, audioTrack, meta, additionalOffset = null) {
    // Example: <pubDate>Fri, 04 Feb 2015 00:00:00 GMT</pubDate>
    let timeOffset = isNaN(audioTrack.index) ? 0 : (Number(audioTrack.index) * 1000) // Offset pubdate to ensure correct order
    let episodeId = String(audioTrack.index)

    // Additional offset can be used for collections/series
    if (additionalOffset !== null && !isNaN(additionalOffset)) {
      timeOffset += Number(additionalOffset) * 1000

      episodeId = String(additionalOffset) + '-' + episodeId
    }

    // e.g. Track 1 will have a pub date before Track 2
    const audiobookPubDate = date.format(new Date(libraryItem.addedAt + timeOffset), 'ddd, DD MMM YYYY HH:mm:ss [GMT]')

    const contentUrl = `/feed/${slug}/item/${episodeId}/${audioTrack.metadata.filename}`
    const media = libraryItem.media
    const mediaMetadata = media.metadata

    let title = audioTrack.title
    if (libraryItem.media.tracks.length == 1) { // If audiobook is a single file, use book title instead of chapter/file title
      title = libraryItem.media.metadata.title
    } else {
      if (libraryItem.media.chapters.length) {
        // If audio track start and chapter start are within 1 seconds of eachother then use the chapter title
        var matchingChapter = libraryItem.media.chapters.find(ch => Math.abs(ch.start - audioTrack.startOffset) < 1)
        if (matchingChapter && matchingChapter.title) title = matchingChapter.title
      }
    }

    this.id = episodeId
    this.title = title
    this.description = mediaMetadata.description || ''
    this.enclosure = {
      url: `${serverAddress}${contentUrl}`,
      type: audioTrack.mimeType,
      size: audioTrack.metadata.size
    }
    this.pubDate = audiobookPubDate
    this.link = meta.link
    this.author = meta.author
    this.explicit = mediaMetadata.explicit
    this.duration = audioTrack.duration
    this.libraryItemId = libraryItem.id
    this.episodeId = null
    this.trackIndex = audioTrack.index
    this.fullPath = audioTrack.metadata.path
  }

  getRSSData() {
    return {
      title: this.title,
      description: this.description || '',
      url: this.link,
      guid: this.enclosure.url,
      author: this.author,
      date: this.pubDate,
      enclosure: this.enclosure,
      custom_elements: [
        { 'itunes:author': this.author },
        { 'itunes:duration': secondsToTimestamp(this.duration) },
        { 'itunes:summary': this.description || '' },
        {
          "itunes:explicit": !!this.explicit
        },
        { "itunes:episodeType": this.episodeType },
        { "itunes:season": this.season },
        { "itunes:episode": this.episode }
      ]
    }
  }
}
module.exports = FeedEpisode
