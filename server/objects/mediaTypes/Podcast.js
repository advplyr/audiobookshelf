const Logger = require('../../Logger')
const PodcastEpisode = require('../entities/PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')
const { areEquivalent, copyValue, cleanStringForSearch } = require('../../utils/index')
const abmetadataGenerator = require('../../utils/generators/abmetadataGenerator')
const { readTextFile, filePathToPOSIX } = require('../../utils/fileUtils')
const { createNewSortInstance } = require('../../libs/fastSort')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

class Podcast {
  constructor(podcast) {
    this.id = null
    this.libraryItemId = null
    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.episodes = []

    this.autoDownloadEpisodes = false
    this.autoDownloadSchedule = null
    this.lastEpisodeCheck = 0
    this.maxEpisodesToKeep = 0
    this.maxNewEpisodesToDownload = 3

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

    if (podcast) {
      this.construct(podcast)
    }
  }

  construct(podcast) {
    this.id = podcast.id
    this.libraryItemId = podcast.libraryItemId
    this.metadata = new PodcastMetadata(podcast.metadata)
    this.coverPath = podcast.coverPath
    this.tags = [...podcast.tags]
    this.episodes = podcast.episodes.map((e) => {
      var podcastEpisode = new PodcastEpisode(e)
      podcastEpisode.libraryItemId = this.libraryItemId
      return podcastEpisode
    })
    this.autoDownloadEpisodes = !!podcast.autoDownloadEpisodes
    this.autoDownloadSchedule = podcast.autoDownloadSchedule || '0 * * * *' // Added in 2.1.3 so default to hourly
    this.lastEpisodeCheck = podcast.lastEpisodeCheck || 0
    this.maxEpisodesToKeep = podcast.maxEpisodesToKeep || 0
    this.maxNewEpisodesToDownload = podcast.maxNewEpisodesToDownload || 3
  }

  toJSON() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      metadata: this.metadata.toJSONMinified(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      numEpisodes: this.episodes.length,
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSONExpanded()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }

  toJSONForMetadataFile() {
    return {
      tags: [...this.tags],
      metadata: this.metadata.toJSON()
    }
  }

  get size() {
    var total = 0
    this.episodes.forEach((ep) => total += ep.size)
    return total
  }
  get hasMediaEntities() {
    return !!this.episodes.length
  }
  get shouldSearchForCover() {
    return false
  }
  get hasEmbeddedCoverArt() {
    return this.episodes.some(ep => ep.audioFile.embeddedCoverArt)
  }
  get hasIssues() {
    return false
  }
  get duration() {
    let total = 0
    this.episodes.forEach((ep) => total += ep.duration)
    return total
  }
  get numTracks() {
    return this.episodes.length
  }
  get latestEpisodePublished() {
    var largestPublishedAt = 0
    this.episodes.forEach((ep) => {
      if (ep.publishedAt && ep.publishedAt > largestPublishedAt) {
        largestPublishedAt = ep.publishedAt
      }
    })
    return largestPublishedAt
  }
  get episodesWithPubDate() {
    return this.episodes.filter(ep => !!ep.publishedAt)
  }

