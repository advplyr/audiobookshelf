const { DataTypes } = require('sequelize')

const migrationName = 'v2.25.2-add-book-ratings'
const loggerPrefix = `[${migrationName} migration]`

module.exports = {
  up: async ({ context: { queryInterface, logger } }) => {
    logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)
    const transaction = await queryInterface.sequelize.transaction()
    try {
      const booksTable = await queryInterface.describeTable('books')
      logger.info(`${loggerPrefix} adding columns to books table`)
      if (!booksTable.providerRating) {
        await queryInterface.addColumn(
          'books',
          'providerRating',
          {
            type: DataTypes.FLOAT
          },
          { transaction }
        )
      }
      if (!booksTable.provider) {
        await queryInterface.addColumn(
          'books',
          'provider',
          {
            type: DataTypes.STRING
          },
          { transaction }
        )
      }
      if (!booksTable.providerId) {
        await queryInterface.addColumn(
          'books',
          'providerId',
          {
            type: DataTypes.STRING
          },
          { transaction }
        )
      }
      logger.info(`${loggerPrefix} added columns to books table`)

      const tables = await queryInterface.showAllTables()

      if (!tables.includes('userBookRatings')) {
        logger.info(`${loggerPrefix} creating userBookRatings table`)
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
        logger.info(`${loggerPrefix} created userBookRatings table`)
      }

      if (!tables.includes('userBookExplicitRatings')) {
        logger.info(`${loggerPrefix} creating userBookExplicitRatings table`)
        await queryInterface.createTable(
          'userBookExplicitRatings',
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
        await queryInterface.addConstraint('userBookExplicitRatings', {
          fields: ['userId', 'bookId'],
          type: 'unique',
          name: 'user_book_explicit_ratings_unique_constraint',
          transaction
        })
        logger.info(`${loggerPrefix} created userBookExplicitRatings table`)
      }

      await transaction.commit()
      logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
    } catch (err) {
      await transaction.rollback()
      logger.error(`${loggerPrefix} UPGRADE FAILED: ${migrationName}`, { error: err })
      throw err
    }
  },
  down: async ({ context: { queryInterface, logger } }) => {
    logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)
    const transaction = await queryInterface.sequelize.transaction()
    try {
      logger.info(`${loggerPrefix} removing columns from books table`)
      await queryInterface.removeColumn('books', 'providerRating', { transaction })
      await queryInterface.removeColumn('books', 'provider', { transaction })
      await queryInterface.removeColumn('books', 'providerId', { transaction })
      logger.info(`${loggerPrefix} removed columns from books table`)
      logger.info(`${loggerPrefix} dropping userBookRatings table`)
      await queryInterface.dropTable('userBookRatings', { transaction })
      logger.info(`${loggerPrefix} dropped userBookRatings table`)
      logger.info(`${loggerPrefix} dropping userBookExplicitRatings table`)
      await queryInterface.dropTable('userBookExplicitRatings', { transaction })
      logger.info(`${loggerPrefix} dropped userBookExplicitRatings table`)
      await transaction.commit()
      logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
    } catch (err) {
      await transaction.rollback()
      logger.error(`${loggerPrefix} DOWNGRADE FAILED: ${migrationName}`, { error: err })
      throw err
    }
  }
}
