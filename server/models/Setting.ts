import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

import oldEmailSettings from '../objects/settings/EmailSettings'
import oldServerSettings from '../objects/settings/ServerSettings'
import oldNotificationSettings from '../objects/settings/NotificationSettings'

// Stored rows share the legacy settings envelope; older rows may omit fields.
type SettingValue = NonNullable<ConstructorParameters<typeof oldEmailSettings>[0]> &
  NonNullable<ConstructorParameters<typeof oldServerSettings>[0]> &
  NonNullable<ConstructorParameters<typeof oldNotificationSettings>[0]> & { id?: string }

type SettingAttributes = {
  key: string
  value: SettingValue
  createdAt?: Date
  updatedAt?: Date
}

type SettingCreation = Optional<SettingAttributes, 'createdAt' | 'updatedAt'>

class Setting extends Model<SettingAttributes, SettingCreation> {
  declare key: string
  declare value: SettingValue
  declare createdAt: Date
  declare updatedAt: Date

  constructor(values?: SettingCreation, options?: BuildOptions) {
    super(values, options)
  }

  static async getOldSettings() {
    const settings = (await this.findAll()).map((se) => se.value)

    const emailSettingsJson = settings.find((se) => se.id === 'email-settings')
    const serverSettingsJson = settings.find((se) => se.id === 'server-settings')
    const notificationSettingsJson = settings.find((se) => se.id === 'notification-settings')

    return {
      settings,
      emailSettings: new oldEmailSettings(emailSettingsJson),
      serverSettings: new oldServerSettings(serverSettingsJson),
      notificationSettings: new oldNotificationSettings(notificationSettingsJson)
    }
  }

  static updateSettingObj(setting: SettingValue & { id: string }) {
    return this.upsert({
      key: setting.id,
      value: setting
    })
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
    super.init<typeof Setting, Setting>(
      {
        key: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        value: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'setting'
      }
    )
  }
}

export = Setting
