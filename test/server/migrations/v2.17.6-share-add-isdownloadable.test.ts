import { expect } from 'chai'
import sinon from 'sinon'

import { DataTypes, Sequelize } from 'sequelize'
import Logger from '../../../server/Logger'
import type { QueryInterface } from 'sequelize'

import migration from '../../../server/migrations/v2.17.6-share-add-isdownloadable'

const { up, down } = migration

describe('Migration v2.17.6-share-add-isDownloadable', () => {
  let sequelize: Sequelize
  let queryInterface: sinon.SinonStubbedInstance<QueryInterface>
  let logger: sinon.SinonStubbedInstance<typeof Logger>

  beforeEach(() => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sinon.stub(sequelize.getQueryInterface())
    queryInterface.addColumn.resolves()
    queryInterface.removeColumn.resolves()
    queryInterface.tableExists.resolves(true)
    queryInterface.describeTable.resolves({})
    logger = sinon.stub(Logger)
  })

  afterEach(async () => {
    sinon.restore()
    await sequelize.close()
  })

  describe('up', () => {
    it('should add the isDownloadable column to mediaItemShares table', async () => {
      await up({ context: { queryInterface, logger } })

      expect(queryInterface.addColumn.calledOnce).to.equal(true)
      expect(
        queryInterface.addColumn.calledWith('mediaItemShares', 'isDownloadable', {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false
        })
      ).to.equal(true)

      expect(logger.info.calledWith('[2.17.6 migration] UPGRADE BEGIN: 2.17.6-share-add-isdownloadable')).to.equal(true)
      expect(logger.info.calledWith('[2.17.6 migration] Adding isDownloadable column to mediaItemShares table')).to.equal(true)
      expect(logger.info.calledWith('[2.17.6 migration] Added isDownloadable column to mediaItemShares table')).to.equal(true)
      expect(logger.info.calledWith('[2.17.6 migration] UPGRADE END: 2.17.6-share-add-isdownloadable')).to.equal(true)
    })
  })

  describe('down', () => {
    it('should remove the isDownloadable column from mediaItemShares table', async () => {
      queryInterface.describeTable.resolves({ isDownloadable: { type: 'BOOLEAN', allowNull: false, defaultValue: '0', primaryKey: false, autoIncrement: false, comment: '' } })

      await down({ context: { queryInterface, logger } })

      expect(queryInterface.removeColumn.calledOnce).to.equal(true)
      expect(queryInterface.removeColumn.calledWith('mediaItemShares', 'isDownloadable')).to.equal(true)

      expect(logger.info.calledWith('[2.17.6 migration] DOWNGRADE BEGIN: 2.17.6-share-add-isdownloadable')).to.equal(true)
      expect(logger.info.calledWith('[2.17.6 migration] Removing isDownloadable column from mediaItemShares table')).to.equal(true)
      expect(logger.info.calledWith('[2.17.6 migration] Removed isDownloadable column from mediaItemShares table')).to.equal(true)
      expect(logger.info.calledWith('[2.17.6 migration] DOWNGRADE END: 2.17.6-share-add-isdownloadable')).to.equal(true)
    })
  })
})
