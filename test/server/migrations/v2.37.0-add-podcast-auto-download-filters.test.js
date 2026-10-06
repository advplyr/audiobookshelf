const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes } = require('sequelize')

const { up, down } = require('../../../server/migrations/v2.37.0-add-podcast-auto-download-filters')

describe('Migration v2.37.0-add-podcast-auto-download-filters', () => {
  let queryInterface, logger

  beforeEach(() => {
    queryInterface = {
      addColumn: sinon.stub().resolves(),
      removeColumn: sinon.stub().resolves(),
      tableExists: sinon.stub().resolves(true),
      describeTable: sinon.stub().resolves({}),
      sequelize: {
        Sequelize: {
          DataTypes: {
            INTEGER: DataTypes.INTEGER,
            JSON: DataTypes.JSON
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
    it('should add the auto-download filter columns to podcasts table', async () => {
      await up({ context: { queryInterface, logger } })

      expect(queryInterface.addColumn.calledTwice).to.be.true
      expect(queryInterface.addColumn.calledWith('podcasts', 'autoDownloadMinDuration', { type: DataTypes.INTEGER, allowNull: true })).to.be.true
      expect(queryInterface.addColumn.calledWith('podcasts', 'autoDownloadExcludeTerms', { type: DataTypes.JSON, allowNull: true })).to.be.true
      expect(logger.info.calledWith('[2.37.0 migration] UPGRADE END: 2.37.0-add-podcast-auto-download-filters')).to.be.true
    })

    it('should not add columns that already exist', async () => {
      queryInterface.describeTable.resolves({ autoDownloadMinDuration: {}, autoDownloadExcludeTerms: {} })

      await up({ context: { queryInterface, logger } })

      expect(queryInterface.addColumn.called).to.be.false
    })
  })

  describe('down', () => {
    it('should remove the auto-download filter columns from podcasts table', async () => {
      queryInterface.describeTable.resolves({ autoDownloadMinDuration: {}, autoDownloadExcludeTerms: {} })

      await down({ context: { queryInterface, logger } })

      expect(queryInterface.removeColumn.calledTwice).to.be.true
      expect(queryInterface.removeColumn.calledWith('podcasts', 'autoDownloadMinDuration')).to.be.true
      expect(queryInterface.removeColumn.calledWith('podcasts', 'autoDownloadExcludeTerms')).to.be.true
      expect(logger.info.calledWith('[2.37.0 migration] DOWNGRADE END: 2.37.0-add-podcast-auto-download-filters')).to.be.true
    })
  })
})
