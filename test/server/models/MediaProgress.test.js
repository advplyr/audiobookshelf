const { expect } = require('chai')
const sinon = require('sinon')

const Logger = require('../../../server/Logger')
const MediaProgress = require('../../../server/models/MediaProgress')

function createProgressInstance() {
  const progress = Object.create(MediaProgress.prototype)

  Object.defineProperties(progress, {
    id: { value: 'progress-1', writable: true, configurable: true },
    mediaItemId: { value: 'media-1', writable: true, configurable: true },
    duration: { value: 3600, writable: true, configurable: true },
    currentTime: { value: 120, writable: true, configurable: true },
    isFinished: { value: false, writable: true, configurable: true },
    hideFromContinueListening: { value: false, writable: true, configurable: true },
    extraData: { value: {}, writable: true, configurable: true }
  })

  progress.changed = sinon.stub().returns(false)
  progress.set = sinon.stub().callsFake((payload) => Object.assign(progress, payload))
  progress.save = sinon.stub().resolves()
  progress.reload = sinon.stub().resolves()
  progress.constructor = {
    update: sinon.stub().resolves(),
    sequelize: {
      escape: (value) => `'${value.toISOString ? value.toISOString() : value}'`
    }
  }

  return progress
}

describe('MediaProgress', () => {
  afterEach(() => {
    sinon.restore()
  })

  describe('applyProgressUpdate', () => {
    it('should update updatedAt via model update for valid lastUpdate', async () => {
      const progress = createProgressInstance()
      const infoStub = sinon.stub(Logger, 'info')
      const lastUpdate = '2026-03-03T01:00:00.000Z'

      await progress.applyProgressUpdate({ currentTime: 130, lastUpdate })

      expect(progress.save.calledOnce).to.equal(true)
      expect(progress.constructor.update.calledOnce).to.equal(true)
      expect(progress.constructor.update.firstCall.args[0].updatedAt.toISOString()).to.equal(new Date(lastUpdate).toISOString())
      expect(progress.constructor.update.firstCall.args[1]).to.deep.equal({
        where: { id: 'progress-1' },
        silent: true
      })
      expect(progress.reload.calledOnce).to.equal(true)
      expect(infoStub.calledWithMatch('[MediaProgress] Manually setting updatedAt')).to.equal(true)
    })

    it('should skip manual updatedAt update when lastUpdate is invalid', async () => {
      const progress = createProgressInstance()
      const warnStub = sinon.stub(Logger, 'warn')

      await progress.applyProgressUpdate({ currentTime: 130, lastUpdate: 'invalid-date' })

      expect(progress.save.calledOnce).to.equal(true)
      expect(progress.constructor.update.called).to.equal(false)
      expect(progress.reload.called).to.equal(false)
      expect(warnStub.calledWithMatch('[MediaProgress] Invalid date provided for lastUpdate')).to.equal(true)
    })
  })
})
