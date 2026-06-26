class TimeMapper {
  constructor(silenceRegions = [], compressionRatio = 1.0) {
    this.ratio = compressionRatio
    // Only keep regions >= 200ms
    this.regions = silenceRegions.filter(r => (r.end - r.start) >= 200)

    // Calculate compressed durations and cumulative time saved
    this.processedRegions = []
    let accumulatedSaved = 0

    for (const r of this.regions) {
      const originalDuration = r.end - r.start
      const compressedDuration = this.ratio === 0 ? 0 : originalDuration / this.ratio
      const saved = originalDuration - compressedDuration

      this.processedRegions.push({
        ...r,
        originalDuration,
        compressedDuration,
        saved,
        accumulatedSavedBefore: accumulatedSaved
      })

      accumulatedSaved += saved
    }

    this._totalTimeSaved = accumulatedSaved
  }

  wallClockToAudio(wallMs) {
    if (this.ratio === 1.0 || this.regions.length === 0) return wallMs

    let audioMs = wallMs

    for (const r of this.processedRegions) {
      // The start time of this region in wall-clock time
      const regionWallStart = r.start - r.accumulatedSavedBefore

      if (wallMs < regionWallStart) {
        // Before this region, no more accumulated saved to add
        break
      }

      const regionWallEnd = regionWallStart + r.compressedDuration

      if (wallMs <= regionWallEnd) {
        // Inside the compressed region
        const timeSpentInRegionWall = wallMs - regionWallStart
        const timeSpentInRegionAudio = timeSpentInRegionWall * this.ratio
        return r.start + timeSpentInRegionAudio
      }

      // After this region, we add the total time saved by this region
      audioMs = wallMs + (r.accumulatedSavedBefore + r.saved)
    }

    return audioMs
  }

  audioToWallClock(audioMs) {
    if (this.ratio === 1.0 || this.regions.length === 0) return audioMs

    let wallMs = audioMs

    for (const r of this.processedRegions) {
      if (audioMs < r.start) {
        break
      }

      if (audioMs <= r.end) {
        // Inside the region
        const timeSpentInRegionAudio = audioMs - r.start
        const timeSpentInRegionWall = timeSpentInRegionAudio / this.ratio
        return r.start - r.accumulatedSavedBefore + timeSpentInRegionWall
      }

      // After the region
      wallMs = audioMs - (r.accumulatedSavedBefore + r.saved)
    }

    return wallMs
  }

  totalTimeSaved() {
    return this._totalTimeSaved
  }
}

module.exports = TimeMapper
