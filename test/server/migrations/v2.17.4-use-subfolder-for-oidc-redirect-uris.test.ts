import { expect } from 'chai'
import sinon from 'sinon'
import migration from '../../../server/migrations/v2.17.4-use-subfolder-for-oidc-redirect-uris'
import { Sequelize } from 'sequelize'
import Logger from '../../../server/Logger'
import type { MigrationContext } from '../../../server/types/migrations'

const { up, down } = migration

describe('Migration v2.17.4-use-subfolder-for-oidc-redirect-uris', () => {
  let sequelize: Sequelize
  let context: MigrationContext
  let queryInterface: { sequelize: sinon.SinonStubbedInstance<Sequelize> }
  let logger: sinon.SinonStubbedInstance<typeof Logger>

  beforeEach(() => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    const originalQueryInterface = sequelize.getQueryInterface()
    queryInterface = { sequelize: sinon.stub(sequelize) }
    logger = sinon.stub(Logger)
    context = { queryInterface: originalQueryInterface, logger: Logger }
  })

  afterEach(async () => {
    sinon.restore()
    await sequelize.close()
  })

  describe('up', () => {
    it('should add authOpenIDSubfolderForRedirectURLs if OIDC is enabled', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({ authActiveAuthMethods: ['openid'] }) }], {}])
      queryInterface.sequelize.query.onSecondCall().resolves()

      await up({ context })

      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] OIDC is enabled, adding authOpenIDSubfolderForRedirectURLs to server settings')).to.equal(true)
      expect(queryInterface.sequelize.query.calledTwice).to.equal(true)
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.equal(true)
      expect(
        queryInterface.sequelize.query.calledWith('UPDATE settings SET value = :value WHERE key = "server-settings";', {
          replacements: {
            value: JSON.stringify({ authActiveAuthMethods: ['openid'], authOpenIDSubfolderForRedirectURLs: '' })
          }
        })
      ).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.equal(true)
    })

    it('should not add authOpenIDSubfolderForRedirectURLs if OIDC is not enabled', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({ authActiveAuthMethods: [] }) }], {}])

      await up({ context })

      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] OIDC is not enabled, no action required')).to.equal(true)
      expect(queryInterface.sequelize.query.calledOnce).to.equal(true)
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] UPGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris')).to.equal(true)
    })

    it('should throw an error if server settings cannot be parsed', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: 'invalid json' }], {}])

      try {
        await up({ context })
      } catch (error) {
        expect(queryInterface.sequelize.query.calledOnce).to.equal(true)
        expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.equal(true)
        expect(logger.error.calledWith('[2.17.4 migration] Error parsing server settings:')).to.equal(true)
        expect(error).to.be.instanceOf(Error)
      }
    })

    it('should throw an error if server settings are not found', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[], {}])

      try {
        await up({ context })
      } catch (error) {
        expect(queryInterface.sequelize.query.calledOnce).to.equal(true)
        expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.equal(true)
        expect(logger.error.calledWith('[2.17.4 migration] Server settings not found')).to.equal(true)
        expect(error).to.be.instanceOf(Error)
      }
    })
  })

  describe('down', () => {
    it('should remove authOpenIDSubfolderForRedirectURLs if it exists', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({ authOpenIDSubfolderForRedirectURLs: '' }) }], {}])
      queryInterface.sequelize.query.onSecondCall().resolves()

      await down({ context })

      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] Removing authOpenIDSubfolderForRedirectURLs from server settings')).to.equal(true)
      expect(queryInterface.sequelize.query.calledTwice).to.equal(true)
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.equal(true)
      expect(
        queryInterface.sequelize.query.calledWith('UPDATE settings SET value = :value WHERE key = "server-settings";', {
          replacements: {
            value: JSON.stringify({})
          }
        })
      ).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.equal(true)
    })

    it('should not remove authOpenIDSubfolderForRedirectURLs if it does not exist', async () => {
      queryInterface.sequelize.query.onFirstCall().resolves([[{ value: JSON.stringify({}) }], {}])

      await down({ context })

      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] authOpenIDSubfolderForRedirectURLs not found in server settings, no action required')).to.equal(true)
      expect(queryInterface.sequelize.query.calledOnce).to.equal(true)
      expect(queryInterface.sequelize.query.calledWith('SELECT value FROM settings WHERE key = "server-settings";')).to.equal(true)
      expect(logger.info.calledWith('[2.17.4 migration] DOWNGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris ')).to.equal(true)
    })
  })
})
