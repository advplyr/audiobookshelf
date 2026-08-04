const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('Book', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  describe('updateDuration', () => {
    it('sums only the included (non-excluded) audio files', () => {
      const book = Database.bookModel.build({
        title: 'Test Book',
        duration: 0,
        audioFiles: [
          { ino: '1', duration: 100, exclude: false },
          { ino: '2', duration: 50, exclude: true },
          { ino: '3', duration: 25, exclude: false }
        ]
      })

      const changed = book.updateDuration()

      expect(book.duration).to.equal(125) // 100 + 25, the excluded 50 is ignored
      expect(changed).to.be.true
    })

    it('returns false and leaves duration unchanged when already correct', () => {
      const book = Database.bookModel.build({
        title: 'Test Book',
        duration: 100,
        audioFiles: [{ ino: '1', duration: 100, exclude: false }]
      })

      expect(book.updateDuration()).to.be.false
      expect(book.duration).to.equal(100)
    })

    it('ignores audio files with a non-numeric duration', () => {
      const book = Database.bookModel.build({
        title: 'Test Book',
        duration: 0,
        audioFiles: [
          { ino: '1', duration: 100, exclude: false },
          { ino: '2', duration: NaN, exclude: false }
        ]
      })

      book.updateDuration()

      expect(book.duration).to.equal(100)
    })
  })
})
