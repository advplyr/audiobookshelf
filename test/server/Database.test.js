const { expect } = require('chai')
const sinon = require('sinon')

const fs = require('../../server/libs/fsExtra')
const Database = require('../../server/Database')

describe('Database', () => {
  let originalDialect
  let originalSequelize
  let originalEnv

  beforeEach(() => {
    originalDialect = Database.dialect
    originalSequelize = Database.sequelize
    originalEnv = {
      DB_DIALECT: process.env.DB_DIALECT,
      DATABASE_URL: process.env.DATABASE_URL
    }
  })

  afterEach(() => {
    Database.dialect = originalDialect
    Database.sequelize = originalSequelize

    if (originalEnv.DB_DIALECT === undefined) delete process.env.DB_DIALECT
    else process.env.DB_DIALECT = originalEnv.DB_DIALECT

    if (originalEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalEnv.DATABASE_URL

    sinon.restore()
  })

  describe('getConfiguredDialect', () => {
    it('should default to sqlite when no env variables are set', () => {
      delete process.env.DB_DIALECT
      delete process.env.DATABASE_URL

      expect(Database.getConfiguredDialect()).to.equal('sqlite')
    })

    it('should use explicit DB_DIALECT value when valid', () => {
      process.env.DB_DIALECT = 'postgres'
      process.env.DATABASE_URL = 'sqlite:///tmp/abs.sqlite'

      expect(Database.getConfiguredDialect()).to.equal('postgres')
    })

    it('should infer postgres dialect from DATABASE_URL', () => {
      delete process.env.DB_DIALECT
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/abs'

      expect(Database.getConfiguredDialect()).to.equal('postgres')
    })

    it('should fallback to sqlite for unsupported DB_DIALECT', () => {
      process.env.DB_DIALECT = 'mysql'
      process.env.DATABASE_URL = 'sqlite:///tmp/abs.sqlite'

      expect(Database.getConfiguredDialect()).to.equal('sqlite')
    })
  })

  describe('checkHasDb', () => {
    it('should not check sqlite file existence in postgres mode', async () => {
      Database.dialect = 'postgres'
      const pathExistsStub = sinon.stub(fs, 'pathExists')

      const hasDb = await Database.checkHasDb()

      expect(hasDb).to.equal(true)
      expect(pathExistsStub.called).to.equal(false)
    })
  })

  describe('checkHasTables', () => {
    it('should return true when at least one table exists', async () => {
      Database.sequelize = {
        getQueryInterface: () => ({
          showAllTables: sinon.stub().resolves(['users'])
        })
      }

      const hasTables = await Database.checkHasTables()

      expect(hasTables).to.equal(true)
    })

    it('should return false when no tables exist', async () => {
      Database.sequelize = {
        getQueryInterface: () => ({
          showAllTables: sinon.stub().resolves([])
        })
      }

      const hasTables = await Database.checkHasTables()

      expect(hasTables).to.equal(false)
    })
  })

  describe('addPostgresTriggers', () => {
    function captureQueries(existingTriggers = []) {
      const queries = []
      Database.sequelize = {
        query: async (sql) => {
          queries.push(sql)
          const count = existingTriggers.filter((name) => sql.includes(`tgname = '${name}'`)).length
          return [[{ count }]]
        }
      }
      return queries
    }

    it('should create title and author names triggers with folded lowercase identifiers', async () => {
      const queries = captureQueries()

      await Database.addPostgresTriggers()

      const functions = queries.filter((sql) => sql.includes('CREATE OR REPLACE FUNCTION'))
      const triggers = queries.filter((sql) => sql.includes('CREATE TRIGGER'))
      expect(functions.length).to.equal(7)
      expect(triggers.length).to.equal(7)

      const allDdl = [...functions, ...triggers].join('\n')
      // No camelCase identifiers may leak into postgres DDL - unquoted identifiers fold to lowercase
      expect(allDdl).to.not.match(/libraryItems|bookAuthors|mediaId|titleIgnorePrefix|authorNames|bookId|authorId|lastFirst|createdAt/)

      const authorTrigger = triggers.find((sql) => sql.includes('update_library_items_author_names_on_authors_update'))
      expect(authorTrigger).to.include('AFTER UPDATE OF name ON authors')

      const insertFn = functions.find((sql) => sql.includes('update_library_items_author_names_on_book_authors_insert_fn'))
      expect(insertFn).to.include("string_agg(authors.name, ', ' ORDER BY bookauthors.createdat ASC)")
      expect(insertFn).to.include('WHERE mediaid = NEW.bookid')

      const deleteFn = functions.find((sql) => sql.includes('update_library_items_author_names_on_book_authors_delete_fn'))
      expect(deleteFn).to.include('WHERE mediaid = OLD.bookid')
    })

    it('should skip triggers that already exist', async () => {
      const queries = captureQueries(['update_library_items_title'])

      await Database.addPostgresTriggers()

      const titleFn = queries.find((sql) => sql.includes('update_library_items_title_fn'))
      expect(titleFn).to.equal(undefined)
      const otherFns = queries.filter((sql) => sql.includes('CREATE OR REPLACE FUNCTION'))
      expect(otherFns.length).to.equal(6)
    })

    it('should dispatch to postgres triggers from addTriggers', async () => {
      Database.dialect = 'postgres'
      const queries = captureQueries()

      await Database.addTriggers()

      expect(queries.some((sql) => sql.includes('CREATE TRIGGER'))).to.equal(true)
    })
  })
})
