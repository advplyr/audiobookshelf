class DeviceInfo {
  constructor(deviceInfo = null) {
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

    this.serverVersion = null

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
      serverVersion: this.serverVersion
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

  setData(ip, ua, clientDeviceInfo, serverVersion) {
    this.deviceId = clientDeviceInfo?.deviceId || null
    this.ipAddress = ip || null

    this.browserName = ua?.browser.name || null
    this.browserVersion = ua?.browser.version || null
    this.osName = ua?.os.name || null
    this.osVersion = ua?.os.version || null
    this.deviceType = ua?.device.type || null

    this.clientVersion = clientDeviceInfo?.clientVersion || null
    this.manufacturer = clientDeviceInfo?.manufacturer || null
    this.model = clientDeviceInfo?.model || null
    this.sdkVersion = clientDeviceInfo?.sdkVersion || null

    this.serverVersion = serverVersion || null

    if (!this.deviceId) {
      this.deviceId = this.getTempDeviceId()
    }
  }
}
module.exports = DeviceInfo