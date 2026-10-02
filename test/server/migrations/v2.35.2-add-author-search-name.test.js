const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')
const Author = require('../../../server/models/Author')

const { up, down } = require('../../../server/migrations/v2.35.2-add-author-search-name')

describe('Migration v2.35.2-add-author-search-name', () => {
  let sequelize
  let queryInterface

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    sinon.stub(Logger, 'info')

    await queryInterface.createTable('authors', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      lastFirst: { type: DataTypes.STRING, allowNull: true },
      searchName: { type: DataTypes.STRING, allowNull: true },
      asin: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      libraryId: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: true }
    })

    await queryInterface.createTable('bookAuthors', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      bookId: { type: DataTypes.INTEGER, allowNull: false },
      authorId: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: true }
    })

    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      mediaId: { type: DataTypes.INTEGER, allowNull: false },
      mediaType: { type: DataTypes.STRING, allowNull: false },
      authorNamesFirstLast: { type: DataTypes.STRING, allowNull: true },
      authorNamesLastFirst: { type: DataTypes.STRING, allowNull: true }
    })

    await queryInterface.bulkInsert('authors', [
      { id: 1, name: 'J.R.R. Tolkein', lastFirst: 'Tolkein, J. R. R.', asin: null, description: null, libraryId: 1, createdAt: '2020-01-01T00:00:00.000Z' },
      { id: 2, name: 'JRR Tolkein', lastFirst: 'Tolkein, JRR', asin: 'ASIN-1', description: null, libraryId: 1, createdAt: '2021-01-01T00:00:00.000Z' },
      { id: 3, name: 'John Smith', lastFirst: 'Smith, John', asin: null, description: 'Author bio', libraryId: 1, createdAt: '2020-01-02T00:00:00.000Z' },
      { id: 4, name: 'John  Smith', lastFirst: 'Smith, John', asin: null, description: null, libraryId: 1, createdAt: '2019-01-01T00:00:00.000Z' },
      { id: 5, name: 'Anna Lee', lastFirst: 'Lee, Anna', asin: null, description: null, libraryId: 1, createdAt: '2022-01-01T00:00:00.000Z' },
      { id: 6, name: 'Anna-Lee', lastFirst: 'Lee, Anna', asin: null, description: null, libraryId: 1, createdAt: '2018-01-01T00:00:00.000Z' },
      { id: 7, name: 'JRR Tolkein', lastFirst: 'Tolkein, JRR', asin: null, description: null, libraryId: 2, createdAt: '2021-06-01T00:00:00.000Z' },
      { id: 8, name: 'Agatha Christie', lastFirst: 'Christie, Agatha', asin: null, description: null, libraryId: 2, createdAt: '2020-06-01T00:00:00.000Z' }
    ])

    await queryInterface.bulkInsert('bookAuthors', [
      { id: 1, bookId: 101, authorId: 1, createdAt: '2020-02-01T00:00:00.000Z' },
      { id: 2, bookId: 101, authorId: 2, createdAt: '2020-03-01T00:00:00.000Z' },
      { id: 3, bookId: 102, authorId: 3, createdAt: '2020-02-01T00:00:00.000Z' },
      { id: 4, bookId: 102, authorId: 4, createdAt: '2020-03-01T00:00:00.000Z' },
      { id: 5, bookId: 103, authorId: 5, createdAt: '2020-02-01T00:00:00.000Z' },
      { id: 6, bookId: 103, authorId: 6, createdAt: '2020-03-01T00:00:00.000Z' },
      { id: 7, bookId: 104, authorId: 7, createdAt: '2020-02-01T00:00:00.000Z' },
      { id: 8, bookId: 104, authorId: 8, createdAt: '2020-03-01T00:00:00.000Z' }
    ])

    await queryInterface.bulkInsert('libraryItems', [
      { id: 1, mediaId: 101, mediaType: 'book', authorNamesFirstLast: 'stale', authorNamesLastFirst: 'stale' },
      { id: 2, mediaId: 102, mediaType: 'book', authorNamesFirstLast: 'stale', authorNamesLastFirst: 'stale' },
      { id: 3, mediaId: 103, mediaType: 'book', authorNamesFirstLast: 'stale', authorNamesLastFirst: 'stale' },
      { id: 4, mediaId: 104, mediaType: 'book', authorNamesFirstLast: 'stale', authorNamesLastFirst: 'stale' }
    ])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should backfill searchName before adding indexes', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const authors = await queryInterface.sequelize.query('SELECT id, name, lastFirst, searchName, asin, description, libraryId FROM authors ORDER BY id ASC')
      expect(authors[0]).to.deep.equal([
        {
          id: 2,
          name: 'JRR Tolkein',
          lastFirst: null,
          searchName: 'jrrtolkein',
          asin: 'ASIN-1',
          description: null,
          libraryId: 1
        },
        {
          id: 3,
          name: 'John Smith',
          lastFirst: null,
          searchName: 'johnsmith',
          asin: null,
          description: 'Author bio',
          libraryId: 1
        },
        {
          id: 6,
          name: 'Anna-Lee',
          lastFirst: null,
          searchName: 'annalee',
          asin: null,
          description: null,
          libraryId: 1
        },
        {
          id: 7,
          name: 'JRR Tolkein',
          lastFirst: null,
          searchName: 'jrrtolkein',
          asin: null,
          description: null,
          libraryId: 2
        },
        {
          id: 8,
          name: 'Agatha Christie',
          lastFirst: null,
          searchName: 'agathachristie',
          asin: null,
          description: null,
          libraryId: 2
        }
      ])
    })

    it('should merge duplicate authors per library and remap bookAuthors', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const authors = await queryInterface.sequelize.query('SELECT id, name, lastFirst, searchName, asin, description, libraryId FROM authors ORDER BY id ASC')
      expect(authors[0]).to.deep.equal([
        {
          id: 2,
          name: 'JRR Tolkein',
          lastFirst: null,
          searchName: 'jrrtolkein',
          asin: 'ASIN-1',
          description: null,
          libraryId: 1
        },
        {
          id: 3,
          name: 'John Smith',
          lastFirst: null,
          searchName: 'johnsmith',
          asin: null,
          description: 'Author bio',
          libraryId: 1
        },
        {
          id: 6,
          name: 'Anna-Lee',
          lastFirst: null,
          searchName: 'annalee',
          asin: null,
          description: null,
          libraryId: 1
        },
        {
          id: 7,
          name: 'JRR Tolkein',
          lastFirst: null,
          searchName: 'jrrtolkein',
          asin: null,
          description: null,
          libraryId: 2
        },
        {
          id: 8,
          name: 'Agatha Christie',
          lastFirst: null,
          searchName: 'agathachristie',
          asin: null,
          description: null,
          libraryId: 2
        }
      ])

      const bookAuthors = await queryInterface.sequelize.query('SELECT bookId, authorId FROM bookAuthors ORDER BY bookId ASC, authorId ASC')
      expect(bookAuthors[0]).to.deep.equal([
        { bookId: 101, authorId: 2 },
        { bookId: 102, authorId: 3 },
        { bookId: 103, authorId: 6 },
        { bookId: 104, authorId: 7 },
        { bookId: 104, authorId: 8 }
      ])

      const libraryItems = await queryInterface.sequelize.query('SELECT mediaId, authorNamesFirstLast, authorNamesLastFirst FROM libraryItems ORDER BY mediaId ASC')
      expect(libraryItems[0]).to.deep.equal([
        { mediaId: 101, authorNamesFirstLast: 'JRR Tolkein', authorNamesLastFirst: null },
        { mediaId: 102, authorNamesFirstLast: 'John Smith', authorNamesLastFirst: null },
        { mediaId: 103, authorNamesFirstLast: 'Anna-Lee', authorNamesLastFirst: null },
        { mediaId: 104, authorNamesFirstLast: 'JRR Tolkein, Agatha Christie', authorNamesLastFirst: null }
      ])
    })

    it('should create indexes after the merge completes', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count: lastFirstCount }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='author_last_first'`)
      expect(lastFirstCount).to.equal(1)

      const [[{ count: searchNameCount }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='author_search_name'`)
      expect(searchNameCount).to.equal(1)

      const [[{ count: uniqueCount }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='unique_author_search_name_per_library'`)
      expect(uniqueCount).to.equal(1)

      const [[{ count: duplicateCount }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM authors WHERE libraryId = :libraryId AND searchName = :searchName`, {
        replacements: {
          libraryId: 1,
          searchName: Author.normalizeSearchName('JRR Tolkein')
        }
      })
      expect(Number(duplicateCount)).to.equal(1)
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('authors')
      expect(tableDescription.searchName).to.exist

      const [[{ count: uniqueCount }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='unique_author_search_name_per_library'`)
      expect(uniqueCount).to.equal(1)
    })
  })

  describe('down', () => {
    it('should remove searchName and its indexes', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('authors')
      expect(tableDescription.searchName).to.not.exist

      const [[{ count: searchNameCount }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='author_search_name'`)
      expect(searchNameCount).to.equal(0)

      const [[{ count: uniqueCount }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='unique_author_search_name_per_library'`)
      expect(uniqueCount).to.equal(0)
    })
  })
})
