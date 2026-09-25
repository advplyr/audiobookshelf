const { QueryTypes } = require('sequelize')

const Database = require('../../Database')
const libraryItemsBookFilters = require('./libraryItemsBookFilters')

const collectionSortExpressions = new Map([
  ['name', 'c.name COLLATE NOCASE'],
  ['createdAt', 'c.createdAt'],
  ['updatedAt', 'c.updatedAt']
])

function escapeLike(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Build the SQL predicate used to restrict books for explicit content and tags.
 *
 * @param {import('../../models/User')} user
 * @returns {{ sql:string, replacements:object }}
 */
function getVisibleBookSql(user) {
  const { bookWhere, replacements } = libraryItemsBookFilters.getUserPermissionBookWhereQuery(user)

  // Raw SQL is needed because the same permission predicate applies before pagination, count, and preview selection.
  const sql = Database.sequelize.getQueryInterface().queryGenerator.whereItemsQuery(bookWhere)
  return {
    sql: sql || '1 = 1',
    replacements
  }
}

module.exports = {
  /**
   * Get compact collection summaries for a library.
   *
   * @param {object} options
   * @param {string} options.libraryId
   * @param {import('../../models/User')} options.user
   * @param {number} options.page
   * @param {number} options.limit
   * @param {string} options.sort
   * @param {boolean} options.desc
   * @param {string} options.filter
   * @returns {Promise<{ results:object[], total:number }>}
   */
  async getCollectionSummaries({ libraryId, user, page, limit, sort, desc, filter }) {
    const direction = desc ? 'DESC' : 'ASC'
    const sortExpression = collectionSortExpressions.get(sort)
    if (!sortExpression) throw new Error(`[collectionFilters] Unsupported collection summary sort: ${sort}`)
    const visibleBook = getVisibleBookSql(user)
    const filterSql = filter ? "AND LOWER(c.name) LIKE LOWER(:filter) ESCAPE '\\'" : ''
    const replacements = {
      ...visibleBook.replacements,
      libraryId,
      limit,
      offset: page * limit,
      ...(filter ? { filter: `%${escapeLike(filter)}%` } : {})
    }
    const visibleMembershipSql = `
      FROM collectionBooks cb
      JOIN books b ON b.id = cb.bookId
      WHERE cb.collectionId = c.id AND ${visibleBook.sql}`
    const collectionVisibilitySql = `
      (NOT EXISTS (SELECT 1 FROM collectionBooks cb WHERE cb.collectionId = c.id)
       OR EXISTS (SELECT 1 ${visibleMembershipSql}))`

    const results = await Database.sequelize.query(
      `SELECT c.id, c.libraryId, c.name, c.description, c.createdAt, c.updatedAt,
              (SELECT COUNT(*) ${visibleMembershipSql}) AS numBooks
         FROM collections c
        WHERE c.libraryId = :libraryId ${filterSql}
          AND ${collectionVisibilitySql}
        ORDER BY ${sortExpression} ${direction}, c.id ${direction}
        LIMIT :limit OFFSET :offset`,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    )

    const [{ total }] = await Database.sequelize.query(
      `SELECT COUNT(*) AS total FROM collections c
        WHERE c.libraryId = :libraryId ${filterSql}
          AND ${collectionVisibilitySql}`,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    )

    // Load the two ordered previews for every result in one query.
    const previews = results.length
      ? await Database.sequelize.query(
          `WITH rankedPreviews AS (
             SELECT cb.collectionId, li.id, b.coverPath,
                    ROW_NUMBER() OVER (PARTITION BY cb.collectionId ORDER BY cb."order" ASC, cb.bookId ASC) AS previewRank
               FROM collectionBooks cb
               JOIN books b ON b.id = cb.bookId
               JOIN libraryItems li ON li.libraryId = :libraryId AND li.mediaId = b.id AND li.mediaType = 'book'
              WHERE cb.collectionId IN (:collectionIds) AND ${visibleBook.sql}
           )
           SELECT collectionId, id, coverPath
             FROM rankedPreviews
            WHERE previewRank <= 2
            ORDER BY collectionId ASC, previewRank ASC`,
          {
            replacements: {
              ...visibleBook.replacements,
              libraryId,
              collectionIds: results.map((collection) => collection.id)
            },
            type: QueryTypes.SELECT
          }
        )
      : []

    const previewsByCollection = new Map()
    for (const preview of previews) {
      const items = previewsByCollection.get(preview.collectionId) || []
      items.push({
        id: preview.id,
        media: {
          coverPath: preview.coverPath
        }
      })
      previewsByCollection.set(preview.collectionId, items)
    }

    for (const collection of results) {
      collection.numBooks = Number(collection.numBooks)
      collection.createdAt = new Date(collection.createdAt).valueOf()
      collection.updatedAt = new Date(collection.updatedAt).valueOf()
      collection.previewItems = previewsByCollection.get(collection.id) || []
    }

    return {
      results,
      total: Number(total)
    }
  }
}
