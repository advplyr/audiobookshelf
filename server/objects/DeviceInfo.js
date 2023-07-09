const uuidv4 = require("uuid").v4

class DeviceInfo {
  constructor(deviceInfo = null) {
    this.id = null
    this.userId = null
    this.deviceId = null
    this.ipAddress = null

    // From User Agent (see: https://www.npmjs.com/package/ua-parser-js)
    this.browserName = null
    this.browserVersion = null
    this.osName = null
    this.osVersion = null
    this.deviceType = null

    // From client
    this.clientVersion = null
    this.manufacturer = null
    this.model = null
    this.sdkVersion = null // Android Only

    this.clientName = null
    this.deviceName = null

    if (deviceInfo) {
      this.construct(deviceInfo)
    }
  }

  construct(deviceInfo) {
    for (const key in deviceInfo) {
      if (deviceInfo[key] !== undefined && this[key] !== undefined) {
        this[key] = deviceInfo[key]
      }
    }
  }

  toJSON() {
    const obj = {
      id: this.id,
      userId: this.userId,
      deviceId: this.deviceId,
      ipAddress: this.ipAddress,
      browserName: this.browserName,
      browserVersion: this.browserVersion,
      osName: this.osName,
      osVersion: this.osVersion,
      deviceType: this.deviceType,
      clientVersion: this.clientVersion,
      manufacturer: this.manufacturer,
      model: this.model,
      sdkVersion: this.sdkVersion,
      clientName: this.clientName,
      deviceName: this.deviceName
    }
    for (const key in obj) {
      if (obj[key] === null || obj[key] === undefined) {
        delete obj[key]
      }
    }
    return obj
  }

  get deviceDescription() {
    if (this.model) { // Set from mobile apps
      if (this.sdkVersion) return `${this.model} SDK ${this.sdkVersion} / v${this.clientVersion}`
      return `${this.model} / v${this.clientVersion}`
    }
    return `${this.osName} ${this.osVersion} / ${this.browserName}`
  }

  // When client doesn't send a device id
  getTempDeviceId() {
    const keys = [
      this.userId,
      this.browserName,
      this.browserVersion,
      this.osName,
      this.osVersion,
      this.clientVersion,
      this.manufacturer,
      this.model,
      this.sdkVersion,
      this.ipAddress
    ].map(k => k || '')
    return 'temp-' + Buffer.from(keys.join('-'), 'utf-8').toString('base64')
  }

  setData(ip, ua, clientDeviceInfo, serverVersion, userId) {
    this.id = uuidv4()
    this.userId = userId
    this.deviceId = clientDeviceInfo?.deviceId || this.id
    this.ipAddress = ip || null

    this.browserName = ua?.browser.name || null
    this.browserVersion = ua?.browser.version || null
    this.osName = ua?.os.name || null
    this.osVersion = ua?.os.version || null
    this.deviceType = ua?.device.type || null

    this.clientVersion = clientDeviceInfo?.clientVersion || serverVersion
    this.manufacturer = clientDeviceInfo?.manufacturer || null
    this.model = clientDeviceInfo?.model || null
    this.sdkVersion = clientDeviceInfo?.sdkVersion || null

    this.clientName = clientDeviceInfo?.clientName || null
    if (this.sdkVersion) {
      if (!this.clientName) this.clientName = 'Abs Android'
      this.deviceName = `${this.manufacturer || 'Unknown'} ${this.model || ''}`
    } else if (this.model) {
      if (!this.clientName) this.clientName = 'Abs iOS'
      this.deviceName = `${this.manufacturer || 'Unknown'} ${this.model || ''}`
    } else if (this.osName && this.browserName) {
      if (!this.clientName) this.clientName = 'Abs Web'
      this.deviceName = `${this.osName} ${this.osVersion || 'N/A'} ${this.browserName}`
    } else if (!this.clientName) {
      this.clientName = 'Unknown'
    }

    if (!this.deviceId) {
      this.deviceId = this.getTempDeviceId()
    }
  }

  update(deviceInfo) {
    const deviceInfoJson = deviceInfo.toJSON ? deviceInfo.toJSON() : deviceInfo
    const existingDeviceInfoJson = this.toJSON()

    let hasUpdates = false
    for (const key in deviceInfoJson) {
      if (['id', 'deviceId'].includes(key)) continue

      if (deviceInfoJson[key] !== existingDeviceInfoJson[key]) {
        this[key] = deviceInfoJson[key]
        hasUpdates = true
      }
    }

    for (const key in existingDeviceInfoJson) {
      if (['id', 'deviceId'].includes(key)) continue

      if (existingDeviceInfoJson[key] && !deviceInfoJson[key]) {
        this[key] = null
        hasUpdates = true
      }
    }

    return hasUpdates
  }
}
module.exports = DeviceInfo