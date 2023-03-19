const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Notification extends Model { }

  Notification.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    eventName: DataTypes.STRING,
    urls: DataTypes.JSON, // JSON array of urls
    titleTemplate: DataTypes.STRING(1000),
    bodyTemplate: DataTypes.TEXT,
    type: DataTypes.STRING,
    lastFiredAt: DataTypes.DATE,
    lastAttemptFailed: DataTypes.BOOLEAN,
    numConsecutiveFailedAttempts: DataTypes.INTEGER,
    numTimesFired: DataTypes.INTEGER,
    enabled: DataTypes.BOOLEAN,
    extraData: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'notification'
  })

  return Notification
}