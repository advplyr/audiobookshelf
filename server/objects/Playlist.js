const uuidv4 = require("uuid").v4

class Playlist {
  constructor(playlist) {
    this.id = null
    this.libraryId = null
    this.userId = null

    this.name = null
    this.description = null

    this.coverPath = null

    // Array of objects like { libraryItemId: "", episodeId: "" } (episodeId optional)
    this.items = []

    this.lastUpdate = null
    this.createdAt = null

    if (playlist) {
      this.construct(playlist)
    }
  }

  toJSON() {
    return {
      id: this.id,
      libraryId: this.libraryId,
      userId: this.userId,
      name: this.name,
      description: this.description,
      coverPath: this.coverPath,
      items: [...this.items],
      lastUpdate: this.lastUpdate,
      createdAt: this.createdAt
    }
  }

  // Expands the items array
  toJSONExpanded(libraryItems) {
    var json = this.toJSON()
    json.items = json.items.map(item => {
      const libraryItem = libraryItems.find(li => li.id === item.libraryItemId)
      if (!libraryItem) {
        // Not found
        return null
      }
      if (item.episodeId) {
        if (!libraryItem.isPodcast) {
          // Invalid
          return null
        }
        const episode = libraryItem.media.episodes.find(ep => ep.id === item.episodeId)
        if (!episode) {
          // Not found
          return null
        }

        return {
          ...item,
          episode: episode.toJSONExpanded(),
          libraryItem: libraryItem.toJSONMinified()
        }
      } else {
        return {
          ...item,
          libraryItem: libraryItem.toJSONExpanded()
        }
      }
    }).filter(i => i)
    return json
  }

  construct(playlist) {
    this.id = playlist.id
    this.libraryId = playlist.libraryId
    this.userId = playlist.userId
    this.name = playlist.name
    this.description = playlist.description || null
    this.coverPath = playlist.coverPath || null
    this.items = playlist.items ? playlist.items.map(i => ({ ...i })) : []
    this.lastUpdate = playlist.lastUpdate || null
    this.createdAt = playlist.createdAt || null
  }

  setData(data) {
    if (!data.userId || !data.libraryId || !data.name) {
      return false
    }
    this.id = uuidv4()
    this.userId = data.userId
    this.libraryId = data.libraryId
    this.name = data.name
    this.description = data.description || null
    this.coverPath = data.coverPath || null
    this.items = data.items ? data.items.map(i => ({ ...i })) : []
    this.lastUpdate = Date.now()
    this.createdAt = Date.now()
    return true
  }

  addItem(libraryItemId, episodeId = null) {
    this.items.push({
      libraryItemId,
      episodeId: episodeId || null
    })
    this.lastUpdate = Date.now()
  }

  removeItem(libraryItemId, episodeId = null) {
    if (episodeId) this.items = this.items.filter(i => i.libraryItemId !== libraryItemId || i.episodeId !== episodeId)
    else this.items = this.items.filter(i => i.libraryItemId !== libraryItemId)
    this.lastUpdate = Date.now()
  }

  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      if (key === 'items') {
        if (payload.items && JSON.stringify(payload.items) !== JSON.stringify(this.items)) {
          this.items = payload.items.map(i => ({ ...i }))
          hasUpdates = true
        }
      } else if (this[key] !== undefined && this[key] !== payload[key]) {
        hasUpdates = true
        this[key] = payload[key]
      }
    }
    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }

  containsItem(item) {
    if (item.episodeId) return this.items.some(i => i.libraryItemId === item.libraryItemId && i.episodeId === item.episodeId)
    return this.items.some(i => i.libraryItemId === item.libraryItemId)
  }

  hasItemsForLibraryItem(libraryItemId) {
    return this.items.some(i => i.libraryItemId === libraryItemId)
  }

  removeItemsForLibraryItem(libraryItemId) {
    this.items = this.items.filter(i => i.libraryItemId !== libraryItemId)
  }
}
module.exports = Playlist