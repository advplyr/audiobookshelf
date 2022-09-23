const axios = require('axios')
const Logger = require("../Logger")
const { notificationData } = require('../utils/notifications')

class NotificationManager {
  constructor(db) {
    this.db = db

    this.notificationFailedMap = {}
  }

  getData() {
    return notificationData
  }

  onPodcastEpisodeDownloaded(libraryItem, episode) {
    if (!this.db.notificationSettings.isUseable) return

    Logger.debug(`[NotificationManager] onPodcastEpisodeDownloaded: Episode "${episode.title}" for podcast ${libraryItem.media.metadata.title}`)
    this.triggerNotification('onPodcastEpisodeDownloaded', { libraryItem, episode })
  }

  onTest() {
    this.triggerNotification('onTest')
  }

  async triggerNotification(eventName, eventData) {
    if (!this.db.notificationSettings.isUseable) return

    const notifications = this.db.notificationSettings.getNotificationsForEvent(eventName)
    for (const notification of notifications) {
      Logger.debug(`[NotificationManager] triggerNotification: Sending ${eventName} notification ${notification.id}`)
      const success = await this.sendNotification(notification, eventData)

      if (!success) { // Failed notification
        if (!this.notificationFailedMap[notification.id]) this.notificationFailedMap[notification.id] = 1
        else this.notificationFailedMap[notification.id]++

        if (this.notificationFailedMap[notification.id] > 2) {
          Logger.error(`[NotificationManager] triggerNotification: ${notification.eventName}/${notification.id} reached max failed attempts`)
          // TODO: Do something like disable the notification
        }
      } else { // Successful notification
        delete this.notificationFailedMap[notification.id]
      }
    }
  }

  sendNotification(notification, eventData) {
    const payload = notification.getApprisePayload(eventData)
    return axios.post(`${this.db.notificationSettings.appriseApiUrl}/notify`, payload, { timeout: 6000 }).then((response) => {
      Logger.debug(`[NotificationManager] sendNotification: ${notification.eventName}/${notification.id} response=`, response.data)
      return true
    }).catch((error) => {
      Logger.error(`[NotificationManager] sendNotification: ${notification.eventName}/${notification.id} error=`, error)
      return false
    })
  }
}
module.exports = NotificationManager