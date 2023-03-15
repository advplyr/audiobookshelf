const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class User extends Model { }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: DataTypes.STRING,
    email: DataTypes.STRING,
    pash: DataTypes.STRING,
    type: DataTypes.STRING,
    token: DataTypes.STRING,
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isLocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    lastSeen: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'User'
  })

  return User
}