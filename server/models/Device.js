const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Device extends Model { }

  Device.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    identifier: DataTypes.STRING,
    clientName: DataTypes.STRING, // e.g. Abs Web, Abs Android
    clientVersion: DataTypes.STRING,
    ipAddress: DataTypes.STRING,
    deviceName: DataTypes.STRING, // e.g. Windows 10 Chrome, Google Pixel 6, Apple iPhone 10,3
    deviceVersion: DataTypes.STRING // e.g. Browser version or Android SDK
  }, {
    sequelize,
    modelName: 'Device'
  })

  const { User } = sequelize.models

  User.hasMany(Device)
  Device.belongsTo(User)

  return Device
}