const Database = require('../Database')

async function resolvePlaylistRequestItems(items, libraryId) {
  // Get lists of items, episodes, and books to simplify later operations
  const libraryItemIds = Array.from(new Set(items.map((i) => i.libraryItemId).filter((i) => i)))
  const episodeIds = Array.from(new Set(items.map((i) => i.episodeId).filter((i) => i)))
  const bookLibraryItemIds = Array.from(new Set(items.filter((i) => !i.episodeId).map((i) => i.libraryItemId)))

  // Load library items for later mapping to episodes and books.
  const libraryItems = await Database.libraryItemModel.findAll({
    attributes: ['id', 'mediaId', 'mediaType', 'libraryId'],
    where: {
      id: libraryItemIds,
      libraryId
    }
  })
  if (libraryItems.length !== libraryItemIds.length) {
    return null
  }

  const libraryItemsById = new Map(libraryItems.map((libraryItem) => [libraryItem.id, libraryItem]))

  // Books still need their fully expanded library item because the playlist response embeds the whole book object.
  const bookLibraryItems = bookLibraryItemIds.length
    ? await Database.libraryItemModel.findAllExpandedWhere({
        id: bookLibraryItemIds,
        libraryId,
        mediaType: 'book'
      })
    : []
  const bookLibraryItemsById = new Map(bookLibraryItems.map((libraryItem) => [libraryItem.id, libraryItem]))

  // For podcast adds, load only the requested episodes plus their owning podcast/library item.
  const podcastEpisodes = episodeIds.length
    ? await Database.podcastEpisodeModel.findAll({
        where: {
          id: episodeIds
        },
        include: [
          {
            model: Database.podcastModel,
            include: [
              {
                model: Database.libraryItemModel
              }
            ]
          }
        ]
      })
    : []
  const podcastEpisodesById = new Map(podcastEpisodes.map((episode) => [episode.id, episode]))

  return items.map((item) => {
    const libraryItem = libraryItemsById.get(item.libraryItemId)
    if (!libraryItem) return null

    // If this is an episode item, create the object with owning library item
    if (item.episodeId) {
      const episode = podcastEpisodesById.get(item.episodeId)
      if (libraryItem.mediaType !== 'podcast' || !episode?.podcast?.libraryItem || episode.podcast.libraryItem.id !== item.libraryItemId) {
        return null
      }

      const episodeLibraryItem = episode.podcast.libraryItem
      episodeLibraryItem.media = episode.podcast

      return {
        item,
        mediaItemId: item.episodeId,
        mediaItemType: 'podcastEpisode',
        jsonItem: {
          episodeId: item.episodeId,
          episode: episode.toOldJSONExpanded(episodeLibraryItem.id),
          libraryItemId: episodeLibraryItem.id,
          libraryItem: episodeLibraryItem.toOldJSONMinified()
        }
      }
    }

    // If not a podcast, this is a book
    const expandedBookLibraryItem = bookLibraryItemsById.get(item.libraryItemId)
    if (libraryItem.mediaType !== 'book' || !expandedBookLibraryItem) {
      return null
    }

    return {
      item,
      mediaItemId: expandedBookLibraryItem.media.id,
      mediaItemType: 'book',
      jsonItem: {
        libraryItemId: expandedBookLibraryItem.id,
        libraryItem: expandedBookLibraryItem.toOldJSONExpanded()
      }
    }
  })
}

module.exports = {
  resolvePlaylistRequestItems
}
