const axios = require('axios')
const Logger = require("../Logger")
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const { notificationData } = require('../utils/notifications')

class NotificationManager {
  constructor() {
    this.sendingNotification = false
    this.notificationQueue = []
  }

  getData() {
    return notificationData
  }

  async onPodcastEpisodeDownloaded(libraryItem, episode) {
    if (!Database.notificationSettings.isUseable) return

    Logger.debug(`[NotificationManager] onPodcastEpisodeDownloaded: Episode "${episode.title}" for podcast ${libraryItem.media.metadata.title}`)
    const library = await Database.models.library.getOldById(libraryItem.libraryId)
    const eventData = {
      libraryItemId: libraryItem.id,
      libraryId: libraryItem.libraryId,
      libraryName: library?.name || 'Unknown',
      mediaTags: (libraryItem.media.tags || []).join(', '),
      podcastTitle: libraryItem.media.metadata.title,
      podcastAuthor: libraryItem.media.metadata.author || '',
      podcastDescription: libraryItem.media.metadata.description || '',
      podcastGenres: (libraryItem.media.metadata.genres || []).join(', '),
      episodeId: episode.id,
      episodeTitle: episode.title,
      episodeSubtitle: episode.subtitle || '',
      episodeDescription: episode.description || ''
    }
    this.triggerNotification('onPodcastEpisodeDownloaded', eventData)
  }

  onTest() {
    this.triggerNotification('onTest')
  }

  async triggerNotification(eventName, eventData, intentionallyFail = false) {
    if (!Database.notificationSettings.isUseable) return

    // Will queue the notification if sendingNotification and queue is not full
    if (!this.checkTriggerNotification(eventName, eventData)) return

    const notifications = Database.notificationSettings.getActiveNotificationsForEvent(eventName)
    for (const notification of notifications) {
      Logger.debug(`[NotificationManager] triggerNotification: Sending ${eventName} notification ${notification.id}`)
      const success = intentionallyFail ? false : await this.sendNotification(notification, eventData)

      notification.updateNotificationFired(success)
      if (!success) { // Failed notification
        if (notification.numConsecutiveFailedAttempts >= Database.notificationSettings.maxFailedAttempts) {
          Logger.error(`[NotificationManager] triggerNotification: ${notification.eventName}/${notification.id} reached max failed attempts`)
          notification.enabled = false
        } else {
          Logger.error(`[NotificationManager] triggerNotification: ${notification.eventName}/${notification.id} ${notification.numConsecutiveFailedAttempts} failed attempts`)
        }
      }
    }

    await Database.updateSetting(Database.notificationSettings)
    SocketAuthority.emitter('notifications_updated', Database.notificationSettings.toJSON())

    this.notificationFinished()
  }

  // Return TRUE if notification should be triggered now
  checkTriggerNotification(eventName, eventData) {
    if (this.sendingNotification) {
      if (this.notificationQueue.length >= Database.notificationSettings.maxNotificationQueue) {
        Logger.warn(`[NotificationManager] Notification queue is full - ignoring event ${eventName}`)
      } else {
        Logger.debug(`[NotificationManager] Queueing notification ${eventName} (Queue size: ${this.notificationQueue.length})`)
        this.notificationQueue.push({ eventName, eventData })
      }
      return false
    }
    this.sendingNotification = true
    return true
  }

  notificationFinished() {
    // Delay between events then run next notification in queue
    setTimeout(() => {
      this.sendingNotification = false
      if (this.notificationQueue.length) { // Send next notification in queue
        const nextNotificationEvent = this.notificationQueue.shift()
        this.triggerNotification(nextNotificationEvent.eventName, nextNotificationEvent.eventData)
      }
    }, Database.notificationSettings.notificationDelay)
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
    return axios.post(Database.notificationSettings.appriseApiUrl, payload, { timeout: 6000 }).then((response) => {
      Logger.debug(`[NotificationManager] sendNotification: ${notification.eventName}/${notification.id} response=`, response.data)
      return true
    }).catch((error) => {
      Logger.error(`[NotificationManager] sendNotification: ${notification.eventName}/${notification.id} error=`, error)
      return false
    })
  }
}
module.exports = NotificationManager
