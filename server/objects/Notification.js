const uuidv4 = require("uuid").v4

/**
 * @openapi
 * components:
 *   schemas:
 *     notification:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the notification.
 *           type: string
 *           example: noti_nod281qwkj5ow7h7fi
 *         libraryId:
 *           description: The ID of the library the notification is associated with.
 *           type: [string, 'null']
 *         eventName:
 *           description: The name of the event the notification will fire on.
 *           type: string
 *           example: onPodcastEpisodeDownloaded
 *         urls:
 *           description: The Apprise URLs to use for the notification.
 *           type: array
 *           items:
 *             type: string
 *             example: apprises://apprise.example.com/email
 *         titleTemplate:
 *           description: The template for the notification title.
 *           type: string
 *           example: New {{podcastTitle}} Episode!
 *         bodyTemplate:
 *           description: The template for the notification body.
 *           type: string
 *           example: '{{episodeTitle}} has been added to {{libraryName}} library.'
 *         enabled:
 *           description: Whether the notification is enabled.
 *           type: boolean
 *           example: true
 *         type:
 *           description: The notification's type.
 *           type: string
 *           example: info
 *         lastFiredAt:
 *           description: The time (in ms since POSIX epoch) when the notification was last fired. Will be null if the notification has not fired.
 *           type: [integer, 'null']
 *           example: 1668776410792
 *         lastAttemptFailed:
 *           description: Whether the last notification attempt failed.
 *           type: boolean
 *           example: false
 *         numConsecutiveFailedAttempts:
 *           description: The number of consecutive times the notification has failed.
 *           type: integer
 *           example: 0
 *         numTimesFired:
 *           description: The number of times the notification has fired.
 *           type: integer
 *           example: 5
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *     notificationEvents:
 *       type: object
 *       properties:
 *         name:
 *           description: The name of the notification event.
 *           type: string
 *           example: onPodcastEpisodeDownloaded
 *         requiresLibrary:
 *           description: Whether the notification event depends on a library existing.
 *           type: boolean
 *           example: true
 *         libraryMediaType:
 *           description: The type of media of the library the notification depends on existing. Will not exist if requiresLibrary is false.
 *           type: [string, 'null']
 *           example: podcast
 *         description:
 *           description: The description of the notification event.
 *           type: string
 *           example: Triggered when a podcast episode is auto-downloaded
 *         variables:
 *           description: The variables of the notification event that can be used in the notification templates.
 *           type: array
 *           items:
 *             type: string
 *             example: libraryItemId
 *               - libraryId
 *               - libraryName
 *               - mediaTags
 *               - podcastTitle
 *               - podcastAuthor
 *               - podcastDescription
 *               - podcastGenres
 *               - episodeId
 *               - episodeTitle
 *               - episodeSubtitle
 *               - episodeDescription
 *         defaults:
 *           type: object
 *           properties:
 *             title:
 *               description: The default title template for notifications using the notification event.
 *               type: string
 *               example: New {{podcastTitle}} Episode!
 *             body:
 *               description: The default body template for notifications using the notification event.
 *               type: string
 *               example: '{{episodeTitle}} has been added to {{libraryName}} library.'
 *         testData:
 *           description: The keys of the testData object will match the list of variables. The values will be the data used when sending a test notification.
 *           type: object
 *           properties:
 *             libraryItemId:
 *               type: string
 *               example: li_notification_test
 *             libraryId:
 *               type: string
 *               example: lib_test
 *             libraryName:
 *               type: string
 *               example: Podcasts
 *             podcastTitle:
 *               type: string
 *               example: Abs Test Podcast
 *             episodeId:
 *               type: string
 *               example: ep_notification_test
 *             episodeTitle:
 *               type: string
 *               example: Successful Test
 */
