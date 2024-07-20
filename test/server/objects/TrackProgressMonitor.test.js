const chai = require('chai')
const sinon = require('sinon')
const TrackProgressMonitor = require('../../../server/objects/TrackProgressMonitor')

const expect = chai.expect

describe('TrackProgressMonitor', () => {
  let trackDurations
  let trackStartedCallback
  let progressCallback
  let trackFinishedCallback
  let monitor

  beforeEach(() => {
    trackDurations = [10, 40, 50]
    trackStartedCallback = sinon.spy()
    progressCallback = sinon.spy()
    trackFinishedCallback = sinon.spy()
  })

  it('should initialize correctly', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)

    expect(monitor.trackDurations).to.deep.equal(trackDurations)
    expect(monitor.totalDuration).to.equal(100)
    expect(monitor.trackStartedCallback).to.equal(trackStartedCallback)
    expect(monitor.progressCallback).to.equal(progressCallback)
    expect(monitor.trackFinishedCallback).to.equal(trackFinishedCallback)
    expect(monitor.currentTrackIndex).to.equal(0)
    expect(monitor.cummulativeProgress).to.equal(0)
    expect(monitor.currentTrackPercentage).to.equal(10)
    expect(monitor.numTracks).to.equal(trackDurations.length)
    expect(monitor.allTracksFinished).to.be.false
  })

  it('should update the progress', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.update(5)

    expect(monitor.currentTrackIndex).to.equal(0)
    expect(monitor.cummulativeProgress).to.equal(0)
    expect(monitor.currentTrackPercentage).to.equal(10)
    expect(trackStartedCallback.calledOnceWithExactly(0)).to.be.true
    expect(progressCallback.calledOnceWithExactly(0, 50, 5)).to.be.true
    expect(trackFinishedCallback.notCalled).to.be.true
  })

  it('should update the progress multiple times on the same track', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.update(5)
    monitor.update(7)

    expect(monitor.currentTrackIndex).to.equal(0)
    expect(monitor.cummulativeProgress).to.equal(0)
    expect(monitor.currentTrackPercentage).to.equal(10)
    expect(trackStartedCallback.calledOnceWithExactly(0)).to.be.true
    expect(progressCallback.calledTwice).to.be.true
    expect(progressCallback.calledWithExactly(0, 50, 5)).to.be.true
    expect(progressCallback.calledWithExactly(0, 70, 7)).to.be.true
    expect(trackFinishedCallback.notCalled).to.be.true
  })

  it('should update the progress multiple times on different tracks', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.update(5)
    monitor.update(20)

    expect(monitor.currentTrackIndex).to.equal(1)
    expect(monitor.cummulativeProgress).to.equal(10)
    expect(monitor.currentTrackPercentage).to.equal(40)
    expect(trackStartedCallback.calledTwice).to.be.true
    expect(trackStartedCallback.calledWithExactly(0)).to.be.true
    expect(trackStartedCallback.calledWithExactly(1)).to.be.true
    expect(progressCallback.calledTwice).to.be.true
    expect(progressCallback.calledWithExactly(0, 50, 5)).to.be.true
    expect(progressCallback.calledWithExactly(1, 25, 20)).to.be.true
    expect(trackFinishedCallback.calledOnceWithExactly(0)).to.be.true
  })

  it('should finish all tracks', () => {
    monitor = new TrackProgressMonitor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback)
    monitor.finish()

    expect(monitor.allTracksFinished).to.be.true
    expect(trackStartedCallback.calledThrice).to.be.true
    expect(trackFinishedCallback.calledThrice).to.be.true
    expect(progressCallback.notCalled).to.be.true
    expect(trackStartedCallback.calledWithExactly(0)).to.be.true
    expect(trackFinishedCallback.calledWithExactly(0)).to.be.true
    expect(trackStartedCallback.calledWithExactly(1)).to.be.true
    expect(trackFinishedCallback.calledWithExactly(1)).to.be.true
    expect(trackStartedCallback.calledWithExactly(2)).to.be.true
    expect(trackFinishedCallback.calledWithExactly(2)).to.be.true
  })
})
