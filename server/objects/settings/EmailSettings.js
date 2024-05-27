const Logger = require('../../Logger')
const { areEquivalent, copyValue, isNullOrNaN } = require('../../utils')

/**
 * @typedef EreaderDeviceObject
 * @property {string} name
 * @property {string} email
 * @property {string} availabilityOption
 * @property {string[]} users
 */

// REF: https://nodemailer.com/smtp/
class EmailSettings {
  constructor(settings = null) {
    this.id = 'email-settings'
    this.host = null
    this.port = 465
    this.secure = true
    this.user = null
    this.pass = null
    this.testAddress = null
    this.fromAddress = null

    /** @type {EreaderDeviceObject[]} */
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
    this.testAddress = settings.testAddress
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
      testAddress: this.testAddress,
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

    if (payload.ereaderDevices?.length) {
      // Validate ereader devices
      payload.ereaderDevices = payload.ereaderDevices.map((device) => {
        if (!device.name || !device.email) {
          Logger.error(`[EmailSettings] Update ereader device is invalid`, device)
          return null
        }
        if (!device.availabilityOption || !['adminOrUp', 'userOrUp', 'guestOrUp', 'specificUsers'].includes(device.availabilityOption)) {
          device.availabilityOption = 'adminOrUp'
        }
        if (device.availabilityOption === 'specificUsers' && !device.users?.length) {
          device.availabilityOption = 'adminOrUp'
        }
        if (device.availabilityOption !== 'specificUsers' && device.users?.length) {
          device.users = []
        }
        return device
      }).filter(d => d)
    }

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
    // Only set to true for port 465 (https://nodemailer.com/smtp/#tls-options)
    if (this.port !== 465) {
      payload.secure = false
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

  /**
   * 
   * @param {EreaderDeviceObject} device 
   * @param {import('../user/User')} user 
   * @returns {boolean}
   */
  checkUserCanAccessDevice(device, user) {
    let deviceAvailability = device.availabilityOption || 'adminOrUp'
    if (deviceAvailability === 'adminOrUp' && user.isAdminOrUp) return true
    if (deviceAvailability === 'userOrUp' && (user.isAdminOrUp || user.isUser)) return true
    if (deviceAvailability === 'guestOrUp') return true
    if (deviceAvailability === 'specificUsers') {
      let deviceUsers = device.users || []
      return deviceUsers.includes(user.id)
    }
    return false
  }

  /**
   * Get ereader devices accessible to user
   * 
   * @param {import('../user/User')} user 
   * @returns {EreaderDeviceObject[]}
   */
  getEReaderDevices(user) {
    return this.ereaderDevices.filter((device) => this.checkUserCanAccessDevice(device, user))
  }

  /**
   * Get ereader device by name
   * 
   * @param {string} deviceName 
   * @returns {EreaderDeviceObject}
   */
  getEReaderDevice(deviceName) {
    return this.ereaderDevices.find(d => d.name === deviceName)
  }
}
module.exports = EmailSettings