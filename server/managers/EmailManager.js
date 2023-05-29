const nodemailer = require('nodemailer')
const Logger = require("../Logger")
const SocketAuthority = require('../SocketAuthority')

class EmailManager {
  constructor(db) {
    this.db = db
  }

  getTransporter() {
    return nodemailer.createTransport(this.db.emailSettings.getTransportObject())
  }

  async sendTest(res) {
    Logger.info(`[EmailManager] Sending test email`)
    const transporter = this.getTransporter()

    const success = await transporter.verify().catch((error) => {
      Logger.error(`[EmailManager] Failed to verify SMTP connection config`, error)
      return false
    })

    if (!success) {
      return res.status(400).send('Failed to verify SMTP connection configuration')
    }

    transporter.sendMail({
      from: this.db.emailSettings.fromAddress,
      to: this.db.emailSettings.fromAddress,
      subject: 'Test email from Audiobookshelf',
      text: 'Success!'
    }).then((result) => {
      Logger.info(`[EmailManager] Test email sent successfully`, result)
      res.sendStatus(200)
    }).catch((error) => {
      Logger.error(`[EmailManager] Failed to send test email`, error)
      res.status(400).send(error.message || 'Failed to send test email')
    })
  }

  async sendEBookToDevice(ebookFile, device, res) {
    Logger.info(`[EmailManager] Sending ebook "${ebookFile.metadata.filename}" to device "${device.name}"/"${device.email}"`)
    const transporter = this.getTransporter()

    const success = await transporter.verify().catch((error) => {
      Logger.error(`[EmailManager] Failed to verify SMTP connection config`, error)
      return false
    })

    if (!success) {
      return res.status(400).send('Failed to verify SMTP connection configuration')
    }

    transporter.sendMail({
      from: this.db.emailSettings.fromAddress,
      to: device.email,
      html: '<div dir="auto"></div>',
      attachments: [
        {
          filename: ebookFile.metadata.filename,
          path: ebookFile.metadata.path,
        }
      ]
    }).then((result) => {
      Logger.info(`[EmailManager] Ebook sent to device successfully`, result)
      res.sendStatus(200)
    }).catch((error) => {
      Logger.error(`[EmailManager] Failed to send ebook to device`, error)
      res.status(400).send(error.message || 'Failed to send ebook to device')
    })
  }
}
module.exports = EmailManager
