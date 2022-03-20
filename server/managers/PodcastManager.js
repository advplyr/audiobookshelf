class PodcastManager {
  constructor(db) {
    this.db = db

    this.downloadQueue = []
  }

  async downloadPodcasts(podcasts, targetDir) {

  }
}
module.exports = PodcastManager