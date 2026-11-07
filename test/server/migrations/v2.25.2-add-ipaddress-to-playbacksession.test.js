const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes } = require('sequelize')

const { up, down } = require('../../../server/migrations/v2.25.2-add-ipaddress-to-playbacksession')

describe('Migration v2.25.2-add-ipaddress-to-playbacksession', () => {
  let queryInterface, logger

  beforeEach(() => {
    queryInterface = {
      addColumn: sinon.stub().resolves(),
      removeColumn: sinon.stub().resolves()
    }

    logger = {
      info: sinon.stub(),
      error: sinon.stub()
    }
  })

  describe('up', () => {
    it('should add the ipAddress column to playbackSessions table', async () => {
      await up(queryInterface, logger)

      expect(queryInterface.addColumn.calledOnce).to.be.true
      expect(
        queryInterface.addColumn.calledWith('playbackSessions', 'ipAddress', {
          type: DataTypes.STRING,
          allowNull: true
        })
      ).to.be.true
    })
  })

  describe('down', () => {
    it('should remove the ipAddress column from playbackSessions table', async () => {
      await down(queryInterface, logger)

      expect(queryInterface.removeColumn.calledOnce).to.be.true
      expect(queryInterface.removeColumn.calledWith('playbackSessions', 'ipAddress')).to.be.true
    })
  })
})
