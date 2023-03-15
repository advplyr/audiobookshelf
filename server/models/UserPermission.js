const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class UserPermission extends Model { }

  UserPermission.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: DataTypes.STRING,
    value: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'UserPermission'
  })

  const { User } = sequelize.models

  User.hasMany(UserPermission)
  UserPermission.belongsTo(User)

  return UserPermission
}