const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')

/**
 * Notify users following a series that a new book was added.
 * Called after a new library item is created by the scanner.
 *
 * @param {import('../models/LibraryItem')} libraryItem - the newly created expanded library item
 */
async function notifyFollowersOfNewBook(libraryItem) {
  if (libraryItem.mediaType !== 'book') return
  if (!libraryItem.media?.series?.length) return

  const seriesIds = libraryItem.media.series.map((s) => s.id)
  if (!seriesIds.length) return

  const follows = await Database.userSeriesFollowModel.findAll({
    where: { seriesId: seriesIds },
    attributes: ['userId', 'seriesId']
  })

  if (!follows.length) return

  // Group by userId to send one event per user
  const userSeriesMap = {}
  for (const follow of follows) {
    if (!userSeriesMap[follow.userId]) {
      userSeriesMap[follow.userId] = []
    }
    userSeriesMap[follow.userId].push(follow.seriesId)
  }

  const libraryItemJson = libraryItem.toOldJSONExpanded()

  for (const [userId, followedSeriesIds] of Object.entries(userSeriesMap)) {
    const matchedSeries = libraryItem.media.series
      .filter((s) => followedSeriesIds.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name }))

    SocketAuthority.clientEmitter(userId, 'followed_series_book_added', {
      libraryItem: libraryItemJson,
      series: matchedSeries
    })

    Logger.debug(`[FollowNotifications] Notified user ${userId} of new book in followed series: ${matchedSeries.map((s) => s.name).join(', ')}`)
  }
}

module.exports = { notifyFollowersOfNewBook }
