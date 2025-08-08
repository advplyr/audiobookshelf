const { DataTypes, Model } = require('sequelize')

class UserBookRating extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        userId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        bookId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        rating: {
          type: DataTypes.FLOAT,
          allowNull: false
        }
      },
      {
        sequelize,
        modelName: 'userBookRating',
        indexes: [
          {
            unique: true,
            fields: ['userId', 'bookId']
          }
        ]
      }
    )

    const { user, book } = sequelize.models

    user.hasMany(UserBookRating, {
      foreignKey: 'userId'
    })

    this.belongsTo(user, { foreignKey: 'userId' })

    book.hasMany(this, {
      foreignKey: 'bookId'
    })

    this.belongsTo(book, { foreignKey: 'bookId' })
  }
}

module.exports = UserBookRating
