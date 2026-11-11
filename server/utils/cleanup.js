const sequelize = require('sequelize')
const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')
const RssFeedManager = require('../managers/RssFeedManager')

/**
 * After deleting book(s), remove empty series
 *
 * @param {string[]} seriesIds
 */
async function checkRemoveEmptySeries(seriesIds) {
  if (!seriesIds?.length) return

  const transaction = await Database.sequelize.transaction()
  try {
    const seriesToRemove = (
      await Database.seriesModel.findAll({
        where: [
          {
            id: seriesIds
          },
          sequelize.where(sequelize.literal('(SELECT count(*) FROM bookSeries bs WHERE bs.seriesId = series.id)'), 0)
        ],
        attributes: ['id', 'name', 'libraryId'],
        include: {
          model: Database.bookModel,
          attributes: ['id'],
          required: false // Ensure it includes series even if no books exist
        },
        transaction
      })
    ).map((s) => ({ id: s.id, name: s.name, libraryId: s.libraryId }))

    if (seriesToRemove.length) {
      await Database.seriesModel.destroy({
        where: {
          id: seriesToRemove.map((s) => s.id)
        },
        transaction
      })
    }

    await transaction.commit()

    seriesToRemove.forEach(({ id, name, libraryId }) => {
      Logger.info(`[ApiRouter] Series "${name}" is now empty. Removing series`)

      // Remove series from library filter data
      Database.removeSeriesFromFilterData(libraryId, id)
      SocketAuthority.emitter('series_removed', { id: id, libraryId: libraryId })
    })
    // Close rss feeds - remove from db and emit socket event
    if (seriesToRemove.length) {
      await RssFeedManager.closeFeedsForEntityIds(seriesToRemove.map((s) => s.id))
    }
  } catch (error) {
    await transaction.rollback()
    Logger.error(`[ApiRouter] Error removing empty series: ${error.message}`)
  }
}

/**
 * Remove authors with no books and unset asin, description and imagePath
 * Note: Other implementation is in BookScanner.checkAuthorsRemovedFromBooks (can be merged)
 *
 * @param {string[]} authorIds
 * @returns {Promise<void>}
 */
async function checkRemoveAuthorsWithNoBooks(authorIds) {
  if (!authorIds?.length) return

  const transaction = await Database.sequelize.transaction()
  try {
    // Select authors with locking to prevent concurrent updates
    const bookAuthorsToRemove = (
      await Database.authorModel.findAll({
        where: [
          {
            id: authorIds,
            asin: {
              [sequelize.Op.or]: [null, '']
            },
            description: {
              [sequelize.Op.or]: [null, '']
            },
            imagePath: {
              [sequelize.Op.or]: [null, '']
            }
          },
          sequelize.where(sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 0)
        ],
        attributes: ['id', 'name', 'libraryId'],
        raw: true,
        transaction
      })
    ).map((au) => ({ id: au.id, name: au.name, libraryId: au.libraryId }))

    if (bookAuthorsToRemove.length) {
      await Database.authorModel.destroy({
        where: {
          id: bookAuthorsToRemove.map((au) => au.id)
        },
        transaction
      })
    }

    await transaction.commit()

    // Remove all book authors after completing remove from database
    bookAuthorsToRemove.forEach(({ id, name, libraryId }) => {
      Database.removeAuthorFromFilterData(libraryId, id)
      // TODO: Clients were expecting full author in payload but its unnecessary
      SocketAuthority.emitter('author_removed', { id, libraryId })
      Logger.info(`[ApiRouter] Removed author "${name}" with no books`)
    })
  } catch (error) {
    await transaction.rollback()
    Logger.error(`[ApiRouter] Error removing authors: ${error.message}`)
  }
}

module.exports = {
  checkRemoveEmptySeries,
  checkRemoveAuthorsWithNoBooks
}
