const { Op } = require('sequelize')
const Database = require('../../Database')

function isVisibleUser(user) {
  return !!user && !user.extraData?.hideListeningActivity
}

function aggregateSessions(sessions, usersById, itemsByMediaId) {
  const books = new Map()
  const listeners = new Map()
  const authors = new Map()
  let totalListeningTime = 0

  for (const session of sessions) {
    const user = usersById.get(session.userId)
    const item = itemsByMediaId.get(session.mediaItemId)
    if (!isVisibleUser(user) || !item) continue
    const timeListening = Number(session.timeListening) || 0
    totalListeningTime += timeListening
    listeners.set(user.id, (listeners.get(user.id) || 0) + timeListening)
    if (session.mediaItemType !== 'book') continue
    const current = books.get(item.id) || { id: item.id, title: session.displayTitle || item.media?.metadata?.title || '', cover: `/api/items/${item.id}/cover`, timeListening: 0, listenerIds: new Set() }
    current.timeListening += timeListening
    current.listenerIds.add(user.id)
    books.set(item.id, current)
    for (const author of session.mediaMetadata?.authors || []) {
      const name = typeof author === 'string' ? author : author.name
      if (name) authors.set(name, (authors.get(name) || 0) + timeListening)
    }
  }

  return {
    totalListeningTime: Math.round(totalListeningTime),
    listenerCount: listeners.size,
    mostListenedBooks: [...books.values()].map(({ listenerIds, ...book }) => ({ ...book, timeListening: Math.round(book.timeListening), listenerCount: listenerIds.size })).sort((a, b) => b.timeListening - a.timeListening).slice(0, 10),
    mostActiveListeners: [...listeners].map(([id, timeListening]) => ({ userId: id, username: usersById.get(id).username, timeListening: Math.round(timeListening) })).sort((a, b) => b.timeListening - a.timeListening).slice(0, 10),
    topAuthors: [...authors].map(([name, timeListening]) => ({ name, timeListening: Math.round(timeListening) })).sort((a, b) => b.timeListening - a.timeListening).slice(0, 10)
  }
}

async function getContext(libraryId, requestingUser) {
  const [sessions, users] = await Promise.all([
    Database.playbackSessionModel.findAll({ where: { libraryId }, order: [['createdAt', 'DESC']] }),
    Database.userModel.findAll({ attributes: ['id', 'username', 'extraData'] })
  ])
  const usersById = new Map(users.filter(isVisibleUser).map((user) => [user.id, user]))
  const libraryItemIds = [...new Set(sessions.map((session) => session.extraData?.libraryItemId).filter(Boolean))]
  const items = (await Promise.all(libraryItemIds.map((id) => Database.libraryItemModel.getExpandedById(id)))).filter((item) => item && requestingUser.checkCanAccessLibraryItem(item))
  const itemsByMediaId = new Map()
  for (const item of items) {
    itemsByMediaId.set(item.mediaId, item)
    for (const episode of item.media?.podcastEpisodes || []) itemsByMediaId.set(episode.id, item)
  }
  return { sessions, usersById, itemsByMediaId }
}

async function getLibraryStats(libraryId, requestingUser) {
  const context = await getContext(libraryId, requestingUser)
  return aggregateSessions(context.sessions, context.usersById, context.itemsByMediaId)
}

async function getLibraryActivity(libraryId, requestingUser, page, itemsPerPage) {
  const { sessions, usersById, itemsByMediaId } = await getContext(libraryId, requestingUser)
  const events = sessions.filter((session) => usersById.has(session.userId) && itemsByMediaId.has(session.mediaItemId)).map((session) => {
    const item = itemsByMediaId.get(session.mediaItemId)
    return { id: session.id, userId: session.userId, username: usersById.get(session.userId).username, libraryItemId: item.id, itemTitle: session.displayTitle || item.media?.metadata?.title || '', cover: `/api/items/${item.id}/cover`, timeListening: Number(session.timeListening) || 0, timestamp: session.createdAt?.valueOf?.() || new Date(session.createdAt).valueOf() }
  })
  return { total: events.length, numPages: Math.ceil(events.length / itemsPerPage), page, itemsPerPage, events: events.slice(page * itemsPerPage, (page + 1) * itemsPerPage) }
}

async function getItemListeners(libraryItem) {
  const users = await Database.userModel.findAll({ attributes: ['id', 'username', 'extraData'] })
  const usersById = new Map(users.filter(isVisibleUser).map((user) => [user.id, user]))
  const mediaItemIds = [libraryItem.mediaId, ...(libraryItem.media?.podcastEpisodes || []).map((episode) => episode.id)]
  const [sessions, progresses] = await Promise.all([
    Database.playbackSessionModel.findAll({ where: { mediaItemId: { [Op.in]: mediaItemIds }, userId: { [Op.in]: [...usersById.keys()] } } }),
    Database.mediaProgressModel.findAll({ where: { mediaItemId: { [Op.in]: mediaItemIds }, userId: { [Op.in]: [...usersById.keys()] } } })
  ])
  const listenerIds = new Set(sessions.map((session) => session.userId))
  const progressByUser = new Map()
  for (const progress of progresses) {
    const previous = progressByUser.get(progress.userId)
    if (!previous || progress.updatedAt > previous.updatedAt) progressByUser.set(progress.userId, progress)
  }
  return {
    listenerCount: listenerIds.size,
    finishedCount: [...listenerIds].filter((id) => !!progressByUser.get(id)?.finishedAt || !!progressByUser.get(id)?.isFinished).length,
    listeners: [...listenerIds].map((id) => { const progress = progressByUser.get(id); return { userId: id, username: usersById.get(id).username, percent: progress?.duration ? Math.min(100, Math.round((progress.currentTime / progress.duration) * 100)) : 0, finished: !!progress?.finishedAt || !!progress?.isFinished } }).sort((a, b) => a.username.localeCompare(b.username))
  }
}

module.exports = { aggregateSessions, getLibraryStats, getLibraryActivity, getItemListeners, isVisibleUser }
