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
})
