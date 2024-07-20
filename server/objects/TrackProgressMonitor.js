class TrackProgressMonitor {
  /**
   * @callback TrackStartedCallback
   * @param {number} trackIndex - The index of the track that started.
   */

  /**
   * @callback ProgressCallback
   * @param {number} trackIndex - The index of the current track.
   * @param {number} progressInTrack - The current track progress in percent.
   * @param {number} totalProgress - The total progress in percent.
   */

  /**
   * @callback TrackFinishedCallback
   * @param {number} trackIndex - The index of the track that finished.
   */

  /**
   * Creates a new TrackProgressMonitor.
   * @constructor
   * @param {number[]} trackDurations - The durations of the tracks in seconds.
   * @param {TrackStartedCallback} trackStartedCallback - The callback to call when a track starts.
   * @param {ProgressCallback} progressCallback - The callback to call when progress is updated.
   * @param {TrackFinishedCallback} trackFinishedCallback - The callback to call when a track finishes.
   */
  constructor(trackDurations, trackStartedCallback, progressCallback, trackFinishedCallback) {
    this.trackDurations = trackDurations
    this.totalDuration = trackDurations.reduce((total, duration) => total + duration, 0)
    this.trackStartedCallback = trackStartedCallback
    this.progressCallback = progressCallback
    this.trackFinishedCallback = trackFinishedCallback
    this.currentTrackIndex = -1
    this.cummulativeProgress = 0
    this.currentTrackPercentage = 0
    this.numTracks = this.trackDurations.length
    this.allTracksFinished = false
    this.#moveToNextTrack()
  }

  #outsideCurrentTrack(progress) {
    this.currentTrackProgress = progress - this.cummulativeProgress
    return this.currentTrackProgress >= this.currentTrackPercentage
  }

  #moveToNextTrack() {
    if (this.currentTrackIndex >= 0) this.#trackFinished()
    this.currentTrackIndex++
    this.cummulativeProgress += this.currentTrackPercentage
    if (this.currentTrackIndex >= this.numTracks) {
      this.allTracksFinished = true
      return
    }
    this.currentTrackPercentage = (this.trackDurations[this.currentTrackIndex] / this.totalDuration) * 100
    this.#trackStarted()
  }

  #trackStarted() {
    this.trackStartedCallback(this.currentTrackIndex)
  }

  #progressUpdated(totalProgress) {
    const progressInTrack = (this.currentTrackProgress / this.currentTrackPercentage) * 100
    this.progressCallback(this.currentTrackIndex, progressInTrack, totalProgress)
  }

  #trackFinished() {
    this.trackFinishedCallback(this.currentTrackIndex)
  }

  /**
   * Updates the track progress based on the total progress.
   * @param {number} totalProgress - The total progress in percent.
   */
  update(totalProgress) {
    while (this.#outsideCurrentTrack(totalProgress) && !this.allTracksFinished) this.#moveToNextTrack()
    if (!this.allTracksFinished) this.#progressUpdated(totalProgress)
  }

  /**
   * Finish the track progress monitoring.
   * Forces all remaining tracks to finish.
   */
  finish() {
    this.update(101)
  }
}
module.exports = TrackProgressMonitor
