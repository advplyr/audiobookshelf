const { DataTypes, Model } = require('sequelize')

const oldEmailSettings = require('../objects/settings/EmailSettings')
const oldServerSettings = require('../objects/settings/ServerSettings')
const oldNotificationSettings = require('../objects/settings/NotificationSettings')

class Setting extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.key
    /** @type {Object} */
    this.value
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
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

  static updateSettingObj(setting) {
    return this.upsert({
      key: setting.id,
      value: setting
    })
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
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

module.exports = Setting
