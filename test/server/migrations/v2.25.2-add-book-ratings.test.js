const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.25.2-add-book-ratings')

describe('Migration v2.25.2-add-book-ratings', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    await queryInterface.createTable('users', {
      id: { type: DataTypes.STRING, primaryKey: true, allowNull: false }
    })

    await queryInterface.createTable('books', {
      id: { type: DataTypes.STRING, primaryKey: true, allowNull: false }
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should add columns to books table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      const table = await queryInterface.describeTable('books')
      expect(table.providerRating).to.exist
      expect(table.provider).to.exist
      expect(table.providerId).to.exist
    })

    it('should create userBookRatings table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      const table = await queryInterface.describeTable('userBookRatings')
      expect(table.id).to.exist
      expect(table.userId).to.exist
      expect(table.bookId).to.exist
      expect(table.rating).to.exist
      expect(table.createdAt).to.exist
      expect(table.updatedAt).to.exist
    })

    it('should create userBookExplicitRatings table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      const table = await queryInterface.describeTable('userBookExplicitRatings')
      expect(table.id).to.exist
      expect(table.userId).to.exist
      expect(table.bookId).to.exist
      expect(table.rating).to.exist
      expect(table.createdAt).to.exist
      expect(table.updatedAt).to.exist
    })

    it('should add unique constraints', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      const constraints1 = await queryInterface.showConstraint('userBookRatings')
      expect(constraints1.some((c) => c.constraintName === 'user_book_ratings_unique_constraint')).to.be.true

      const constraints2 = await queryInterface.showConstraint('userBookExplicitRatings')
      expect(constraints2.some((c) => c.constraintName === 'user_book_explicit_ratings_unique_constraint')).to.be.true
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      const table = await queryInterface.describeTable('books')
      expect(table.providerRating).to.exist

      const table2 = await queryInterface.describeTable('userBookRatings')
      expect(table2.id).to.exist

      const table3 = await queryInterface.describeTable('userBookExplicitRatings')
      expect(table3.id).to.exist
    })
  })

  describe('down', () => {
    it('should remove columns from books table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const table = await queryInterface.describeTable('books')
      expect(table.providerRating).to.not.exist
      expect(table.provider).to.not.exist
      expect(table.providerId).to.not.exist
    })

    it('should drop userBookRatings table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })
      let error = null
      try {
        await queryInterface.describeTable('userBookRatings')
      } catch (e) {
        error = e
      }
      expect(error).to.not.be.null
    })

    it('should drop userBookExplicitRatings table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })
      let error = null
      try {
        await queryInterface.describeTable('userBookExplicitRatings')
      } catch (e) {
        error = e
      }
      expect(error).to.not.be.null
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const table = await queryInterface.describeTable('books')
      expect(table.providerRating).to.not.exist
    })
  })
})
