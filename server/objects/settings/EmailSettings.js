const Logger = require('../../Logger')
const { areEquivalent, copyValue, isNullOrNaN } = require('../../utils')

// REF: https://nodemailer.com/smtp/
class EmailSettings {
  constructor(settings = null) {
    this.id = 'email-settings'
    this.host = null
    this.port = 465
    this.secure = true
    this.user = null
    this.pass = null
    this.fromAddress = null

    // Array of { name:String, email:String }
    this.ereaderDevices = []

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.host = settings.host
    this.port = settings.port
    this.secure = !!settings.secure
    this.user = settings.user
    this.pass = settings.pass
    this.fromAddress = settings.fromAddress
    this.ereaderDevices = settings.ereaderDevices?.map(d => ({ ...d })) || []
  }

  toJSON() {
    return {
      id: this.id,
      host: this.host,
      port: this.port,
      secure: this.secure,
      user: this.user,
      pass: this.pass,
      fromAddress: this.fromAddress,
      ereaderDevices: this.ereaderDevices.map(d => ({ ...d }))
    }
  }

  update(payload) {
    if (!payload) return false

    if (payload.port !== undefined) {
      if (isNullOrNaN(payload.port)) payload.port = 465
      else payload.port = Number(payload.port)
    }
    if (payload.secure !== undefined) payload.secure = !!payload.secure

    if (payload.ereaderDevices !== undefined && !Array.isArray(payload.ereaderDevices)) payload.ereaderDevices = undefined

    let hasUpdates = false

    const json = this.toJSON()
    for (const key in json) {
      if (key === 'id') continue

      if (payload[key] !== undefined && !areEquivalent(payload[key], json[key])) {
        this[key] = copyValue(payload[key])
        hasUpdates = true
      }
    }

    return hasUpdates
  }

  getTransportObject() {
    const payload = {
      host: this.host,
      secure: this.secure
    }
    if (this.port) payload.port = this.port
    if (this.user && this.pass !== undefined) {
      payload.auth = {
        user: this.user,
        pass: this.pass
      }
    }

    return payload
  }

  getEReaderDevices(user) {
    // Only accessible to admin or up
    if (!user.isAdminOrUp) {
      return []
    }

    return this.ereaderDevices.map(d => ({ ...d }))
  }

  getEReaderDevice(deviceName) {
    return this.ereaderDevices.find(d => d.name === deviceName)
  }
}
module.exports = EmailSettings