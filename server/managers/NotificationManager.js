const Logger = require("../Logger")

class NotificationManager {
  constructor() { }

  onNewPodcastEpisode(libraryItem, episode) {
    Logger.debug(`[NotificationManager] onNewPodcastEpisode: Episode "${episode.title}" for podcast ${libraryItem.media.metadata.title}`)
  }
}
module.exports = NotificationManager