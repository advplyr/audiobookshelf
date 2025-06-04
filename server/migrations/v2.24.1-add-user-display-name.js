const { DataTypes } = require('sequelize')

async function up({ context: { queryInterface, logger } }) {
  logger.info('[Migration] Adding displayName column to users table')

  await queryInterface.addColumn('users', 'displayName', {
    type: DataTypes.STRING,
    allowNull: true
  })

  logger.info('[Migration] Successfully added displayName column to users table')
}

async function down({ context: { queryInterface, logger } }) {
  logger.info('[Migration] Removing displayName column from users table')

  await queryInterface.removeColumn('users', 'displayName')

  logger.info('[Migration] Successfully removed displayName column from users table')
}

module.exports = { up, down } 