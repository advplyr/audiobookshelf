// server/managers/AchievementManager.js
const Path = require('path')
const Sequelize = require('sequelize')
const fsx = require('../libs/fsExtra')
const Database = require('../Database')
const Store = require('../utils/userProgressStore')

const CATALOG_PATH = Path.join(__dirname, '..', 'data', 'achievements.catalog.json')

let _catalogCache = null

async function loadCatalog () {
  if (_catalogCache) return _catalogCache
  const raw = await fsx.readFile(CATALOG_PATH, 'utf8')
  _catalogCache = JSON.parse(raw)
  return _catalogCache
}

// === helpers ================================================================
const DAY_MS = 24 * 60 * 60 * 1000
const dayKey = (ts = Date.now()) => Math.floor(ts / DAY_MS)
const toDbUserId = (userId) => {
  const n = Number(userId)
  return Number.isFinite(n) ? n : userId
}

// ============================================================================
// a clean default shape persisted per user
function emptyProgress (userId) {
  return {
    userId,
    counters: {
      // thresholds (unique finishes)
      finishedUniqueIds: [],
      finishedUniqueCount: 0,
      finishedCount: 0,

      // Search Master
      searchCount: 0,

      // first-time flags
      createdLibrary: false,
      editedLibrary: false,
      uploadedBook: false,
      downloadedBook: false,
      createdSeries: false,
      createdCollection: false,
      createdPlaylist: false,
      performedSearch: false,
      visitedUpload: false,
      openedAuthor: false,
      openedNarrator: false,
      visitedSettings: false,

      // 🔸 NEW: first time deleting an uploaded file
      deletedFirstFile: false,

      // 🔸 NEW: fallback detector storage
      lastSeenBookCount: null,

      // Daily Devotion
      totalLogins: 0,
      lastLoginKey: null,
      todayLoginCount: 0,
      loginStreak: 0,

      // Reading Streak
      lastFinishedKey: null,
      readingStreak: 0,
      finishedWithinDay: false
    },
    unlocked: [],
    history: [],
    seenPopups: []
  }
}

function normalizeWithCatalog (progress, catalog) {
  progress.counters = progress.counters || {}
  if (!Array.isArray(progress.counters.finishedUniqueIds)) progress.counters.finishedUniqueIds = []
  if (typeof progress.counters.finishedUniqueCount !== 'number') progress.counters.finishedUniqueCount = 0

  const valid = new Set(Object.keys(catalog.badges || {}))
  progress.unlocked = Array.isArray(progress.unlocked) ? progress.unlocked.filter(id => valid.has(id)) : []
  progress.unlocked = [...new Set(progress.unlocked)]
  progress.history = Array.isArray(progress.history) ? progress.history.filter(h => h && valid.has(h.badgeId)) : []
  return progress
}

// thresholds
function readingThresholds () {
  return [
    { id: 'new_reader', threshold: 1 },
    { id: 'bookworm', threshold: 5 },
    { id: 'avid', threshold: 10 },
    { id: 'page_turner', threshold: 25 },
    { id: 'marathoner', threshold: 50 },
    { id: 'centurion', threshold: 100 },
    { id: 'legend', threshold: 250 }
  ]
}
function searchThresholds () {
  return [
    { id: 'first_search',   threshold: 1 },
    { id: 'curious',        threshold: 3 },
    { id: 'seeker',         threshold: 5 },
    { id: 'explorer',       threshold: 10 },
    { id: 'hunter',         threshold: 50 },
    { id: 'master_queries', threshold: 100 }
  ]
}

function computeUnlockedFresh (progress) {
  const out = new Set()

  // Reading Journey (by UNIQUE finished items)
  const fc = Number(progress.counters.finishedUniqueCount || 0)
  for (const t of readingThresholds()) if (fc >= t.threshold) out.add(t.id)

  // Search Master
  const sc = Number(progress.counters.searchCount || 0)
  for (const t of searchThresholds()) if (sc >= t.threshold) out.add(t.id)

  // Getting Started + playlist + 🔸deletedFirstFile → Saga Initiator
  const started = [
    ['createdLibrary',    'library_creator'],
    ['editedLibrary',     'library_editor'],
    ['uploadedBook',      'book_uploader'],
    ['downloadedBook',    'book_downloader'],
    // 🔸 re-purpose the existing badge id for the new action
    ['deletedFirstFile',  'series_starter'],
    ['createdCollection', 'collection_maker'],
    ['createdPlaylist',   'tune_weaver']
  ]
  for (const [flag, badgeId] of started) if (progress.counters[flag]) out.add(badgeId)

  // Adventurer’s Path
  const explore = [
    ['performedSearch', 'searcher'],
    ['visitedUpload',   'refined_explorer'],
    ['openedAuthor',    'author_finder'],
    ['openedNarrator',  'narrator_finder'],
    ['visitedSettings', 'pathfinder']
  ]
  for (const [flag, badgeId] of explore) if (progress.counters[flag]) out.add(badgeId)

  // Daily Devotion
  const ls = Number(progress.counters.loginStreak || 0)
  if (Number(progress.counters.totalLogins || 0) >= 1) out.add('first_login')
  if (Number(progress.counters.todayLoginCount || 0) >= 2) out.add('double_dip')
  if (ls >= 3)  out.add('streak_3')
  if (ls >= 7)  out.add('streak_7')
  if (ls >= 30) out.add('streak_30')

  // Reading Streak
  const rs = Number(progress.counters.readingStreak || 0)
  if (progress.counters.finishedWithinDay) out.add('one_day_finish')
  if (rs >= 2)  out.add('back_to_back')
  if (rs >= 5)  out.add('focused_five')
  if (rs >= 7)  out.add('weekly_reader')
  if (rs >= 30) out.add('monthly_reader')

  return [...out]
}

