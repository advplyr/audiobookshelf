class SilenceMap {
  constructor() {
    this._regions = []
  }

  get regionCount() {
    return this._regions.length
  }

  getRegions() {
    return [...this._regions]
  }

  addRegion(startMs, endMs) {
    if (typeof startMs !== 'number' || typeof endMs !== 'number') return
    if (startMs < 0 || endMs < 0) return
    if (endMs <= startMs) return

    const newRegion = { start: startMs, end: endMs }
    const merged = []
    let inserted = false

    for (const region of this._regions) {
      if (newRegion.start <= region.end + 10 && newRegion.end >= region.start - 10) {
        newRegion.start = Math.min(newRegion.start, region.start)
        newRegion.end = Math.max(newRegion.end, region.end)
      } else if (!inserted && region.start > newRegion.end) {
        merged.push(newRegion)
        merged.push(region)
        inserted = true
      } else {
        merged.push(region)
      }
    }

    if (!inserted) {
      merged.push(newRegion)
    }

    this._regions = merged

    // Cap the number of regions to prevent memory leaks for long audiobooks
    // Assuming each region is ~1 second, 5000 regions is over an hour of silence
    if (this._regions.length > 5000) {
      this._regions = this._regions.slice(-5000)
    }
  }

  getCompressedOffset(atTimeMs, ratio) {
    if (!ratio || ratio <= 1) return 0
    let saved = 0
    for (const region of this._regions) {
      if (atTimeMs <= region.start) break
      const silenceStart = region.start
      const silenceEnd = Math.min(region.end, atTimeMs)
      const silenceDuration = silenceEnd - silenceStart
      saved += silenceDuration * (1 - 1 / ratio)
    }
    return saved
  }

  reset() {
    this._regions = []
  }
}

module.exports = SilenceMap
