import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import oldDevice from '../objects/DeviceInfo'

type DeviceAttributes = {
  id: string | null
  deviceId: string | null
  clientName: string | null
  clientVersion: string | null
  ipAddress: string | null
  deviceName: string | null
  deviceVersion: string | null
  extraData: DeviceExtraData
  userId?: string | null
  createdAt?: Date
  updatedAt?: Date
}

type DeviceCreation = Optional<DeviceAttributes, 'id' | 'deviceId' | 'clientName' | 'clientVersion' | 'ipAddress' | 'deviceName' | 'deviceVersion' | 'extraData' | 'userId' | 'createdAt' | 'updatedAt'>

type DeviceExtraData = {
  manufacturer?: string | null
  model?: string | null
  osName?: string | null
  osVersion?: string | null
  browserName?: string | null
}

type OldDeviceData = ReturnType<oldDevice['toJSON']>

class Device extends Model<DeviceAttributes, DeviceCreation> {
  declare id: string | null
  declare deviceId: string | null
  declare clientName: string | null
  declare clientVersion: string | null
  declare ipAddress: string | null
  declare deviceName: string | null
  declare deviceVersion: string | null
  declare extraData: DeviceExtraData
  declare userId: string | null
  declare createdAt: Date
  declare updatedAt: Date

  constructor(values?: DeviceCreation, options?: BuildOptions) {
    super(values, options)
  }

  static async getOldDeviceByDeviceId(deviceId: string) {
    const device = await this.findOne({
      where: {
        deviceId
      }
    })
    if (!device) return null
    return device.getOldDevice()
  }

  static createFromOld(oldDevice: OldDeviceData) {
    const device = this.getFromOld(oldDevice)
    return this.create(device)
  }

  static updateFromOld(oldDevice: OldDeviceData) {
    const device = this.getFromOld(oldDevice)
    return this.update(device, {
      where: {
        id: device.id
      }
    })
  }

  static getFromOld(oldDeviceInfo: OldDeviceData) {
    let extraData: DeviceExtraData = {}

    if (oldDeviceInfo.manufacturer) {
      extraData.manufacturer = oldDeviceInfo.manufacturer
    }
    if (oldDeviceInfo.model) {
      extraData.model = oldDeviceInfo.model
    }
    if (oldDeviceInfo.osName) {
      extraData.osName = oldDeviceInfo.osName
    }
    if (oldDeviceInfo.osVersion) {
      extraData.osVersion = oldDeviceInfo.osVersion
    }
    if (oldDeviceInfo.browserName) {
      extraData.browserName = oldDeviceInfo.browserName
    }

    return {
      id: oldDeviceInfo.id,
      deviceId: oldDeviceInfo.deviceId,
      clientName: oldDeviceInfo.clientName || null,
      clientVersion: oldDeviceInfo.clientVersion || null,
      ipAddress: oldDeviceInfo.ipAddress,
      deviceName: oldDeviceInfo.deviceName || null,
      deviceVersion: oldDeviceInfo.sdkVersion || oldDeviceInfo.browserVersion || null,
      userId: oldDeviceInfo.userId,
      extraData
    }
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  // Retain Sequelize's static signature for its polymorphic model methods.
  // Application code uses the single-argument initializer, as before migration.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS,
    attributes: ModelAttributes<M, Partial<Attributes<M>>>,
    options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels supplies a Sequelize instance; the other overload preserves
    // the inherited static contract required by Sequelize's generic query methods.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof Device, Device>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        deviceId: DataTypes.STRING,
        clientName: DataTypes.STRING, // e.g. Abs Web, Abs Android
        clientVersion: DataTypes.STRING, // e.g. Server version or mobile version
        ipAddress: DataTypes.STRING,
        deviceName: DataTypes.STRING, // e.g. Windows 10 Chrome, Google Pixel 6, Apple iPhone 10,3
        deviceVersion: DataTypes.STRING, // e.g. Browser version or Android SDK
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'device'
      }
    )

    const { user } = sequelize.models

    user.hasMany(Device, {
      onDelete: 'CASCADE'
    })
    Device.belongsTo(user)
  }

  toOldJSON() {
    let browserVersion = null
    let sdkVersion = null
    if (this.clientName === 'Abs Android') {
      sdkVersion = this.deviceVersion || null
    } else {
      browserVersion = this.deviceVersion || null
    }

    return {
      id: this.id,
      deviceId: this.deviceId,
      userId: this.userId,
      ipAddress: this.ipAddress,
      browserName: this.extraData.browserName || null,
      browserVersion,
      osName: this.extraData.osName || null,
      osVersion: this.extraData.osVersion || null,
      clientVersion: this.clientVersion || null,
      manufacturer: this.extraData.manufacturer || null,
      model: this.extraData.model || null,
      sdkVersion,
      deviceName: this.deviceName,
      clientName: this.clientName
    }
  }

  getOldDevice() {
    let browserVersion = null
    let sdkVersion = null
    if (this.clientName === 'Abs Android') {
      sdkVersion = this.deviceVersion || null
    } else {
      browserVersion = this.deviceVersion || null
    }

    return new oldDevice({
      id: this.id,
      deviceId: this.deviceId,
      userId: this.userId,
      ipAddress: this.ipAddress,
      browserName: this.extraData.browserName || null,
      browserVersion,
      osName: this.extraData.osName || null,
      osVersion: this.extraData.osVersion || null,
      clientVersion: this.clientVersion || null,
      manufacturer: this.extraData.manufacturer || null,
      model: this.extraData.model || null,
      sdkVersion,
      deviceName: this.deviceName,
      clientName: this.clientName
    })
  }
}

export = Device
