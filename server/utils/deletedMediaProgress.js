const Logger = require('../Logger')
const Database = require('../Database')

/**
 * Helpers for the opt-in "keep deleted media progress" feature (server setting `keepDeletedMediaProgress`).
 *
 * - archive(): called right BEFORE media progress is deleted for books/episodes that are being removed.
 *   Writes a snapshot (title, author, asin, etc.) to the deletedMediaProgresses table.
 * - restoreForBook() / restoreForPodcastEpisode(): called when a new book/episode is added.
 *   If a snapshot matches, the progress is restored for that user and the snapshot removed.
 */

const normalize = (str) =>
  (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

const hasMeaningfulProgress = (mp) => !!mp.isFinished || (mp.currentTime || 0) > 0 || (mp.ebookProgress || 0) > 0

/**
 * @returns {boolean}
 */
function isEnabled() {
  return !!Database.serverSettings?.keepDeletedMediaProgress
}

/**
 * Snapshot media progress for media items that are about to be deleted.
 * Does nothing if the setting is disabled. Never throws (must not block deletion).
 *
 * @param {string|string[]} mediaItemIds bookId(s) or podcastEpisodeId(s)
 * @returns {Promise<number>} number of snapshots written
 */
async function archive(mediaItemIds) {
  if (!isEnabled()) return 0
  const ids = [].concat(mediaItemIds || []).filter(Boolean)
  if (!ids.length) return 0

  try {
    const progresses = (await Database.mediaProgressModel.findAll({ where: { mediaItemId: ids } })).filter(hasMeaningfulProgress)
    if (!progresses.length) return 0

    const bookIds = [...new Set(progresses.filter((mp) => mp.mediaItemType === 'book').map((mp) => mp.mediaItemId))]
    const episodeIds = [...new Set(progresses.filter((mp) => mp.mediaItemType === 'podcastEpisode').map((mp) => mp.mediaItemId))]

    /** @type {Map<string, Object>} mediaItemId => metadata */
    const metadataMap = new Map()

    if (bookIds.length) {
      const books = await Database.bookModel.findAll({
        where: { id: bookIds },
        attributes: ['id', 'title', 'asin', 'isbn', 'duration'],
        include: { model: Database.libraryItemModel, attributes: ['id', 'libraryId'], required: false }
      })
      const bookAuthors = await Database.bookAuthorModel.findAll({
        where: { bookId: bookIds },
        include: { model: Database.authorModel, attributes: ['name'] },
        order: [['createdAt', 'ASC']]
      })
      for (const book of books) {
        metadataMap.set(book.id, {
          libraryId: book.libraryItem?.libraryId || null,
          title: book.title,
          authorName: bookAuthors
            .filter((ba) => ba.bookId === book.id && ba.author)
            .map((ba) => ba.author.name)
            .join(', '),
          asin: book.asin || null,
          isbn: book.isbn || null,
          duration: book.duration || 0
        })
      }
    }

    if (episodeIds.length) {
      const episodes = await Database.podcastEpisodeModel.findAll({
        where: { id: episodeIds },
        attributes: ['id', 'title', 'publishedAt', 'enclosureURL', 'extraData', 'audioFile'],
        include: {
          model: Database.podcastModel,
          attributes: ['id', 'title'],
          include: { model: Database.libraryItemModel, attributes: ['id', 'libraryId'], required: false }
        }
      })
      for (const episode of episodes) {
        metadataMap.set(episode.id, {
          libraryId: episode.podcast?.libraryItem?.libraryId || null,
          title: episode.title,
          podcastTitle: episode.podcast?.title || null,
          episodeGuid: episode.extraData?.guid || null,
          enclosureURL: episode.enclosureURL || null,
          publishedAt: episode.publishedAt || null,
          duration: episode.audioFile?.duration || 0
        })
      }
    }

    const rows = []
    for (const mp of progresses) {
      const metadata = metadataMap.get(mp.mediaItemId)
      if (!metadata) continue // Media item is already gone - nothing to snapshot
      rows.push({
        userId: mp.userId,
        mediaItemType: mp.mediaItemType,
        originalMediaItemId: mp.mediaItemId,
        ...metadata,
        duration: mp.duration || metadata.duration,
        currentTime: mp.currentTime,
        isFinished: !!mp.isFinished,
        finishedAt: mp.finishedAt,
        startedAt: mp.createdAt,
        ebookLocation: mp.ebookLocation,
        ebookProgress: mp.ebookProgress,
        extraData: { progress: mp.extraData?.progress || 0 }
      })
    }
    if (!rows.length) return 0

    // Replace any snapshot already stored for the same item
    await Database.deletedMediaProgressModel.destroy({ where: { originalMediaItemId: rows.map((r) => r.originalMediaItemId) } })
    await Database.deletedMediaProgressModel.bulkCreate(rows)
    Logger.info(`[DeletedMediaProgress] Kept ${rows.length} media progress snapshot(s) for deleted media items`)
    return rows.length
  } catch (error) {
    Logger.error(`[DeletedMediaProgress] Failed to archive media progress`, error)
    return 0
  }
}

/**
 * @param {Object} row DeletedMediaProgress
 * @param {Object} mediaItemFields
 */
async function restoreRow(row, mediaItemFields) {
  const mediaProgress = await Database.mediaProgressModel.create({
    userId: row.userId,
    mediaItemId: mediaItemFields.mediaItemId,
    mediaItemType: row.mediaItemType,
    podcastId: mediaItemFields.podcastId || null,
    duration: mediaItemFields.duration || row.duration,
    currentTime: row.currentTime,
    isFinished: row.isFinished,
    finishedAt: row.finishedAt,
    ebookLocation: row.ebookLocation,
    ebookProgress: row.ebookProgress,
    hideFromContinueListening: true, // Restored history shouldn't pop up in "Continue listening"
    extraData: { libraryItemId: mediaItemFields.libraryItemId, progress: row.extraData?.progress || 0 },
    createdAt: row.startedAt || new Date()
  })
  Database.userModel.mediaProgressRestored(mediaProgress)
  return mediaProgress
}

/**
 * Pick the best snapshot per user (finished first, then most recently deleted), restore them and
 * remove all matched snapshots.
 */
async function restoreBestPerUser(matchedRows, mediaItemFields) {
  const byUser = new Map()
  for (const row of matchedRows) {
    const current = byUser.get(row.userId)
    if (!current || (row.isFinished && !current.isFinished) || (row.isFinished === current.isFinished && row.createdAt > current.createdAt)) {
      byUser.set(row.userId, row)
    }
  }
  let restored = 0
  for (const row of byUser.values()) {
    const existing = await Database.mediaProgressModel.count({ where: { userId: row.userId, mediaItemId: mediaItemFields.mediaItemId } })
    if (existing) continue
    await restoreRow(row, mediaItemFields)
    restored++
  }
  await Database.deletedMediaProgressModel.destroy({ where: { id: matchedRows.map((r) => r.id) } })
  return restored
}

/**
 * Restore progress for a newly added book if it matches deleted progress snapshot(s).
 * Matches on ASIN, then ISBN, then title + author (+ duration within tolerance).
 * Does nothing if the setting is disabled. Never throws.
 *
 * @param {{ id: string, title: string, asin?: string, isbn?: string, duration?: number }} book
 * @param {string} authorName comma separated
 * @param {string} libraryItemId
 * @returns {Promise<number>} number of users whose progress was restored
 */
async function restoreForBook(book, authorName, libraryItemId) {
  if (!isEnabled()) return 0
  try {
    // Table only holds deleted items that had progress, so it is small - match in JS for punctuation/case-insensitive titles
    const candidates = await Database.deletedMediaProgressModel.findAll({ where: { mediaItemType: 'book' } })
    if (!candidates.length) return 0

    const normTitle = normalize(book.title)
    const normAuthor = normalize(authorName)
    const matched = candidates.filter((row) => {
      if (book.asin && row.asin && book.asin === row.asin) return true
      if (book.isbn && row.isbn && book.isbn === row.isbn) return true
      if (!normTitle || normalize(row.title) !== normTitle) return false
      const rowAuthor = normalize(row.authorName)
      if (normAuthor && rowAuthor && normAuthor !== rowAuthor) return false
      if (book.duration > 0 && row.duration > 0) {
        const tolerance = Math.max(120, Math.max(book.duration, row.duration) * 0.02)
        if (Math.abs(book.duration - row.duration) > tolerance) return false
      }
      return true
    })
    if (!matched.length) return 0

    const restored = await restoreBestPerUser(matched, { mediaItemId: book.id, duration: book.duration, libraryItemId })
    if (restored) Logger.info(`[DeletedMediaProgress] Restored progress for ${restored} user(s) on re-added book "${book.title}"`)
    return restored
  } catch (error) {
    Logger.error(`[DeletedMediaProgress] Failed to restore progress for book "${book?.title}"`, error)
    return 0
  }
}

/**
 * Restore progress for a newly added podcast episode if it matches deleted progress snapshot(s).
 * Matches on RSS guid, then enclosure URL, then episode title + podcast title.
 * Does nothing if the setting is disabled. Never throws.
 *
 * @param {{ id: string, title: string, podcastId: string, enclosureURL?: string, extraData?: {guid?: string}, audioFile?: {duration?: number} }} episode
 * @param {string} podcastTitle
 * @param {string} libraryItemId
 * @returns {Promise<number>} number of users whose progress was restored
 */
async function restoreForPodcastEpisode(episode, podcastTitle, libraryItemId) {
  if (!isEnabled()) return 0
  try {
    const guid = episode.extraData?.guid
    const candidates = await Database.deletedMediaProgressModel.findAll({ where: { mediaItemType: 'podcastEpisode' } })
    if (!candidates.length) return 0

    const matched = candidates.filter((row) => {
      if (guid && row.episodeGuid && guid === row.episodeGuid) return true
      if (episode.enclosureURL && row.enclosureURL && episode.enclosureURL === row.enclosureURL) return true
      return !!episode.title && normalize(row.title) === normalize(episode.title) && !!podcastTitle && normalize(row.podcastTitle) === normalize(podcastTitle)
    })
    if (!matched.length) return 0

    const restored = await restoreBestPerUser(matched, {
      mediaItemId: episode.id,
      podcastId: episode.podcastId,
      duration: episode.audioFile?.duration,
      libraryItemId
    })
    if (restored) Logger.info(`[DeletedMediaProgress] Restored progress for ${restored} user(s) on re-added episode "${episode.title}"`)
    return restored
  } catch (error) {
    Logger.error(`[DeletedMediaProgress] Failed to restore progress for episode "${episode?.title}"`, error)
    return 0
  }
}

module.exports = { isEnabled, archive, restoreForBook, restoreForPodcastEpisode }
