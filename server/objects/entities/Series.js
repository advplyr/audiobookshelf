class Series {
  constructor(series) {
    this.id = null
    this.name = null
    this.sequence = null
    this.addedAt = null
    this.updatedAt = null

    if (series) {
      this.construct(series)
    }
  }

  construct(series) {
    this.id = series.id
    this.name = series.name
    this.sequence = series.sequence
    this.addedAt = series.addedAt
    this.updatedAt = series.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      sequence: this.sequence,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name,
      sequence: this.sequence
    }
  }
}
module.exports = Series