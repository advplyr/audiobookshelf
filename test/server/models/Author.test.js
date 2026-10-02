const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const Author = require('../../../server/models/Author')
const Library = require('../../../server/models/Library')

describe('Author model', () => {
  let sequelize

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })

    Library.init(sequelize)
    Author.init(sequelize)

    await sequelize.sync({ force: true })
    await Library.create({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Library',
      displayOrder: 1,
      mediaType: 'book'
    })
  })

  afterEach(async () => {
    sinon.restore()
    Database.sequelize = null
    await sequelize?.close()
  })

  describe('findOrCreateByNameAndLibrary', () => {
    it('returns an error when the normalized author name is empty', async () => {
      const result = await Author.findOrCreateByNameAndLibrary('   ', '00000000-0000-0000-0000-000000000001')

      expect(result.author).to.equal(null)
      expect(result.created).to.equal(false)
      expect(result.error).to.equal(undefined)

      const count = await Author.count()
      expect(count).to.equal(0)
    })
  })

  describe('Database.rebuildAuthorRows', () => {
    it('rebuilds stale derived author fields during initialization', async () => {
      const db = Database
      db.sequelize = sequelize

      await sequelize.getQueryInterface().bulkInsert('authors', [
        {
          id: '00000000-0000-0000-0000-000000000010',
          name: 'Gabriel García Márquez',
          lastFirst: 'wrong',
          searchName: 'wrong',
          libraryId: '00000000-0000-0000-0000-000000000001',
          createdAt: '2025-01-01 00:00:00.000 +00:00',
          updatedAt: '2025-01-01 00:00:00.000 +00:00'
        }
      ])

      await db.rebuildAuthorRows()

      const [authors] = await sequelize.query('SELECT name, lastFirst, searchName FROM authors')
      expect(authors).to.deep.equal([
        {
          name: 'Gabriel García Márquez',
          lastFirst: 'Márquez, Gabriel García',
          searchName: 'gabrielgarciamarquez'
        }
      ])
    })
  })
})
