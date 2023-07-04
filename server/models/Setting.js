const { DataTypes, Model } = require('sequelize')

const oldEmailSettings = require('../objects/settings/EmailSettings')
const oldServerSettings = require('../objects/settings/ServerSettings')
const oldNotificationSettings = require('../objects/settings/NotificationSettings')

module.exports = (sequelize) => {
  class Setting extends Model {
    static async getOldSettings() {
      const settings = (await this.findAll()).map(se => se.value)


      const emailSettingsJson = settings.find(se => se.id === 'email-settings')
      const serverSettingsJson = settings.find(se => se.id === 'server-settings')
      const notificationSettingsJson = settings.find(se => se.id === 'notification-settings')

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
  }

  Setting.init({
    key: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    value: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'setting'
  })

  return Setting
}