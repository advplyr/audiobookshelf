const { DataTypes } = require('sequelize')

module.exports = {
  up: async ({ context: queryInterface }) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.createTable(
        'userBookRatings',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          userId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          bookId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: 'books', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          rating: {
            type: DataTypes.FLOAT,
            allowNull: false
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
          }
        },
        { transaction }
      )
      await queryInterface.addConstraint('userBookRatings', {
        fields: ['userId', 'bookId'],
        type: 'unique',
        name: 'user_book_ratings_unique_constraint',
        transaction
      })
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable('userBookRatings')
  }
}
