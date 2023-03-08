const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class User extends Model { }

  User.init({
    username: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'User'
  })

  return User
}