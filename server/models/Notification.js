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
    urls: DataTypes.TEXT, // JSON array of urls
    titleTemplate: DataTypes.STRING(1000),
    bodyTemplate: DataTypes.TEXT,
    type: DataTypes.STRING,
    lastFiredAt: DataTypes.DATE,
    lastAttemptFailed: DataTypes.BOOLEAN,
    numConsecutiveFailedAttempts: DataTypes.INTEGER,
    numTimesFired: DataTypes.INTEGER,
    enabled: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Notification'
  })

  const { Library } = sequelize.models

  Library.hasMany(Notification)
  Notification.belongsTo(Library)

  return Notification
}