const uuidv4 = require("uuid").v4

/**
 * @openapi
 * components:
 *   schemas:
 *     mediaProgress:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the media progress. If the media progress is for a book, this will just be the libraryItemId. If for a podcast episode, it will be a hyphenated combination of the libraryItemId and episodeId.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm-ep_lh6ko39pumnrma3dhv
 *         libraryItemId:
 *           description: The ID of the library item the media progress is of.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode the media progress is of. Will be null if the progress is for a book.
 *           type: [string, 'null']
 *           example: ep_lh6ko39pumnrma3dhv
 *         duration:
 *           description: The total duration (in seconds) of the media. Will be 0 if the media was marked as finished without the user listening to it.
 *           type: number
 *           example: 1454.18449
 *         progress:
 *           description: The percentage completion progress of the media. Will be 1 if the media is finished.
 *           type: number
 *           example: 0.011193983371394644
 *         currentTime:
 *           description: The current time (in seconds) of the user's progress. If the media has been marked as finished, this will be the time the user was at beforehand.
 *           type: number
 *           example: 16.278117
 *         isFinished:
 *           description: Whether the media is finished.
 *           type: boolean
 *           example: false
 *         hideFromContinueListening:
 *           description: Whether the media will be hidden from the "Continue Listening" shelf.
 *           type: boolean
 *           example: false
 *         lastUpdate:
 *           description: The time (in ms since POSIX epoch) when the media progress was last updated.
 *           type: integer
 *           example: 1668120246620
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the media progress was created.
 *           type: integer
 *           example: 1668120083771
 *         finishedAt:
 *           description: The time (in ms since POSIX epoch) when the media was finished. Will be null if the media has is not finished.
 *           type: [string, 'null']
 *     mediaProgressWithMedia:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the media progress. If the media progress is for a book, this will just be the libraryItemId. If for a podcast episode, it will be a hyphenated combination of the libraryItemId and episodeId.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm-ep_lh6ko39pumnrma3dhv
 *         libraryItemId:
 *           description: The ID of the library item the media progress is of.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode the media progress is of. Will be null if the progress is for a book.
 *           type: [string, 'null']
 *           example: ep_lh6ko39pumnrma3dhv
 *         duration:
 *           description: The total duration (in seconds) of the media. Will be 0 if the media was marked as finished without the user listening to it.
 *           type: number
 *           example: 1454.18449
 *         progress:
 *           description: The percentage completion progress of the media. Will be 1 if the media is finished.
 *           type: number
 *           example: 0.011193983371394644
 *         currentTime:
 *           description: The current time (in seconds) of the user's progress. If the media has been marked as finished, this will be the time the user was at beforehand.
 *           type: number
 *           example: 16.278117
 *         isFinished:
 *           description: Whether the media is finished.
 *           type: boolean
 *           example: false
 *         hideFromContinueListening:
 *           description: Whether the media will be hidden from the "Continue Listening" shelf.
 *           type: boolean
 *           example: false
 *         lastUpdate:
 *           description: The time (in ms since POSIX epoch) when the media progress was last updated.
 *           type: integer
 *           example: 1668120246620
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the media progress was created.
 *           type: integer
 *           example: 1668120083771
 *         finishedAt:
 *           description: The time (in ms since POSIX epoch) when the media was finished. Will be null if the media has is not finished.
 *           type: [string, 'null']
 *         media:
 *           description: The media of the library item the media progress is for.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *             - $ref: '#/components/schemas/bookExpanded'
 *             - $ref: '#/components/schemas/podcastExpanded'
 *         episode:
 *           $ref: '#/components/schemas/podcastEpisode'
 */