  update(payload) {
    var json = this.toJSON()
    delete json.episodes // do not update media entities here
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (key === 'metadata') {
          if (this.metadata.update(payload.metadata)) {
            hasUpdates = true
          }
        } else if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[Podcast] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  updateEpisode(id, payload) {
    var episode = this.episodes.find(ep => ep.id == id)
    if (!episode) return false
    return episode.update(payload)
  }

  updateCover(coverPath) {
    coverPath = filePathToPOSIX(coverPath)
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  removeFileWithInode(inode) {
    const hasEpisode = this.episodes.some(ep => ep.audioFile.ino === inode)
    if (hasEpisode) {
      this.episodes = this.episodes.filter(ep => ep.audioFile.ino !== inode)
    }
    return hasEpisode
  }

  findFileWithInode(inode) {
    var episode = this.episodes.find(ep => ep.audioFile.ino === inode)
    if (episode) return episode.audioFile
    return null
  }

  findEpisodeWithInode(inode) {
    return this.episodes.find(ep => ep.audioFile.ino === inode)
  }

  setData(mediaData) {
    this.metadata = new PodcastMetadata()
    if (mediaData.metadata) {
      this.metadata.setData(mediaData.metadata)
    }

    this.coverPath = mediaData.coverPath || null
    this.autoDownloadEpisodes = !!mediaData.autoDownloadEpisodes
    this.autoDownloadSchedule = mediaData.autoDownloadSchedule || global.ServerSettings.podcastEpisodeSchedule
    this.lastEpisodeCheck = Date.now() // Makes sure new episodes are after this
  }

  async syncMetadataFiles(textMetadataFiles, opfMetadataOverrideDetails) {
    let metadataUpdatePayload = {}
    let tagsUpdated = false

    const metadataAbs = textMetadataFiles.find(lf => lf.metadata.filename === 'metadata.abs' || lf.metadata.filename === 'metadata.json')
    if (metadataAbs) {
      const isJSON = metadataAbs.metadata.filename === 'metadata.json'
      const metadataText = await readTextFile(metadataAbs.metadata.path)
      const abmetadataUpdates = abmetadataGenerator.parseAndCheckForUpdates(metadataText, this, 'podcast', isJSON)
      if (abmetadataUpdates && Object.keys(abmetadataUpdates).length) {
        Logger.debug(`[Podcast] "${this.metadata.title}" changes found in metadata.abs file`, abmetadataUpdates)

        if (abmetadataUpdates.tags) { // Set media tags if updated
          this.tags = abmetadataUpdates.tags
          tagsUpdated = true
        }
        if (abmetadataUpdates.metadata) {
          metadataUpdatePayload = {
            ...metadataUpdatePayload,
            ...abmetadataUpdates.metadata
          }
        }
      }
    }

    if (Object.keys(metadataUpdatePayload).length) {
      return this.metadata.update(metadataUpdatePayload) || tagsUpdated
    }
    return tagsUpdated
  }

  searchEpisodes(query) {
    return this.episodes.filter(ep => ep.searchQuery(query))
  }

  searchQuery(query) {
    const payload = {
      tags: this.tags.filter(t => cleanStringForSearch(t).includes(query)),
      matchKey: null,
      matchText: null
    }
    const metadataMatch = this.metadata.searchQuery(query)
    if (metadataMatch) {
      payload.matchKey = metadataMatch.matchKey
      payload.matchText = metadataMatch.matchText
    } else {
      const matchingEpisodes = this.searchEpisodes(query)
      if (matchingEpisodes.length) {
        payload.matchKey = 'episode'
        payload.matchText = matchingEpisodes[0].title
      }
    }

    return payload
  }

  checkHasEpisode(episodeId) {
    return this.episodes.some(ep => ep.id === episodeId)
  }
  checkHasEpisodeByFeedUrl(url) {
    return this.episodes.some(ep => ep.checkEqualsEnclosureUrl(url))
  }

  // Only checks container format
  checkCanDirectPlay(payload, episodeId) {
    var episode = this.episodes.find(ep => ep.id === episodeId)
    if (!episode) return false
    return episode.checkCanDirectPlay(payload)
  }

  getDirectPlayTracklist(episodeId) {
    var episode = this.episodes.find(ep => ep.id === episodeId)
    if (!episode) return false
    return episode.getDirectPlayTracklist()
  }

  addPodcastEpisode(podcastEpisode) {
    this.episodes.push(podcastEpisode)
    this.reorderEpisodes()
  }

  addNewEpisodeFromAudioFile(audioFile, index) {
    const pe = new PodcastEpisode()
    pe.libraryItemId = this.libraryItemId
    pe.podcastId = this.id
    audioFile.index = 1 // Only 1 audio file per episode
    pe.setDataFromAudioFile(audioFile, index)
    this.episodes.push(pe)
  }

  reorderEpisodes() {
    var hasUpdates = false

    this.episodes = naturalSort(this.episodes).desc((ep) => ep.publishedAt)
    for (let i = 0; i < this.episodes.length; i++) {
      if (this.episodes[i].index !== (i + 1)) {
        this.episodes[i].index = i + 1
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  removeEpisode(episodeId) {
    const episode = this.episodes.find(ep => ep.id === episodeId)
    if (episode) {
      this.episodes = this.episodes.filter(ep => ep.id !== episodeId)
    }
    return episode
  }

  getPlaybackTitle(episodeId) {
    var episode = this.episodes.find(ep => ep.id == episodeId)
    if (!episode) return this.metadata.title
    return episode.title
  }

  getPlaybackAuthor() {
    return this.metadata.author
  }

  getEpisodeDuration(episodeId) {
    var episode = this.episodes.find(ep => ep.id == episodeId)
    if (!episode) return 0
    return episode.duration
  }

  getEpisode(episodeId) {
    return this.episodes.find(ep => ep.id == episodeId)
  }

  // Audio file metadata tags map to podcast details
  setMetadataFromAudioFile(overrideExistingDetails = false) {
    if (!this.episodes.length) return false
    const audioFile = this.episodes[0].audioFile
    if (!audioFile?.metaTags) return false
    return this.metadata.setDataFromAudioMetaTags(audioFile.metaTags, overrideExistingDetails)
  }

  getChapters(episodeId) {
    return this.getEpisode(episodeId)?.chapters?.map(ch => ({ ...ch })) || []
  }
}
module.exports = Podcast
