import Logger from '../../Logger'
import utils from '../../utils'

const { areEquivalent, copyValue, isNullOrNaN } = utils

type EreaderDeviceObject = {
  name?: string | null
  email?: string | null
  availabilityOption?: string | null
  users?: Array<string | null> | null
}

type EmailSettingsData = {
  host: string | null | undefined
  port: number | null | undefined
  secure: boolean
  rejectUnauthorized: boolean
  user: string | null | undefined
  pass: string | null | undefined
  testAddress: string | null | undefined
  fromAddress: string | null | undefined
  ereaderDevices: EreaderDeviceObject[]
}

type EmailSettingsUpdate = Omit<Partial<EmailSettingsData>, 'port' | 'secure' | 'rejectUnauthorized' | 'ereaderDevices'> & {
  port?: number | string | null
  secure?: boolean | number | string | null
  rejectUnauthorized?: boolean | number | string | null
  ereaderDevices?: EreaderDeviceObject[] | string | null
}

type DeviceUser = {
  id: string
  isAdminOrUp: boolean
  isUser: boolean
}

type EmailTransport = {
  host: string | null | undefined
  secure: boolean
  port?: number
  auth?: { user: string; pass: string | null }
  tls?: { rejectUnauthorized: false }
}

// REF: https://nodemailer.com/smtp/
class EmailSettings {
  declare id: string
  declare host: EmailSettingsData['host']
  declare port: EmailSettingsData['port']
  declare secure: boolean
  declare rejectUnauthorized: boolean
  declare user: EmailSettingsData['user']
  declare pass: EmailSettingsData['pass']
  declare testAddress: EmailSettingsData['testAddress']
  declare fromAddress: EmailSettingsData['fromAddress']
  declare ereaderDevices: EreaderDeviceObject[]

  constructor(settings: Partial<EmailSettingsData> | null = null) {
    this.id = 'email-settings'
    this.host = null
    this.port = 465
    this.secure = true
    this.rejectUnauthorized = true
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

  construct(settings: Partial<EmailSettingsData>) {
    this.host = settings.host
    this.port = settings.port
    this.secure = !!settings.secure
    this.rejectUnauthorized = !!settings.rejectUnauthorized
    this.user = settings.user
    this.pass = settings.pass
    this.testAddress = settings.testAddress
    this.fromAddress = settings.fromAddress
    this.ereaderDevices = settings.ereaderDevices?.map((d) => ({ ...d })) || []

    // rejectUnauthorized added after v2.10.1 - defaults to true
    if (settings.rejectUnauthorized === undefined) {
      this.rejectUnauthorized = true
    }
  }

  toJSON() {
    return {
      id: this.id,
      host: this.host,
      port: this.port,
      secure: this.secure,
      rejectUnauthorized: this.rejectUnauthorized,
      user: this.user,
      pass: this.pass,
      testAddress: this.testAddress,
      fromAddress: this.fromAddress,
      ereaderDevices: this.ereaderDevices.map((d) => ({ ...d }))
    }
  }

  update(payload: EmailSettingsUpdate | null | undefined) {
    if (!payload) return false

    if (payload.port !== undefined) {
      if (isNullOrNaN(payload.port)) payload.port = 465
      else payload.port = Number(payload.port)
    }
    if (payload.secure !== undefined) payload.secure = !!payload.secure
    if (payload.rejectUnauthorized !== undefined) payload.rejectUnauthorized = !!payload.rejectUnauthorized

    if (payload.ereaderDevices !== undefined && !Array.isArray(payload.ereaderDevices)) payload.ereaderDevices = undefined

    if (payload.ereaderDevices?.length) {
      // Validate ereader devices
      payload.ereaderDevices = payload.ereaderDevices
        .map((device) => {
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
        })
        .filter((d): d is EreaderDeviceObject => !!d)
    }

    let hasUpdates = false

    // Values are normalized above; copyValue also converts empty strings to null.
    const assignField = <Key extends keyof EmailSettingsData>(settings: EmailSettingsData, key: Key) => {
      settings[key] = copyValue(payload[key]) as EmailSettingsData[Key]
    }
    const json = this.toJSON()
    for (const field in json) {
      const key = field as keyof typeof json
      if (key === 'id') continue

      if (payload[key] !== undefined && !areEquivalent(payload[key], json[key])) {
        assignField(this, key)
        hasUpdates = true
      }
    }

    return hasUpdates
  }

  getTransportObject(): EmailTransport {
    const payload: EmailTransport = {
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
    // Allow self-signed certs (https://nodemailer.com/smtp/#3-allow-self-signed-certificates)
    if (!this.rejectUnauthorized) {
      payload.tls = {
        rejectUnauthorized: false
      }
    }

    return payload
  }

  /**
   *
   * @param {EreaderDeviceObject} device
   * @param {import('../../models/User')} user
   * @returns {boolean}
   */
  checkUserCanAccessDevice(device: EreaderDeviceObject, user: DeviceUser) {
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
   * @param {import('../../models/User')} user
   * @returns {EreaderDeviceObject[]}
   */
  getEReaderDevices(user: DeviceUser) {
    return this.ereaderDevices.filter((device) => this.checkUserCanAccessDevice(device, user))
  }

  /**
   * Get ereader device by name
   *
   * @param {string} deviceName
   * @returns {EreaderDeviceObject}
   */
  getEReaderDevice(deviceName: string) {
    return this.ereaderDevices.find((d) => d.name === deviceName)
  }
}
export = EmailSettings