class MediaProgress {
  constructor(progress) {
    this.id = null
    this.userId = null
    this.libraryItemId = null
    this.episodeId = null // For podcasts

    this.mediaItemId = null // For use in new data model
    this.mediaItemType = null // For use in new data model

    this.duration = null
    this.progress = null // 0 to 1
    this.currentTime = null // seconds
    this.isFinished = false
    this.hideFromContinueListening = false

    this.ebookLocation = null // cfi tag for epub, page number for pdf
    this.ebookProgress = null // 0 to 1

    this.lastUpdate = null
    this.startedAt = null
    this.finishedAt = null

    if (progress) {
      this.construct(progress)
    }
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      libraryItemId: this.libraryItemId,
      episodeId: this.episodeId,
      mediaItemId: this.mediaItemId,
      mediaItemType: this.mediaItemType,
      duration: this.duration,
      progress: this.progress,
      currentTime: this.currentTime,
      isFinished: this.isFinished,
      hideFromContinueListening: this.hideFromContinueListening,
      ebookLocation: this.ebookLocation,
      ebookProgress: this.ebookProgress,
      lastUpdate: this.lastUpdate,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    }
  }

  construct(progress) {
    this.id = progress.id
    this.userId = progress.userId
    this.libraryItemId = progress.libraryItemId
    this.episodeId = progress.episodeId
    this.mediaItemId = progress.mediaItemId
    this.mediaItemType = progress.mediaItemType
    this.duration = progress.duration || 0
    this.progress = progress.progress
    this.currentTime = progress.currentTime || 0
    this.isFinished = !!progress.isFinished
    this.hideFromContinueListening = !!progress.hideFromContinueListening
    this.ebookLocation = progress.ebookLocation || null
    this.ebookProgress = progress.ebookProgress || null
    this.lastUpdate = progress.lastUpdate
    this.startedAt = progress.startedAt
    this.finishedAt = progress.finishedAt || null
  }

  get inProgress() {
    return !this.isFinished && (this.progress > 0 || (this.ebookLocation != null && this.ebookProgress > 0))
  }

  get notStarted() {
    return !this.isFinished && this.progress == 0
  }

  setData(libraryItem, progress, episodeId, userId) {
    this.id = uuidv4()
    this.userId = userId
    this.libraryItemId = libraryItem.id
    this.episodeId = episodeId

    // PodcastEpisodeId or BookId
    this.mediaItemId = episodeId || libraryItem.media.id
    this.mediaItemType = episodeId ? 'podcastEpisode' : 'book'

    this.duration = progress.duration || 0
    this.progress = Math.min(1, (progress.progress || 0))
    this.currentTime = progress.currentTime || 0
    this.isFinished = !!progress.isFinished || this.progress == 1
    this.hideFromContinueListening = !!progress.hideFromContinueListening
    this.ebookLocation = progress.ebookLocation
    this.ebookProgress = Math.min(1, (progress.ebookProgress || 0))
    this.lastUpdate = Date.now()
    this.finishedAt = null
    if (this.isFinished) {
      this.finishedAt = progress.finishedAt || Date.now()
      this.progress = 1
    }
    this.startedAt = progress.startedAt || this.finishedAt || Date.now()
  }

  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      if (this[key] !== undefined && payload[key] !== this[key]) {
        if (key === 'isFinished') {
          if (!payload[key]) { // Updating to Not Finished - Reset progress and current time
            this.finishedAt = null
            this.progress = 0
            this.currentTime = 0
          } else { // Updating to Finished
            if (!this.finishedAt) this.finishedAt = Date.now()
            this.progress = 1
          }
        }

        this[key] = payload[key]
        hasUpdates = true
      }
    }

    var timeRemaining = this.duration - this.currentTime
    // If time remaining is less than 5 seconds then mark as finished
    if ((this.progress >= 1 || (this.duration && !isNaN(timeRemaining) && timeRemaining < 5))) {
      this.isFinished = true
      this.finishedAt = payload.finishedAt || Date.now()
      this.progress = 1
    } else if (this.progress < 1 && this.isFinished) {
      this.isFinished = false
      this.finishedAt = null
    }

    if (!this.startedAt) {
      this.startedAt = this.finishedAt || Date.now()
    }
    if (hasUpdates) {
      if (payload.hideFromContinueListening === undefined) {
        // Reset this flag when the media progress is updated
        this.hideFromContinueListening = false
      }

      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }

  removeFromContinueListening() {
    if (this.hideFromContinueListening) return false

    this.hideFromContinueListening = true
    return true
  }
}
module.exports = MediaProgress