// robust DISTINCT finished ids from DB, with fallbacks
async function getDistinctFinishedIds (userId) {
  const uid = toDbUserId(userId)
  const Op = Sequelize.Op

  try {
    const rows = await Database.mediaProgressModel.findAll({
      where: { userId: uid, finishedAt: { [Op.ne]: null } },
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('libraryItemId')), 'libraryItemId']],
      raw: true
    })
    const ids = rows.map(r => String(r.libraryItemId)).filter(Boolean)
    if (ids.length) return [...new Set(ids)]
  } catch {}

  try {
    const rows = await Database.mediaProgressModel.findAll({
      where: { userId: uid, isFinished: 1 },
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('libraryItemId')), 'libraryItemId']],
      raw: true
    })
    const ids = rows.map(r => String(r.libraryItemId)).filter(Boolean)
    if (ids.length) return [...new Set(ids)]
  } catch {}

  try {
    const rows = await Database.mediaProgressModel.findAll({
      where: { userId: uid },
      attributes: ['libraryItemId', 'finishedAt', 'isFinished', 'currentTime', 'duration'],
      raw: true
    })
    const ids = []
    for (const r of rows) {
      const id = r && r.libraryItemId != null ? String(r.libraryItemId) : null
      if (!id) continue
      const finishedAt = r.finishedAt != null
      const isFinished = Number(r.isFinished || 0) === 1
      const ratioOk = Number(r.duration || 0) > 0 && Number(r.currentTime || 0) / Number(r.duration) >= 0.98
      if (finishedAt || isFinished || ratioOk) ids.push(id)
    }
    if (ids.length) return [...new Set(ids)]
  } catch {}

  return []
}

async function finishedWithinOneDay (userId, itemId = null) {
  const uid = toDbUserId(userId)
  const Op = Sequelize.Op
  try {
    const where = itemId
      ? { userId: uid, libraryItemId: itemId }
      : { userId: uid, finishedAt: { [Op.ne]: null } }
    const mp = await Database.mediaProgressModel.findOne({
      where,
      order: itemId ? [['updatedAt', 'DESC']] : [['finishedAt', 'DESC']]
    })
    if (!mp) return false
    const started = mp.createdAt ? new Date(mp.createdAt).getTime() : null
    const finished = mp.finishedAt ? new Date(mp.finishedAt).getTime() : null
    if (!started || !finished) return false
    return (finished - started) <= DAY_MS
  } catch {
    return false
  }
}

async function syncFromDb (userId, progress) {
  let idsFromDb = []
  try { idsFromDb = await getDistinctFinishedIds(userId) } catch {}

  const fallbackIds = Array.isArray(progress.counters.finishedUniqueIds)
    ? [...new Set(progress.counters.finishedUniqueIds)]
    : []

  const finalIds = idsFromDb.length ? idsFromDb : fallbackIds
  progress.counters.finishedUniqueIds = finalIds
  progress.counters.finishedUniqueCount = finalIds.length
  progress.counters.finishedCount = finalIds.length

  // best-effort backfills
  try {
    const libCount = await Database.libraryModel.count()
    if (libCount > 0) progress.counters.createdLibrary = true
  } catch {}
  try {
    const bookCount = await Database.bookModel.count()
    if (bookCount > 0) progress.counters.uploadedBook = true
  } catch {}
  try {
    if (!progress.counters.finishedWithinDay) {
      progress.counters.finishedWithinDay = await finishedWithinOneDay(userId, null)
    }
  } catch {}

  // 🔸 NEW: fallback detection for a deletion
  try {
    const currentBooks = await Database.bookModel.count()
    const lastSeen = progress.counters.lastSeenBookCount
    progress.counters.lastSeenBookCount = currentBooks
    if (
      progress.counters.uploadedBook &&               // user has ever uploaded
      lastSeen !== null &&
      currentBooks < lastSeen &&                      // total down → something was deleted
      !progress.counters.deletedFirstFile             // only set once
    ) {
      progress.counters.deletedFirstFile = true
    }
  } catch {}

  const before = new Set(progress.unlocked)
  progress.unlocked = computeUnlockedFresh(progress)
  const now = new Date().toISOString()
  for (const id of progress.unlocked) if (!before.has(id)) {
    progress.history.push({ badgeId: id, unlockedAt: now })
  }
  return progress
}

