import { v4 as uuidv4 } from 'uuid'
import htmlSanitizer from '../utils/htmlSanitizer'

const { stripAllTags } = htmlSanitizer

type DeviceData = {
  id?: string | null
  userId?: string | null
  deviceId?: string | null
  ipAddress?: string | null
  browserName?: string | null
  browserVersion?: string | null
  osName?: string | null
  osVersion?: string | null
  deviceType?: string | null
  clientVersion?: string | null
  manufacturer?: string | null
  model?: string | null
  sdkVersion?: string | null
  clientName?: string | null
  deviceName?: string | null
}

type ClientDeviceInfo = Omit<DeviceData, 'sdkVersion'> & { sdkVersion?: string | number | null }

type UserAgent = {
  browser: { name?: string; version?: string }
  os: { name?: string; version?: string }
  device: { type?: string }
}

class DeviceInfo {
  declare id: string | null | undefined
  declare userId: string | null | undefined
  declare deviceId: string | null | undefined
  declare ipAddress: string | null | undefined
  declare browserName: string | null | undefined
  declare browserVersion: string | null | undefined
  declare osName: string | null | undefined
  declare osVersion: string | null | undefined
  declare deviceType: string | null | undefined
  declare clientVersion: string | null | undefined
  declare manufacturer: string | null | undefined
  declare model: string | null | undefined
  declare sdkVersion: string | null | undefined
  declare clientName: string | null | undefined
  declare deviceName: string | null | undefined

  /** @type {string[]} Fields to sanitize when loading from stored data */
  static stringFields = ['deviceId', 'clientVersion', 'manufacturer', 'model', 'sdkVersion', 'clientName', 'deviceName']

  constructor(deviceInfo: DeviceData | null = null) {
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

  construct(deviceInfo: DeviceData) {
    for (const field in deviceInfo) {
      const key = field as keyof DeviceData
      if (deviceInfo[key] !== undefined && this[key] !== undefined) {
        this[key] = DeviceInfo.stringFields.includes(key) ? stripAllTags(deviceInfo[key]) : deviceInfo[key]
      }
    }
  }

  toJSON(): DeviceData {
    const obj: DeviceData = {
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
    for (const field in obj) {
      const key = field as keyof DeviceData
      if (obj[key] === null || obj[key] === undefined) {
        delete obj[key]
      }
    }
    return obj
  }

  get deviceDescription() {
    if (this.model) {
      // Set from mobile apps
      if (this.sdkVersion) return `${this.model} SDK ${this.sdkVersion} / v${this.clientVersion}`
      return `${this.model} / v${this.clientVersion}`
    }
    return `${this.osName} ${this.osVersion} / ${this.browserName}`
  }

  // When client doesn't send a device id
  getTempDeviceId() {
    const keys = [this.userId, this.browserName, this.browserVersion, this.osName, this.osVersion, this.clientVersion, this.manufacturer, this.model, this.sdkVersion, this.ipAddress].map((k) => k || '')
    return 'temp-' + Buffer.from(keys.join('-'), 'utf-8').toString('base64')
  }

  setData(
    ip: string | null | undefined,
    ua: UserAgent | null | undefined,
    clientDeviceInfo: ClientDeviceInfo | null | undefined,
    serverVersion: string,
    userId: string | undefined
  ) {
    this.id = uuidv4()
    this.userId = userId
    this.deviceId = clientDeviceInfo?.deviceId || this.id
    this.ipAddress = ip || null

    this.browserName = ua?.browser.name || null
    this.browserVersion = ua?.browser.version || null
    this.osName = ua?.os.name || null
    this.osVersion = ua?.os.version || null
    this.deviceType = ua?.device.type || null

    this.clientVersion = stripAllTags(clientDeviceInfo?.clientVersion) || serverVersion
    this.manufacturer = stripAllTags(clientDeviceInfo?.manufacturer) || null
    this.model = stripAllTags(clientDeviceInfo?.model) || null

    if (typeof clientDeviceInfo?.sdkVersion === 'number') {
      this.sdkVersion = clientDeviceInfo.sdkVersion.toString()
    } else {
      this.sdkVersion = stripAllTags(clientDeviceInfo?.sdkVersion) || null
    }

    this.clientName = stripAllTags(clientDeviceInfo?.clientName) || null
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

  update(deviceInfo: DeviceData & { toJSON?(): DeviceData }) {
    const deviceInfoJson = deviceInfo.toJSON ? deviceInfo.toJSON() : deviceInfo
    const existingDeviceInfoJson = this.toJSON()

    let hasUpdates = false
    for (const field in deviceInfoJson) {
      const key = field as keyof DeviceData
      if (['id', 'deviceId'].includes(key)) continue

      if (deviceInfoJson[key] !== existingDeviceInfoJson[key]) {
        this[key] = deviceInfoJson[key]
        hasUpdates = true
      }
    }

    for (const field in existingDeviceInfoJson) {
      const key = field as keyof DeviceData
      if (['id', 'deviceId'].includes(key)) continue

      if (existingDeviceInfoJson[key] && !deviceInfoJson[key]) {
        this[key] = null
        hasUpdates = true
      }
    }

    return hasUpdates
  }
}
export = DeviceInfo
