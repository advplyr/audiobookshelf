const Path = require('path')
const uuidv4 = require("uuid").v4
const date = require('../libs/dateAndTime')
const { secondsToTimestamp } = require('../utils/index')

/**
 * @openapi
 * components:
 *   schemas:
 *     rssFeedEpisode:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the RSS feed episode.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         title:
 *           description: The title of the RSS feed episode.
 *           type: string
 *           example: Pilot
 *         description:
 *           description: An HTML encoded description of the RSS feed episode.
 *           type: string
 *           example: >-
 *               <div><br>Pilot Episode. A new dog park opens in Night Vale. Carlos, a
 *               scientist, visits and discovers some interesting things. Seismic things.
 *               Plus, a helpful guide to surveillance
 *               helicopter-spotting.<br><br></div><div><br>Weather: "These and More Than
 *               These" by Joseph Fink<br><br></div><div><br>Music: Disparition,
 *               disparition.info<br><br></div><div><br>Logo: Rob Wilson,
 *               silastom.com<br><br></div><div><br>Produced by Night Vale Presents.
 *               Written by Joseph Fink and Jeffrey Cranor. Narrated by Cecil Baldwin.
 *               More Info: welcometonightvale.com, and follow @NightValeRadio on Twitter
 *               or Facebook.<br><br></div>
 *         enclosure:
 *           description: Download information for the RSS feed episode. (Similar to Podcast Episode Enclosure)
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *               example: >-
 *                   https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm/item/ep_lh6ko39pumnrma3dhv/1
 *                   - Pilot.mp3
 *             type:
 *               type: string
 *               example: audio/mpeg
 *             size:
 *               type: integer
 *               example: 23653735
 *         pubDate:
 *           description: The RSS feed episode's publication date.
 *           type: string
 *           example: Fri, 15 Jun 2012 12:00:00 -0000
 *         link:
 *           description: A URL to display to the RSS feed user.
 *           type: string
 *           example: https://abs.example.com/item/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         author:
 *           description: The author of the RSS feed episode.
 *           type: string
 *           example: Night Vale Presents
 *         explicit:
 *           description: Whether the RSS feed episode is explicit.
 *           type: boolean
 *           example: false
 *         duration:
 *           description: The duration (in seconds) of the RSS feed episode.
 *           type: number
 *           example: 1454.18449
 *         season:
 *           description: The season of the RSS feed episode.
 *           type: [string, 'null']
 *         episode:
 *           description: The episode number of the RSS feed episode.
 *           type: [string, 'null']
 *         episodeType:
 *           description: The type of the RSS feed episode.
 *           type: [string, 'null']
 *         libraryItemId:
 *           description: The ID of the library item the RSS feed is for.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode the RSS feed episode is for. Will be null if the RSS feed is for a book.
 *           type: [string, 'null']
 *           example: ep_lh6ko39pumnrma3dhv
 *         trackIndex:
 *           description: The RSS feed episode's track index.
 *           type: integer
 *           example: 0
 *         fullPath:
 *           description: The path on the server of the audio file the RSS feed episode is for.
 *           type: string
 *           example: /podcasts/Welcome to Night Vale/1 - Pilot.mp3
 */
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
    const contentFileExtension = Path.extname(episode.audioFile.metadata.filename)
    const contentUrl = `/feed/${slug}/item/${episode.id}/media${contentFileExtension}`
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

  /**
   * 
   * @param {import('../objects/LibraryItem')} libraryItem 
   * @param {string} serverAddress 
   * @param {string} slug 
   * @param {import('../objects/files/AudioTrack')} audioTrack 
   * @param {Object} meta 
   * @param {boolean} useChapterTitles 
   * @param {number} [additionalOffset] 
   */
  setFromAudiobookTrack(libraryItem, serverAddress, slug, audioTrack, meta, useChapterTitles, additionalOffset = null) {
    // Example: <pubDate>Fri, 04 Feb 2015 00:00:00 GMT</pubDate>
    let timeOffset = isNaN(audioTrack.index) ? 0 : (Number(audioTrack.index) * 1000) // Offset pubdate to ensure correct order
    let episodeId = uuidv4()

    // Additional offset can be used for collections/series
    if (additionalOffset !== null && !isNaN(additionalOffset)) {
      timeOffset += Number(additionalOffset) * 1000
    }

    // e.g. Track 1 will have a pub date before Track 2
    const audiobookPubDate = date.format(new Date(libraryItem.addedAt + timeOffset), 'ddd, DD MMM YYYY HH:mm:ss [GMT]')

    const contentFileExtension = Path.extname(audioTrack.metadata.filename)
    const contentUrl = `/feed/${slug}/item/${episodeId}/media${contentFileExtension}`
    const media = libraryItem.media
    const mediaMetadata = media.metadata

    let title = audioTrack.title
    if (libraryItem.media.tracks.length == 1) { // If audiobook is a single file, use book title instead of chapter/file title
      title = libraryItem.media.metadata.title
    } else {
      if (useChapterTitles) {
        // If audio track start and chapter start are within 1 seconds of eachother then use the chapter title
        const matchingChapter = libraryItem.media.chapters.find(ch => Math.abs(ch.start - audioTrack.startOffset) < 1)
        if (matchingChapter?.title) title = matchingChapter.title
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
