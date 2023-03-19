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
    modelName: 'userPermission'
  })

  const { user } = sequelize.models

  user.hasMany(UserPermission)
  UserPermission.belongsTo(user)

  return UserPermission
}