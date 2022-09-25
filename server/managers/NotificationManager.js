const axios = require('axios')
const Logger = require("../Logger")
const { notificationData } = require('../utils/notifications')

class NotificationManager {
  constructor(db, emitter) {
    this.db = db
    this.emitter = emitter

    this.notificationFailedMap = {}
  }

  getData() {
    return notificationData
  }

  onPodcastEpisodeDownloaded(libraryItem, episode) {
    if (!this.db.notificationSettings.isUseable) return

    Logger.debug(`[NotificationManager] onPodcastEpisodeDownloaded: Episode "${episode.title}" for podcast ${libraryItem.media.metadata.title}`)
    const library = this.db.libraries.find(lib => lib.id === libraryItem.libraryId)
    const eventData = {
      libraryItemId: libraryItem.id,
      libraryId: libraryItem.libraryId,
      libraryName: library ? library.name : 'Unknown',
      podcastTitle: libraryItem.media.metadata.title,
      episodeId: episode.id,
      episodeTitle: episode.title
    }
    this.triggerNotification('onPodcastEpisodeDownloaded', eventData)
  }

  onTest() {
    this.triggerNotification('onTest')
  }

  async triggerNotification(eventName, eventData, intentionallyFail = false) {
    if (!this.db.notificationSettings.isUseable) return false

    const notifications = this.db.notificationSettings.getActiveNotificationsForEvent(eventName)
    for (const notification of notifications) {
      Logger.debug(`[NotificationManager] triggerNotification: Sending ${eventName} notification ${notification.id}`)
      const success = intentionallyFail ? false : await this.sendNotification(notification, eventData)

      notification.updateNotificationFired(success)
      if (!success) { // Failed notification
        if (notification.numConsecutiveFailedAttempts > 2) {
          Logger.error(`[NotificationManager] triggerNotification: ${notification.eventName}/${notification.id} reached max failed attempts`)
          notification.enabled = false
        } else {
          Logger.error(`[NotificationManager] triggerNotification: ${notification.eventName}/${notification.id} ${notification.numConsecutiveFailedAttempts} failed attempts`)
        }
      }
    }

    await this.db.updateEntity('settings', this.db.notificationSettings)
    this.emitter('notifications_updated', this.db.notificationSettings)
    return true
  }

  sendTestNotification(notification) {
    const eventData = notificationData.events.find(e => e.name === notification.eventName)
    if (!eventData) {
      Logger.error(`[NotificationManager] sendTestNotification: Event not found ${notification.eventName}`)
      return false
    }

    return this.sendNotification(notification, eventData.testData)
  }

  sendNotification(notification, eventData) {
    const payload = notification.getApprisePayload(eventData)
    return axios.post(this.db.notificationSettings.appriseApiUrl, payload, { timeout: 6000 }).then((response) => {
      Logger.debug(`[NotificationManager] sendNotification: ${notification.eventName}/${notification.id} response=`, response.data)
      return true
    }).catch((error) => {
      Logger.error(`[NotificationManager] sendNotification: ${notification.eventName}/${notification.id} error=`, error)
      return false
    })
  }
}
module.exports = NotificationManager