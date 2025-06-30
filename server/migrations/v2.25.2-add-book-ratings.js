const { DataTypes } = require('sequelize')

module.exports = {
  up: async ({ context: queryInterface }) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.addColumn(
        'books',
        'providerRating',
        {
          type: DataTypes.FLOAT
        },
        { transaction }
      )
      await queryInterface.addColumn(
        'books',
        'provider',
        {
          type: DataTypes.STRING
        },
        { transaction }
      )
      await queryInterface.addColumn(
        'books',
        'providerId',
        {
          type: DataTypes.STRING
        },
        { transaction }
      )
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  },
  down: async ({ context: queryInterface }) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.removeColumn('books', 'providerRating', { transaction })
      await queryInterface.removeColumn('books', 'provider', { transaction })
      await queryInterface.removeColumn('books', 'providerId', { transaction })
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  }
}
