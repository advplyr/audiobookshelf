'use strict'
module.exports = {
  up: async (qi, Sequelize) => {
    await qi.createTable('book_recommendations', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      bookId: { type: Sequelize.STRING, allowNull: false },
      recommenderUserId: { type: Sequelize.STRING, allowNull: false }, // string user id
      recipientUserId: { type: Sequelize.STRING, allowNull: true }, // string user id
      tagId: { type: Sequelize.INTEGER, allowNull: false },
      note: { type: Sequelize.TEXT, allowNull: true },
      visibility: { type: Sequelize.ENUM('public', 'recipient-only'), allowNull: false, defaultValue: 'public' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    })
    await qi.addIndex('book_recommendations', ['bookId', 'tagId'])
    await qi.addIndex('book_recommendations', ['recipientUserId'])
    await qi.addIndex('book_recommendations', ['recommenderUserId', 'createdAt'])
  },
  down: async (qi) => {
    await qi.dropTable('book_recommendations')
  }
}
