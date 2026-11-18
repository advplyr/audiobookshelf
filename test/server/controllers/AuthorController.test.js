const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const AuthorController = require('../../../server/controllers/AuthorController')
const AuthorFinder = require('../../../server/finders/AuthorFinder')
const Logger = require('../../../server/Logger')

const unsafeDescription = '<p>Hello</p><script>alert(1)</script><img src="x" onerror="alert(document.domain)"><a href="https://example.com">link</a>'
const safeDescription = '<p>Hello</p><a href="https://example.com">link</a>'

describe('AuthorController', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
  })

  afterEach(async () => {
    sinon.restore()

    // Clear all tables
    await Database.sequelize.sync({ force: true })
  })

  /**
   * @param {string} [description]
   */
  async function createAuthor(description) {
    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    return Database.authorModel.create({
      name: 'Test Author',
      libraryId: library.id,
      description: description || null
    })
  }

  describe('update', () => {
    it('should store and return a sanitized description', async () => {
      const author = await createAuthor()
      const fakeReq = {
        body: {
          description: unsafeDescription
        },
        author
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await AuthorController.update(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]
      expect(response.updated).to.be.true
      expect(response.author.description).to.equal(safeDescription)
      expect(response.author.description).to.not.include('script')
      expect(response.author.description).to.not.include('onerror')

      const stored = await Database.authorModel.findByPk(author.id)
      expect(stored.description).to.equal(safeDescription)
    })

    it('should store null when sanitizing leaves an empty description', async () => {
      const author = await createAuthor('<p>Existing</p>')
      const fakeReq = {
        body: {
          description: '<script>alert(1)</script><img src="x" onerror="alert(1)">'
        },
        author
      }
      const fakeRes = {
        json: sinon.spy()
      }

      await AuthorController.update(fakeReq, fakeRes)

      const response = fakeRes.json.firstCall.args[0]
      expect(response.author.description).to.equal(null)

      const stored = await Database.authorModel.findByPk(author.id)
      expect(stored.description).to.equal(null)
    })
  })

  describe('toOldJSON', () => {
    it('should sanitize a stored description without rewriting the row', async () => {
      const author = await createAuthor(unsafeDescription)

      expect(author.toOldJSON().description).to.equal(safeDescription)
      expect(author.description).to.equal(unsafeDescription)

      const stored = await Database.authorModel.findByPk(author.id)
      expect(stored.description).to.equal(unsafeDescription)
      expect(stored.toOldJSON().description).to.equal(safeDescription)
    })
  })

  describe('match', () => {
    it('should store the sanitized Audnexus description', async () => {
      const author = await createAuthor()
      sinon.stub(AuthorFinder, 'findAuthorByASIN').resolves({
        asin: 'B00TEST000',
        name: 'Test Author',
        description: '<p>Bio</p><script>alert(1)</script>',
        image: null
      })

      const fakeReq = {
        body: {
          asin: 'B00TEST000'
        },
        author
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await AuthorController.match(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]
      expect(response.updated).to.be.true
      expect(response.author.description).to.equal('<p>Bio</p>')

      const stored = await Database.authorModel.findByPk(author.id)
      expect(stored.description).to.equal('<p>Bio</p>')
    })
  })
})
