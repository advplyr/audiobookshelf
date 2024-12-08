const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes } = require('sequelize')

const { up, down } = require('../../../server/migrations/v2.17.3-share-add-isdownloadable')

describe('Migration v2.17.3-share-add-isDownloadable', () => {
  let queryInterface

  beforeEach(() => {
    queryInterface = {
      addColumn: sinon.stub().resolves(),
      removeColumn: sinon.stub().resolves()
    }
  })

  describe('up', () => {
    it('should add the isDownloadable column to mediaItemShares table', async () => {
      await up({ context: { queryInterface } })

      expect(queryInterface.addColumn.calledOnce).to.be.true
      expect(
        queryInterface.addColumn.calledWith('mediaItemShares', 'isDownloadable', {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false
        })
      ).to.be.true
    })
  })

  describe('down', () => {
    it('should remove the isDownloadable column from mediaItemShares table', async () => {
      await down({ context: { queryInterface } })

      expect(queryInterface.removeColumn.calledOnce).to.be.true
      expect(queryInterface.removeColumn.calledWith('mediaItemShares', 'isDownloadable')).to.be.true
    })
  })
})
