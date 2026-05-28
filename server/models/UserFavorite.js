const { DataTypes, Model } = require('sequelize')

class UserFavorite extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {UUIDV4} */
    this.libraryItemId
    /** @type {UUIDV4} */
    this.userId
  }

  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        libraryItemId: DataTypes.UUID,
        userId: DataTypes.UUID
      },
      {
        sequelize,
        modelName: 'userFavorite',
        indexes: [
          {
            fields: ['userId']
          },
          {
            fields: ['libraryItemId']
          },
          {
            unique: true,
            fields: ['libraryItemId', 'userId'],
          }
        ]
      }
    )

    const { libraryItem, user } = sequelize.models

    libraryItem.hasMany(UserFavorite, {
      foreignKey: 'libraryItemId',
      onDelete: 'CASCADE'
    })
    UserFavorite.belongsTo(libraryItem, { foreignKey: 'libraryItemId' })

    user.hasMany(UserFavorite, {
      foreignKey: 'userId',
      onDelete: 'CASCADE'
    })
    user.belongsToMany(libraryItem, {
      through: UserFavorite,
      foreignKey: 'userId',
      otherKey: 'libraryItemId',
      as: 'favorites'
    })
    UserFavorite.belongsTo(user, { foreignKey: 'userId' })
  }
}

module.exports = UserFavorite