async function getUserProgress (userId, opts = {}) {
  const catalog = await loadCatalog()
  let progress = (await Store.read(userId)) || emptyProgress(userId)
  progress = normalizeWithCatalog(progress, catalog)

  if (opts.syncFromDb) {
    await syncFromDb(userId, progress)
    progress = normalizeWithCatalog(progress, catalog)
    await Store.write(userId, progress)
  }
  return progress
}

function updateLoginStreak (c) {
  const today = dayKey()
  if (c.lastLoginKey === today) {
    c.todayLoginCount = (c.todayLoginCount || 0) + 1
    return
  }
  const yesterday = today - 1
  if (c.lastLoginKey === yesterday) c.loginStreak = (c.loginStreak || 0) + 1
  else c.loginStreak = 1
  c.lastLoginKey = today
  c.todayLoginCount = 1
  c.totalLogins = (c.totalLogins || 0) + 1
}

function updateReadingStreakOnFinish (c) {
  const today = dayKey()
  if (c.lastFinishedKey === today) {
    // already counted today
  } else if (c.lastFinishedKey === today - 1) {
    c.readingStreak = (c.readingStreak || 0) + 1
    c.lastFinishedKey = today
  } else {
    c.readingStreak = 1
    c.lastFinishedKey = today
  }
}

async function applyEvent (userId, event, meta = {}) {
  const catalog = await loadCatalog()
  const progress = await getUserProgress(userId)

  switch (event) {
    case 'itemFinished': {
      updateReadingStreakOnFinish(progress.counters)
      const rawId = meta.itemId != null ? meta.itemId : meta.libraryItemId
      const itemId = rawId != null ? String(rawId) : null
      if (itemId) {
        const set = new Set(progress.counters.finishedUniqueIds || [])
        set.add(itemId)
        progress.counters.finishedUniqueIds = [...set]
      }
      let ids = []
      try { ids = await getDistinctFinishedIds(userId) } catch {}
      if (!ids.length && progress.counters.finishedUniqueIds?.length) {
        ids = [...new Set(progress.counters.finishedUniqueIds)]
      }
      progress.counters.finishedUniqueIds = ids
      progress.counters.finishedUniqueCount = ids.length
      progress.counters.finishedCount = ids.length

      try {
        const withinDay = await finishedWithinOneDay(userId, itemId || null)
        if (withinDay) progress.counters.finishedWithinDay = true
      } catch {}
      break
    }

    // first-time/flags
    case 'createdLibrary':        progress.counters.createdLibrary    = true; break
    case 'editedLibrary':         progress.counters.editedLibrary     = true; break
    case 'uploadedBook':          progress.counters.uploadedBook      = true; break
    case 'downloadedBook':        progress.counters.downloadedBook    = true; break
    case 'createdSeries':         progress.counters.createdSeries     = true; break
    case 'createdCollection':     progress.counters.createdCollection = true; break
    case 'createdPlaylist':       progress.counters.createdPlaylist   = true; break
    case 'openedAuthor':          progress.counters.openedAuthor      = true; break
    case 'openedNarrator':        progress.counters.openedNarrator    = true; break
    case 'visitedSettings':       progress.counters.visitedSettings   = true; break
    case 'visitedUpload':         progress.counters.visitedUpload     = true; break

    // 🔸 NEW: first file deletion
    case 'deletedFile':
      if (!progress.counters.deletedFirstFile) progress.counters.deletedFirstFile = true
      break

    // searches
    case 'performedSearch':
      progress.counters.performedSearch = true
      progress.counters.searchCount = (progress.counters.searchCount || 0) + 1
      break

    // login
    case 'userLoggedIn':
      updateLoginStreak(progress.counters)
      break

    default: break
  }

  const before = new Set(progress.unlocked)
  progress.unlocked = computeUnlockedFresh(progress)

  const unlockedNow = []
  const now = new Date().toISOString()
  for (const id of progress.unlocked) {
    if (!before.has(id)) {
      unlockedNow.push(catalog.badges?.[id] || { id })
      progress.history.push({ badgeId: id, unlockedAt: now })
    }
  }

  await Store.write(userId, progress)
  return { unlockedNow, progress }
}

module.exports = {
  getCatalog: loadCatalog,
  getUserProgress,
  applyEvent
}
