const { getId } = require('../../utils/index')

class Series {
  constructor(series) {
    this.id = null
    this.name = null
    this.addedAt = null
    this.updatedAt = null

    if (series) {
      this.construct(series)
    }
  }

  construct(series) {
    this.id = series.id
    this.name = series.name
    this.addedAt = series.addedAt
    this.updatedAt = series.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONMinimal(sequence) {
    return {
      id: this.id,
      name: this.name,
      sequence
    }
  }

  setData(data) {
    this.id = getId('ser')
    this.name = data.name
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }
}
module.exports = Series