const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes } = require('sequelize')

const { up, down } = require('../../../server/migrations/v2.17.6-share-add-isdownloadable')

describe('Migration v2.17.6-share-add-isDownloadable', () => {
  let queryInterface, logger

  beforeEach(() => {
    queryInterface = {
      addColumn: sinon.stub().resolves(),
      removeColumn: sinon.stub().resolves(),
      tableExists: sinon.stub().resolves(true),
      describeTable: sinon.stub().resolves({ isDownloadable: undefined }),
      sequelize: {
        Sequelize: {
          DataTypes: {
            BOOLEAN: DataTypes.BOOLEAN
          }
        }
      }
    }

    logger = {
      info: sinon.stub(),
      error: sinon.stub()
    }
  })

  describe('up', () => {
    it('should add the isDownloadable column to mediaItemShares table', async () => {
      await up({ context: { queryInterface, logger } })

      expect(queryInterface.addColumn.calledOnce).to.be.true
      expect(
        queryInterface.addColumn.calledWith('mediaItemShares', 'isDownloadable', {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false
        })
      ).to.be.true

      expect(logger.info.calledWith('[2.17.6 migration] UPGRADE BEGIN: 2.17.6-share-add-isdownloadable')).to.be.true
      expect(logger.info.calledWith('[2.17.6 migration] Adding isDownloadable column to mediaItemShares table')).to.be.true
      expect(logger.info.calledWith('[2.17.6 migration] Added isDownloadable column to mediaItemShares table')).to.be.true
      expect(logger.info.calledWith('[2.17.6 migration] UPGRADE END: 2.17.6-share-add-isdownloadable')).to.be.true
    })
  })

  describe('down', () => {
    it('should remove the isDownloadable column from mediaItemShares table', async () => {
      queryInterface.describeTable.resolves({ isDownloadable: true })

      await down({ context: { queryInterface, logger } })

      expect(queryInterface.removeColumn.calledOnce).to.be.true
      expect(queryInterface.removeColumn.calledWith('mediaItemShares', 'isDownloadable')).to.be.true

      expect(logger.info.calledWith('[2.17.6 migration] DOWNGRADE BEGIN: 2.17.6-share-add-isdownloadable')).to.be.true
      expect(logger.info.calledWith('[2.17.6 migration] Removing isDownloadable column from mediaItemShares table')).to.be.true
      expect(logger.info.calledWith('[2.17.6 migration] Removed isDownloadable column from mediaItemShares table')).to.be.true
      expect(logger.info.calledWith('[2.17.6 migration] DOWNGRADE END: 2.17.6-share-add-isdownloadable')).to.be.true
    })
  })
})
