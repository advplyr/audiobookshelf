const Logger = require('../../Logger')
const { areEquivalent, copyValue } = require('../../utils/index')

class VideoMetadata {
  constructor(metadata) {
    this.title = null
    this.description = null
    this.explicit = false
    this.language = null

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.description = metadata.description
    this.explicit = metadata.explicit
    this.language = metadata.language || null
  }

  toJSON() {
    return {
      title: this.title,
      description: this.description,
      explicit: this.explicit,
      language: this.language
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titleIgnorePrefix,
      description: this.description,
      explicit: this.explicit,
      language: this.language
    }
  }

  toJSONExpanded() {
    return this.toJSONMinified()
  }

  clone() {
    return new VideoMetadata(this.toJSON())
  }

  get titleIgnorePrefix() {
    if (!this.title) return ''
    var prefixesToIgnore = global.ServerSettings.sortingPrefixes || []
    for (const prefix of prefixesToIgnore) {
      // e.g. for prefix "the". If title is "The Book Title" return "Book Title, The"
      if (this.title.toLowerCase().startsWith(`${prefix} `)) {
        return this.title.substr(prefix.length + 1) + `, ${prefix.substr(0, 1).toUpperCase() + prefix.substr(1)}`
      }
    }
    return this.title
  }

  searchQuery(query) { // Returns key if match is found
    var keysToCheck = ['title']
    for (var key of keysToCheck) {
      if (this[key] && String(this[key]).toLowerCase().includes(query)) {
        return {
          matchKey: key,
          matchText: this[key]
        }
      }
    }
    return null
  }

  setData(mediaMetadata = {}) {
    this.title = mediaMetadata.title || null
    this.description = mediaMetadata.description || null
    this.explicit = !!mediaMetadata.explicit
    this.language = mediaMetadata.language || null
  }

  update(payload) {
    var json = this.toJSON()
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[VideoMetadata] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }
}
module.exports = VideoMetadata