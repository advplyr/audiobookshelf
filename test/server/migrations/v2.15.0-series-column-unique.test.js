const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('../../../server/migrations/v2.15.0-series-column-unique')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')
const { query } = require('express')
const { logger } = require('sequelize/lib/utils/logger')
const e = require('express')

describe('migration-v2.15.0-series-column-unique', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub
  let series1Id
  let series2Id
  let series3Id
  let series1Id_dup
  let series3Id_dup
  let series1Id_dup2
  let book1Id
  let book2Id
  let book3Id
  let book4Id
  let book5Id
  let book6Id
  let library1Id
  let library2Id
  let bookSeries1Id
  let bookSeries2Id
  let bookSeries3Id
  let bookSeries1Id_dup
  let bookSeries3Id_dup
  let bookSeries1Id_dup2

  beforeEach(() => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    beforeEach(async () => {
      await queryInterface.createTable('Series', {
        id: { type: Sequelize.UUID, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false },
        libraryId: { type: Sequelize.UUID, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      })
      // Create a table for BookSeries, with a unique constraint of bookId and seriesId
      await queryInterface.createTable(
        'BookSeries',
        {
          id: { type: Sequelize.UUID, primaryKey: true },
          sequence: { type: Sequelize.STRING, allowNull: true },
          bookId: { type: Sequelize.UUID, allowNull: false },
          seriesId: { type: Sequelize.UUID, allowNull: false }
        },
        { uniqueKeys: { book_series_unique: { fields: ['bookId', 'seriesId'] } } }
      )
      // Set UUIDs for the tests
      series1Id = 'fc086255-3fd2-4a95-8a28-840d9206501b'
      series2Id = '70f46ac2-ee48-4b3c-9822-933cc15c29bd'
      series3Id = '01cac008-142b-4e15-b0ff-cf7cc2c5b64e'
      series1Id_dup = 'ad0b3b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      series3Id_dup = '4b3b4b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      series1Id_dup2 = '0123456a-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      book1Id = '4a38b6e5-0ae4-4de4-b119-4e33891bd63f'
      book2Id = '8bc2e61d-47f6-42ef-a3f4-93cf2f1de82f'
      book3Id = 'ec9bbaaf-1e55-457f-b59c-bd2bd955a404'
      book4Id = '876f3b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      book5Id = '4e5b4b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      book6Id = 'abcda123-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      library1Id = '3a5a1c7c-a914-472e-88b0-b871ceae63e7'
      library2Id = 'fd6c324a-4f3a-4bb0-99d6-7a330e765e7e'
      bookSeries1Id = 'eca24687-2241-4ffa-a9b3-02a0ba03c763'
      bookSeries2Id = '56f56105-813b-4395-9689-fd04198e7d5d'
      bookSeries3Id = '404a1761-c710-4d86-9d78-68d9a9c0fb6b'
      bookSeries1Id_dup = '8bea3b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      bookSeries3Id_dup = '89656a3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
      bookSeries1Id_dup2 = '9bea3b3b-4b3b-4b3b-4b3b-4b3b4b3b4b3b'
    })
    afterEach(async () => {
      await queryInterface.dropTable('Series')
      await queryInterface.dropTable('BookSeries')
    })
    it('upgrade with no duplicate series', async () => {
      // Add some entries to the Series table using the UUID for the ids
      await queryInterface.bulkInsert('Series', [
        { id: series1Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(), updatedAt: new Date() },
        { id: series2Id, name: 'Series 2', libraryId: library2Id, createdAt: new Date(), updatedAt: new Date() },
        { id: series3Id, name: 'Series 3', libraryId: library1Id, createdAt: new Date(), updatedAt: new Date() }
      ])
      // Add some entries to the BookSeries table
      await queryInterface.bulkInsert('BookSeries', [
        { id: bookSeries1Id, sequence: '1', bookId: book1Id, seriesId: series1Id },
        { id: bookSeries2Id, bookId: book2Id, seriesId: series2Id },
        { id: bookSeries3Id, sequence: '1', bookId: book3Id, seriesId: series3Id }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(6)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.15.0 migration] Found 0 duplicate series'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.15.0 migration] Deduplication complete'))).to.be.true
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.15.0 migration] Added unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique '))).to.be.true
      // Validate rows in tables
      const series = await queryInterface.sequelize.query('SELECT "id", "name", "libraryId" FROM Series', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(series).to.have.length(3)
      expect(series).to.deep.include({ id: series1Id, name: 'Series 1', libraryId: library1Id })
      expect(series).to.deep.include({ id: series2Id, name: 'Series 2', libraryId: library2Id })
      expect(series).to.deep.include({ id: series3Id, name: 'Series 3', libraryId: library1Id })
      const bookSeries = await queryInterface.sequelize.query('SELECT "id", "sequence", "bookId", "seriesId" FROM BookSeries', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(bookSeries).to.have.length(3)
      expect(bookSeries).to.deep.include({ id: bookSeries1Id, sequence: '1', bookId: book1Id, seriesId: series1Id })
      expect(bookSeries).to.deep.include({ id: bookSeries2Id, sequence: null, bookId: book2Id, seriesId: series2Id })
      expect(bookSeries).to.deep.include({ id: bookSeries3Id, sequence: '1', bookId: book3Id, seriesId: series3Id })
    })
    it('upgrade with duplicate series and no sequence', async () => {
      // Add some entries to the Series table using the UUID for the ids
      await queryInterface.bulkInsert('Series', [
        { id: series1Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(7), updatedAt: new Date(7) },
        { id: series2Id, name: 'Series 2', libraryId: library2Id, createdAt: new Date(7), updatedAt: new Date(8) },
        { id: series3Id, name: 'Series 3', libraryId: library1Id, createdAt: new Date(7), updatedAt: new Date(9) },
        { id: series1Id_dup, name: 'Series 1', libraryId: library1Id, createdAt: new Date(0), updatedAt: new Date(0) },
        { id: series3Id_dup, name: 'Series 3', libraryId: library1Id, createdAt: new Date(0), updatedAt: new Date(0) },
        { id: series1Id_dup2, name: 'Series 1', libraryId: library1Id, createdAt: new Date(0), updatedAt: new Date(0) }
      ])
      // Add some entries to the BookSeries table
      await queryInterface.bulkInsert('BookSeries', [
        { id: bookSeries1Id, bookId: book1Id, seriesId: series1Id },
        { id: bookSeries2Id, bookId: book2Id, seriesId: series2Id },
        { id: bookSeries3Id, bookId: book3Id, seriesId: series3Id },
        { id: bookSeries1Id_dup, bookId: book4Id, seriesId: series1Id_dup },
        { id: bookSeries3Id_dup, bookId: book5Id, seriesId: series3Id_dup },
        { id: bookSeries1Id_dup2, bookId: book6Id, seriesId: series1Id_dup2 }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(8)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.15.0 migration] Found 2 duplicate series'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.15.0 migration] Deduplicating series "Series 1" in library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.15.0 migration] Deduplicating series "Series 3" in library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.15.0 migration] Deduplication complete'))).to.be.true
      expect(loggerInfoStub.getCall(6).calledWith(sinon.match('[2.15.0 migration] Added unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(7).calledWith(sinon.match('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique '))).to.be.true
      // Validate rows
      const series = await queryInterface.sequelize.query('SELECT "id", "name", "libraryId" FROM Series', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(series).to.have.length(3)
      expect(series).to.deep.include({ id: series1Id, name: 'Series 1', libraryId: library1Id })
      expect(series).to.deep.include({ id: series2Id, name: 'Series 2', libraryId: library2Id })
      expect(series).to.deep.include({ id: series3Id, name: 'Series 3', libraryId: library1Id })
      const bookSeries = await queryInterface.sequelize.query('SELECT "id", "bookId", "seriesId" FROM BookSeries', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(bookSeries).to.have.length(6)
      expect(bookSeries).to.deep.include({ id: bookSeries1Id, bookId: book1Id, seriesId: series1Id })
      expect(bookSeries).to.deep.include({ id: bookSeries2Id, bookId: book2Id, seriesId: series2Id })
      expect(bookSeries).to.deep.include({ id: bookSeries3Id, bookId: book3Id, seriesId: series3Id })
      expect(bookSeries).to.deep.include({ id: bookSeries1Id_dup, bookId: book4Id, seriesId: series1Id })
      expect(bookSeries).to.deep.include({ id: bookSeries3Id_dup, bookId: book5Id, seriesId: series3Id })
      expect(bookSeries).to.deep.include({ id: bookSeries1Id_dup2, bookId: book6Id, seriesId: series1Id })
    })
    it('upgrade with same series name in different libraries', async () => {
      // Add some entries to the Series table using the UUID for the ids
      await queryInterface.bulkInsert('Series', [
        { id: series1Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(), updatedAt: new Date() },
        { id: series2Id, name: 'Series 1', libraryId: library2Id, createdAt: new Date(), updatedAt: new Date() }
      ])
      // Add some entries to the BookSeries table
      await queryInterface.bulkInsert('BookSeries', [
        { id: bookSeries1Id, bookId: book1Id, seriesId: series1Id },
        { id: bookSeries2Id, bookId: book2Id, seriesId: series2Id }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(6)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.15.0 migration] Found 0 duplicate series'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.15.0 migration] Deduplication complete'))).to.be.true
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.15.0 migration] Added unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique '))).to.be.true
      // Validate rows
      const series = await queryInterface.sequelize.query('SELECT "id", "name", "libraryId" FROM Series', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(series).to.have.length(2)
      expect(series).to.deep.include({ id: series1Id, name: 'Series 1', libraryId: library1Id })
      expect(series).to.deep.include({ id: series2Id, name: 'Series 1', libraryId: library2Id })
      const bookSeries = await queryInterface.sequelize.query('SELECT "id", "bookId", "seriesId" FROM BookSeries', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(bookSeries).to.have.length(2)
      expect(bookSeries).to.deep.include({ id: bookSeries1Id, bookId: book1Id, seriesId: series1Id })
      expect(bookSeries).to.deep.include({ id: bookSeries2Id, bookId: book2Id, seriesId: series2Id })
    })
    it('upgrade with one book in two of the same series, both sequence are null', async () => {
      // Create two different series with the same name in the same library
      await queryInterface.bulkInsert('Series', [
        { id: series1Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(8), updatedAt: new Date(20) },
        { id: series2Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(5), updatedAt: new Date(10) }
      ])
      // Create a book that is in both series
      await queryInterface.bulkInsert('BookSeries', [
        { id: bookSeries1Id, bookId: book1Id, seriesId: series1Id },
        { id: bookSeries2Id, bookId: book1Id, seriesId: series2Id }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(9)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.15.0 migration] Found 1 duplicate series'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.15.0 migration] Deduplicating series "Series 1" in library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.15.0 migration] Deduplicating bookId 4a38b6e5-0ae4-4de4-b119-4e33891bd63f in series "Series 1" of library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.15.0 migration] Finished cleanup of bookId 4a38b6e5-0ae4-4de4-b119-4e33891bd63f in series "Series 1" of library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(6).calledWith(sinon.match('[2.15.0 migration] Deduplication complete'))).to.be.true
      expect(loggerInfoStub.getCall(7).calledWith(sinon.match('[2.15.0 migration] Added unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(8).calledWith(sinon.match('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique '))).to.be.true
      // validate rows
      const series = await queryInterface.sequelize.query('SELECT "id", "name", "libraryId" FROM Series', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(series).to.have.length(1)
      expect(series).to.deep.include({ id: series1Id, name: 'Series 1', libraryId: library1Id })
      const bookSeries = await queryInterface.sequelize.query('SELECT "id", "sequence", "bookId", "seriesId" FROM BookSeries', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(bookSeries).to.have.length(1)
      // Keep BookSeries 2 because it was edited last from cleaning up duplicate books
      expect(bookSeries).to.deep.include({ id: bookSeries2Id, sequence: null, bookId: book1Id, seriesId: series1Id })
    })
    it('upgrade with one book in two of the same series, one sequence is null', async () => {
      // Create two different series with the same name in the same library
      await queryInterface.bulkInsert('Series', [
        { id: series1Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(5), updatedAt: new Date(9) },
        { id: series2Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(5), updatedAt: new Date(7) }
      ])
      // Create a book that is in both series
      await queryInterface.bulkInsert('BookSeries', [
        { id: bookSeries1Id, sequence: '1', bookId: book1Id, seriesId: series1Id },
        { id: bookSeries2Id, bookId: book1Id, seriesId: series2Id }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(9)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.15.0 migration] Found 1 duplicate series'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.15.0 migration] Deduplicating series "Series 1" in library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.15.0 migration] Deduplicating bookId 4a38b6e5-0ae4-4de4-b119-4e33891bd63f in series "Series 1" of library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.15.0 migration] Finished cleanup of bookId 4a38b6e5-0ae4-4de4-b119-4e33891bd63f in series "Series 1" of library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(6).calledWith(sinon.match('[2.15.0 migration] Deduplication complete'))).to.be.true
      expect(loggerInfoStub.getCall(7).calledWith(sinon.match('[2.15.0 migration] Added unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(8).calledWith(sinon.match('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique '))).to.be.true
      // validate rows
      const series = await queryInterface.sequelize.query('SELECT "id", "name", "libraryId" FROM Series', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(series).to.have.length(1)
      expect(series).to.deep.include({ id: series1Id, name: 'Series 1', libraryId: library1Id })
      const bookSeries = await queryInterface.sequelize.query('SELECT "id", "sequence", "bookId", "seriesId" FROM BookSeries', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(bookSeries).to.have.length(1)
      expect(bookSeries).to.deep.include({ id: bookSeries1Id, sequence: '1', bookId: book1Id, seriesId: series1Id })
    })
    it('upgrade with one book in two of the same series, both sequence are not null', async () => {
      // Create two different series with the same name in the same library
      await queryInterface.bulkInsert('Series', [
        { id: series1Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(1), updatedAt: new Date(3) },
        { id: series2Id, name: 'Series 1', libraryId: library1Id, createdAt: new Date(2), updatedAt: new Date(2) }
      ])
      // Create a book that is in both series
      await queryInterface.bulkInsert('BookSeries', [
        { id: bookSeries1Id, sequence: '3', bookId: book1Id, seriesId: series1Id },
        { id: bookSeries2Id, sequence: '2', bookId: book1Id, seriesId: series2Id }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(9)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.15.0 migration] Found 1 duplicate series'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.15.0 migration] Deduplicating series "Series 1" in library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.15.0 migration] Deduplicating bookId 4a38b6e5-0ae4-4de4-b119-4e33891bd63f in series "Series 1" of library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.15.0 migration] Finished cleanup of bookId 4a38b6e5-0ae4-4de4-b119-4e33891bd63f in series "Series 1" of library 3a5a1c7c-a914-472e-88b0-b871ceae63e7'))).to.be.true
      expect(loggerInfoStub.getCall(6).calledWith(sinon.match('[2.15.0 migration] Deduplication complete'))).to.be.true
      expect(loggerInfoStub.getCall(7).calledWith(sinon.match('[2.15.0 migration] Added unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(8).calledWith(sinon.match('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique '))).to.be.true
      // validate rows
      const series = await queryInterface.sequelize.query('SELECT "id", "name", "libraryId" FROM Series', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(series).to.have.length(1)
      expect(series).to.deep.include({ id: series1Id, name: 'Series 1', libraryId: library1Id })
      const bookSeries = await queryInterface.sequelize.query('SELECT "id", "sequence", "bookId", "seriesId" FROM BookSeries', { type: queryInterface.sequelize.QueryTypes.SELECT })
      expect(bookSeries).to.have.length(1)
      // Keep BookSeries 2 because it is the lower sequence number
      expect(bookSeries).to.deep.include({ id: bookSeries2Id, sequence: '2', bookId: book1Id, seriesId: series1Id })
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await queryInterface.createTable('Series', {
        id: { type: Sequelize.UUID, primaryKey: true },
        name: { type: Sequelize.STRING, allowNull: false },
        libraryId: { type: Sequelize.UUID, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      })
      // Create a table for BookSeries, with a unique constraint of bookId and seriesId
      await queryInterface.createTable(
        'BookSeries',
        {
          id: { type: Sequelize.UUID, primaryKey: true },
          bookId: { type: Sequelize.UUID, allowNull: false },
          seriesId: { type: Sequelize.UUID, allowNull: false }
        },
        { uniqueKeys: { book_series_unique: { fields: ['bookId', 'seriesId'] } } }
      )
    })
    it('should not have unique constraint on series name and libraryId', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(9)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('[2.15.0 migration] Found 0 duplicate series'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('[2.15.0 migration] Deduplication complete'))).to.be.true
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('[2.15.0 migration] Added unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(6).calledWith(sinon.match('[2.15.0 migration] DOWNGRADE BEGIN: 2.15.0-series-column-unique '))).to.be.true
      expect(loggerInfoStub.getCall(7).calledWith(sinon.match('[2.15.0 migration] Removed unique index on Series.name and Series.libraryId'))).to.be.true
      expect(loggerInfoStub.getCall(8).calledWith(sinon.match('[2.15.0 migration] DOWNGRADE END: 2.15.0-series-column-unique '))).to.be.true
      // Ensure index does not exist
      const indexes = await queryInterface.showIndex('Series')
      expect(indexes).to.not.deep.include({ tableName: 'Series', unique: true, fields: ['name', 'libraryId'], name: 'unique_series_name_per_library' })
    })
  })
})