class Notification {
  constructor(notification = null) {
    this.id = null
    this.libraryId = null
    this.eventName = ''
    this.urls = []
    this.titleTemplate = ''
    this.bodyTemplate = ''
    this.type = 'info'
    this.enabled = false

    this.lastFiredAt = null
    this.lastAttemptFailed = false
    this.numConsecutiveFailedAttempts = 0
    this.numTimesFired = 0
    this.createdAt = null

    if (notification) {
      this.construct(notification)
    }
  }

  construct(notification) {
    this.id = notification.id
    this.libraryId = notification.libraryId || null
    this.eventName = notification.eventName
    this.urls = notification.urls || []
    this.titleTemplate = notification.titleTemplate || ''
    this.bodyTemplate = notification.bodyTemplate || ''
    this.type = notification.type || 'info'
    this.enabled = !!notification.enabled
    this.lastFiredAt = notification.lastFiredAt || null
    this.lastAttemptFailed = !!notification.lastAttemptFailed
    this.numConsecutiveFailedAttempts = notification.numConsecutiveFailedAttempts || 0
    this.numTimesFired = notification.numTimesFired || 0
    this.createdAt = notification.createdAt
  }

  toJSON() {
    return {
      id: this.id,
      libraryId: this.libraryId,
      eventName: this.eventName,
      urls: this.urls,
      titleTemplate: this.titleTemplate,
      bodyTemplate: this.bodyTemplate,
      enabled: this.enabled,
      type: this.type,
      lastFiredAt: this.lastFiredAt,
      lastAttemptFailed: this.lastAttemptFailed,
      numConsecutiveFailedAttempts: this.numConsecutiveFailedAttempts,
      numTimesFired: this.numTimesFired,
      createdAt: this.createdAt
    }
  }

  setData(payload) {
    this.id = uuidv4()
    this.libraryId = payload.libraryId || null
    this.eventName = payload.eventName
    this.urls = payload.urls
    this.titleTemplate = payload.titleTemplate
    this.bodyTemplate = payload.bodyTemplate
    this.enabled = !!payload.enabled
    this.type = payload.type || null
    this.createdAt = Date.now()
  }

  update(payload) {
    if (!this.enabled && payload.enabled) {
      // Reset
      this.lastFiredAt = null
      this.lastAttemptFailed = false
      this.numConsecutiveFailedAttempts = 0
    }

    const keysToUpdate = ['libraryId', 'eventName', 'urls', 'titleTemplate', 'bodyTemplate', 'enabled', 'type']
    var hasUpdated = false
    for (const key of keysToUpdate) {
      if (payload[key] !== undefined) {
        if (key === 'urls') {
          if (payload[key].join(',') !== this.urls.join(',')) {
            this.urls = [...payload[key]]
            hasUpdated = true
          }
        } else if (payload[key] !== this[key]) {
          this[key] = payload[key]
          hasUpdated = true
        }
      }
    }
    return hasUpdated
  }

  updateNotificationFired(success) {
    this.lastFiredAt = Date.now()
    this.lastAttemptFailed = !success
    this.numConsecutiveFailedAttempts = success ? 0 : this.numConsecutiveFailedAttempts + 1
    this.numTimesFired++
  }

  replaceVariablesInTemplate(templateText, data) {
    const ptrn = /{{ ?([a-zA-Z]+) ?}}/mg

    var match
    var updatedTemplate = templateText
    while ((match = ptrn.exec(templateText)) != null) {
      if (data[match[1]]) {
        updatedTemplate = updatedTemplate.replace(match[0], data[match[1]])
      }
    }
    return updatedTemplate
  }

  parseTitleTemplate(data) {
    return this.replaceVariablesInTemplate(this.titleTemplate, data)
  }

  parseBodyTemplate(data) {
    return this.replaceVariablesInTemplate(this.bodyTemplate, data)
  }

  getApprisePayload(data) {
    return {
      urls: this.urls,
      title: this.parseTitleTemplate(data),
      body: this.parseBodyTemplate(data)
    }
  }
}
module.exports = Notification