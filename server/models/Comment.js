const { Model, DataTypes } = require('sequelize')

class Comment extends Model {
  static init(sequelize) {
    return super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        text: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        rating: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: {
            min: 1,
            max: 5
          }
        },
        libraryItemId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'libraryItems',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      },
      {
        sequelize,
        modelName: 'comment',
        tableName: 'comments',
        timestamps: true
      }
    )
  }

  static associate(models) {
    Comment.belongsTo(models.user, {
      foreignKey: 'userId',
      as: 'user'
    })
    Comment.belongsTo(models.libraryItem, {
      foreignKey: 'libraryItemId',
      as: 'libraryItem'
    })
  }

  toJSON() {
    return {
      id: this.id,
      text: this.text,
      rating: this.rating,
      userId: this.userId,
      libraryItemId: this.libraryItemId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      user: this.user ? {
        id: this.user.id,
        username: this.user.username
      } : null
    }
  }
}

module.exports = Comment 