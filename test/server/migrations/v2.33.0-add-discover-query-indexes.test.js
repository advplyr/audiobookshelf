const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('../../../server/migrations/v2.33.0-add-discover-query-indexes')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('migration-v2.33.0-add-discover-query-indexes', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

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
      await queryInterface.createTable('mediaProgresses', {
        id: { type: Sequelize.UUID, primaryKey: true },
        userId: { type: Sequelize.UUID, allowNull: false },
        mediaItemId: { type: Sequelize.UUID, allowNull: false },
        isFinished: { type: Sequelize.BOOLEAN, allowNull: false },
        currentTime: { type: Sequelize.FLOAT, allowNull: false }
      })
      await queryInterface.createTable('bookSeries', {
        id: { type: Sequelize.UUID, primaryKey: true },
        seriesId: { type: Sequelize.UUID, allowNull: false },
        bookId: { type: Sequelize.UUID, allowNull: false }
      })
    })

    it('should add both discover query indexes', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const mediaProgressIndexes = await queryInterface.showIndex('mediaProgresses')
      expect(mediaProgressIndexes.some((i) => i.name === 'media_progresses_user_item_finished_time')).to.equal(true)
      const bookSeriesIndexes = await queryInterface.showIndex('bookSeries')
      expect(bookSeriesIndexes.some((i) => i.name === 'book_series_series_book')).to.equal(true)
    })

    it('should not fail when the indexes already exist', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWithMatch('index media_progresses_user_item_finished_time already exists')).to.equal(true)
      expect(loggerInfoStub.calledWithMatch('index book_series_series_book already exists')).to.equal(true)
    })

    it('should detect existing indexes on postgres via pg_indexes with folded table names', async () => {
      // Sequelize showIndex matches relname case-sensitively and misses folded
      // lowercase postgres tables, so the migration must query pg_indexes instead
      const queries = []
      const fakeQueryInterface = {
        sequelize: {
          getDialect: () => 'postgres',
          query: async (sql, options) => {
            queries.push({ sql, options })
            return [[{ name: 'media_progresses_user_item_finished_time' }, { name: 'book_series_series_book' }]]
          }
        },
        addIndex: async () => {
          throw new Error('addIndex must not be called for existing indexes')
        },
        showIndex: async () => {
          throw new Error('showIndex must not be used on postgres')
        }
      }

      await up({ context: { queryInterface: fakeQueryInterface, logger: Logger } })

      expect(queries.length).to.be.greaterThan(0)
      expect(queries.every((q) => q.sql.includes('pg_indexes'))).to.equal(true)
      expect(queries.map((q) => q.options.bind[0])).to.include.members(['mediaprogresses', 'bookseries'])
      expect(loggerInfoStub.calledWithMatch('index media_progresses_user_item_finished_time already exists')).to.equal(true)
      expect(loggerInfoStub.calledWithMatch('index book_series_series_book already exists')).to.equal(true)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await queryInterface.createTable('mediaProgresses', {
        id: { type: Sequelize.UUID, primaryKey: true },
        userId: { type: Sequelize.UUID, allowNull: false },
        mediaItemId: { type: Sequelize.UUID, allowNull: false },
        isFinished: { type: Sequelize.BOOLEAN, allowNull: false },
        currentTime: { type: Sequelize.FLOAT, allowNull: false }
      })
      await queryInterface.createTable('bookSeries', {
        id: { type: Sequelize.UUID, primaryKey: true },
        seriesId: { type: Sequelize.UUID, allowNull: false },
        bookId: { type: Sequelize.UUID, allowNull: false }
      })
      await up({ context: { queryInterface, logger: Logger } })
    })

    it('should remove both discover query indexes', async () => {
      await down({ context: { queryInterface, logger: Logger } })

      const mediaProgressIndexes = await queryInterface.showIndex('mediaProgresses')
      expect(mediaProgressIndexes.some((i) => i.name === 'media_progresses_user_item_finished_time')).to.equal(false)
      const bookSeriesIndexes = await queryInterface.showIndex('bookSeries')
      expect(bookSeriesIndexes.some((i) => i.name === 'book_series_series_book')).to.equal(false)
    })

    it('should not fail when the indexes do not exist', async () => {
      await down({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWithMatch('index media_progresses_user_item_finished_time does not exist')).to.equal(true)
    })
  })
})
