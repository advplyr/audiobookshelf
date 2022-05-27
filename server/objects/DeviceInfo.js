class DeviceInfo {
  constructor(deviceInfo = null) {
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

  setData(ip, ua, clientDeviceInfo, serverVersion) {
    this.ipAddress = ip || null

    const uaObj = ua || {}
    this.browserName = uaObj.browser.name || null
    this.browserVersion = uaObj.browser.version || null
    this.osName = uaObj.os.name || null
    this.osVersion = uaObj.os.version || null
    this.deviceType = uaObj.device.type || null

    var cdi = clientDeviceInfo || {}
    this.clientVersion = cdi.clientVersion || null
    this.manufacturer = cdi.manufacturer || null
    this.model = cdi.model || null
    this.sdkVersion = cdi.sdkVersion || null

    this.serverVersion = serverVersion || null
  }
}
module.exports = DeviceInfo