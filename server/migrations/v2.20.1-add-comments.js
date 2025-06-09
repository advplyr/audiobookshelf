const { DataTypes } = require('sequelize')

async function up({ context: { queryInterface, logger } }) {
  logger.info('[2.20.1 migration] Creating comments table')
  
  await queryInterface.createTable('comments', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
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
  })

  // Add indexes for faster lookups
  await queryInterface.addIndex('comments', ['libraryItemId'])
  await queryInterface.addIndex('comments', ['userId'])
  
  logger.info('[2.20.1 migration] Comments table created successfully')
}

async function down({ context: { queryInterface, logger } }) {
  logger.info('[2.20.1 migration] Dropping comments table')
  await queryInterface.dropTable('comments')
  logger.info('[2.20.1 migration] Comments table dropped successfully')
}

module.exports = { up, down } 