const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('../../../server/migrations/v2.17.4-use-subfolder-for-oidc-redirect-uris')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('Migration v2.17.4-use-subfolder-for-oidc-redirect-uris', () => {
  let queryInterface, logger, context

  beforeEach(() => {
    queryInterface = {
      sequelize: {
        query: sinon.stub()
      }
    }
    logger = {
      info: sinon.stub(),
      error: sinon.stub()
    }
    context = { queryInterface, logger }
  })

  describe('up', () => {
    it('should add authOpenIDSubfolderForRedirectURLs if OIDC is enabled', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({ authActiveAuthMethods: ['openid'] }) }]])
      queryInterface.sequelize.query.onSecondCall().resolves()

      await up({ context })

      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] OIDC is enabled, adding authOpenIDSubfolderForRedirectURLs to server settings')).to.be.true
      expect(queryInterface.sequelize.query.calledTwice).to.be.true
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.be.true
      expect(
        queryInterface.sequelize.query.calledWith('UPDATE settings SET value = :value WHERE key = "server-settings";', {
          replacements: {
            value: JSON.stringify({ authActiveAuthMethods: ['openid'], authOpenIDSubfolderForRedirectURLs: '' })
          }
        })
      ).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.be.true
    })

    it('should not add authOpenIDSubfolderForRedirectURLs if OIDC is not enabled', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({ authActiveAuthMethods: [] }) }]])

      await up({ context })

      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] OIDC is not enabled, no action required')).to.be.true
      expect(queryInterface.sequelize.query.calledOnce).to.be.true
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.be.true
    })

    it('should throw an error if server settings cannot be parsed', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: 'invalid json' }]])

      try {
        await up({ context })
      } catch (error) {
        expect(queryInterface.sequelize.query.calledOnce).to.be.true
        expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.be.true
        expect(logger.error.calledWith('[2.17.4 migration] Error parsing server settings:')).to.be.true
        expect(error).to.be.instanceOf(Error)
      }
    })

    it('should throw an error if server settings are not found', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[]])

      try {
        await up({ context })
      } catch (error) {
        expect(queryInterface.sequelize.query.calledOnce).to.be.true
        expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.be.true
        expect(logger.error.calledWith('[2.17.4 migration] Server settings not found')).to.be.true
        expect(error).to.be.instanceOf(Error)
      }
    })
  })

  describe('down', () => {
    it('should remove authOpenIDSubfolderForRedirectURLs if it exists', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({ authOpenIDSubfolderForRedirectURLs: '' }) }]])
      queryInterface.sequelize.query.onSecondCall().resolves()

      await down({ context })

      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] Removing authOpenIDSubfolderForRedirectURLs from server settings')).to.be.true
      expect(queryInterface.sequelize.query.calledTwice).to.be.true
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.be.true
      expect(
        queryInterface.sequelize.query.calledWith('UPDATE settings SET value = :value WHERE key = "server-settings";', {
          replacements: {
            value: JSON.stringify({})
          }
        })
      ).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.be.true
    })

    it('should not remove authOpenIDSubfolderForRedirectURLs if it does not exist', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({}) }]])

      await down({ context })

      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] authOpenIDSubfolderForRedirectURLs not found in server settings, no action required')).to.be.true
      expect(queryInterface.sequelize.query.calledOnce).to.be.true
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.be.true
      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.be.true
    })
  })
})
