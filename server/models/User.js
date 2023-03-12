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
    isActive: DataTypes.BOOLEAN,
    isLocked: DataTypes.BOOLEAN,
    lastSeen: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'User'
  })

  return User
}