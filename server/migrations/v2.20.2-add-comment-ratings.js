const { DataTypes } = require('sequelize')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('comments', 'rating', {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('comments', 'rating')
  }
} 