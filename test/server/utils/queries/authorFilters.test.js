const chai = require('chai')
const { expect } = chai
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const Author = require('../../../../server/models/Author')
const Library = require('../../../../server/models/Library')
const authorFilters = require('../../../../server/utils/queries/authorFilters')

describe('authorFilters', () => {
  let sequelize

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })

    Library.init(sequelize)
    Author.init(sequelize)

    await sequelize.sync({ force: true })
    await sequelize.getQueryInterface().createTable('bookAuthors', {
      id: { type: Sequelize.DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      bookId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
      authorId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
      createdAt: { type: Sequelize.DataTypes.DATE, allowNull: true }
    })

    Database.sequelize = sequelize
    Database.authorModel = Author

    await Library.create({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Library',
      displayOrder: 1,
      mediaType: 'book'
    })

    await Author.bulkCreate([
      {
        id: '00000000-0000-0000-0000-000000000010',
        name: 'J.R.R. Tolkein',
        lastFirst: 'Tolkein, J. R. R.',
        searchName: 'jrrtolkein',
        libraryId: '00000000-0000-0000-0000-000000000001',
        createdAt: '2025-01-01 00:00:00.000 +00:00',
        updatedAt: '2025-01-01 00:00:00.000 +00:00'
      },
      {
        id: '00000000-0000-0000-0000-000000000011',
        name: 'Agatha Christie',
        lastFirst: 'Christie, Agatha',
        searchName: 'agathachristie',
        libraryId: '00000000-0000-0000-0000-000000000001',
        createdAt: '2025-01-01 00:00:00.000 +00:00',
        updatedAt: '2025-01-01 00:00:00.000 +00:00'
      }
    ])

    await sequelize.getQueryInterface().bulkInsert('bookAuthors', [
      {
        id: 1,
        bookId: 1,
        authorId: '00000000-0000-0000-0000-000000000010',
        createdAt: '2025-01-01 00:00:00.000 +00:00'
      },
      {
        id: 2,
        bookId: 2,
        authorId: '00000000-0000-0000-0000-000000000011',
        createdAt: '2025-01-01 00:00:00.000 +00:00'
      }
    ])
  })

  afterEach(async () => {
    await sequelize?.close()
  })

  it('matches authors by normalized searchName as well as display name', async () => {
    const query = await Database.createTextSearchQuery('jrr')
    const results = await authorFilters.search('00000000-0000-0000-0000-000000000001', query, 10, 0)

    expect(results).to.deep.equal([
      {
        id: '00000000-0000-0000-0000-000000000010',
        asin: null,
        name: 'J.R.R. Tolkein',
        description: null,
        imagePath: null,
        libraryId: '00000000-0000-0000-0000-000000000001',
        addedAt: 1735689600000,
        updatedAt: 1735689600000,
        numBooks: 1
      }
    ])
  })
})
