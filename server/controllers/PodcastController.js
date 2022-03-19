const axios = require('axios')
const fs = require('fs-extra')
const Logger = require('../Logger')
const { parsePodcastRssFeedXml } = require('../utils/podcastUtils')
const LibraryItem = require('../objects/LibraryItem')

class PodcastController {

  async create(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[PodcastController] Non-root user attempted to create podcast`, req.user)
      return res.sendStatus(500)
    }
    const payload = req.body

    if (await fs.pathExists(payload.path)) {
      Logger.error(`[PodcastController] Attempt to create podcast when folder path already exists "${payload.path}"`)
      return res.status(400).send('Path already exists')
    }

    var success = await fs.ensureDir(payload.path).then(() => true).catch((error) => {
      Logger.error(`[PodcastController] Failed to ensure podcast dir "${payload.path}"`, error)
      return false
    })
    if (!success) return res.status(400).send('Invalid podcast path')

    if (payload.mediaMetadata.imageUrl) {
      // TODO: Download image
    }

    var libraryItem = new LibraryItem()
    libraryItem.setData('podcast', payload)

    await this.db.insertLibraryItem(libraryItem)
    this.emitter('item_added', libraryItem.toJSONExpanded())

    res.json(libraryItem.toJSONExpanded())
  }

  getPodcastFeed(req, res) {
    var url = req.body.rssFeed
    if (!url) {
      return res.status(400).send('Bad request')
    }

    axios.get(url).then(async (data) => {
      if (!data || !data.data) {
        Logger.error('Invalid podcast feed request response')
        return res.status(500).send('Bad response from feed request')
      }
      var podcast = await parsePodcastRssFeedXml(data.data)
      if (!podcast) {
        return res.status(500).send('Invalid podcast RSS feed')
      }
      res.json(podcast)
    }).catch((error) => {
      console.error('Failed', error)
      res.status(500).send(error)
    })
  }
}
module.exports = new PodcastController()