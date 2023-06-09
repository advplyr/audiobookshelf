const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

class EmailController {
  constructor() { }

  getSettings(req, res) {
    res.json({
      settings: this.db.emailSettings
    })
  }

  async updateSettings(req, res) {
    const updated = this.db.emailSettings.update(req.body)
    if (updated) {
      await this.db.updateEntity('settings', this.db.emailSettings)
    }
    res.json({
      settings: this.db.emailSettings
    })
  }

  async sendTest(req, res) {
    this.emailManager.sendTest(res)
  }

  async updateEReaderDevices(req, res) {
    if (!req.body.ereaderDevices || !Array.isArray(req.body.ereaderDevices)) {
      return res.status(400).send('Invalid payload. ereaderDevices array required')
    }

    const ereaderDevices = req.body.ereaderDevices
    for (const device of ereaderDevices) {
      if (!device.name || !device.email) {
        return res.status(400).send('Invalid payload. ereaderDevices array items must have name and email')
      }
    }

    const updated = this.db.emailSettings.update({
      ereaderDevices
    })
    if (updated) {
      await this.db.updateEntity('settings', this.db.emailSettings)
      SocketAuthority.adminEmitter('ereader-devices-updated', {
        ereaderDevices: this.db.emailSettings.ereaderDevices
      })
    }
    res.json({
      ereaderDevices: this.db.emailSettings.ereaderDevices
    })
  }

  async sendEBookToDevice(req, res) {
    Logger.debug(`[EmailController] Send ebook to device request for libraryItemId=${req.body.libraryItemId}, deviceName=${req.body.deviceName}`)

    const libraryItem = this.db.getLibraryItem(req.body.libraryItemId)
    if (!libraryItem) {
      return res.status(404).send('Library item not found')
    }

    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      return res.sendStatus(403)
    }

    const ebookFile = libraryItem.media.ebookFile
    if (!ebookFile) {
      return res.status(404).send('EBook file not found')
    }

    const device = this.db.emailSettings.getEReaderDevice(req.body.deviceName)
    if (!device) {
      return res.status(404).send('E-reader device not found')
    }

    this.emailManager.sendEBookToDevice(ebookFile, device, res)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(404)
    }

    next()
  }
}
module.exports = new EmailController()