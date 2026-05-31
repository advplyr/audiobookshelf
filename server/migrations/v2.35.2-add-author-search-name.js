const { Sequelize } = require('sequelize')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.35.2'
const migrationName = `${migrationVersion}-add-author-search-name`
const loggerPrefix = `[${migrationVersion} migration]`
const AUTHORS_TABLE = 'authors'
const BOOK_AUTHORS_TABLE = 'bookAuthors'
const LIBRARY_ITEMS_TABLE = 'libraryItems'
const AUTHOR_SEARCH_INDEX = 'author_search_name'
const AUTHOR_LAST_FIRST_INDEX = 'author_last_first'
const UNIQUE_SEARCH_INDEX = 'unique_author_search_name_per_library'

/**
 * Remove all punctionation, diacritics, and whitespace and convert to lowercase for searching and matching
 * (copied from Author model to ensure consistent normalization between the migration and the model)
 * @param {string} name
 * @returns {string}
 */
function normalizeSearchName(name) {
  if (!name?.trim()) return null
  return name
    .normalize('NFKC') // Standardize compatibility characters
    .normalize('NFD') // Split accents into combining marks
    .toLocaleLowerCase('und')
    .replace(/[\p{P}\p{Z}\p{M}\s]+/gu, '') // Remove punctuation, whitespace, and diacritics
    .trim()
}

/**
 * Calculate derived fields. Returns null if name is empty after normalization
 * (copied from Author model to ensure consistent normalization between the migration and the model)
 * @param {string} name
 * @returns { lastFirst: string?, searchName: string? }
 */
function buildAuthorDerivedFields(name) {
  const searchName = normalizeSearchName(name)
  if (!searchName) {
    return {
      lastFirst: null, // populated after migration complete by server startup
      searchName: null
    }
  }

  return {
    lastFirst: null, // populated after migration complete by server startup
    searchName
  }
}

async function indexExists(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName)
  return indexes.some((index) => index.name === indexName)
}

async function addIndexIfMissing(queryInterface, logger, tableName, indexName, options, transaction = null) {
  if (await indexExists(queryInterface, tableName, indexName)) {
    logger.info(`${loggerPrefix} index "${indexName}" already exists on "${tableName}"`)
    return
  }

  logger.info(`${loggerPrefix} adding index "${indexName}" on "${tableName}"`)
  await queryInterface.addIndex(tableName, options.fields, {
    ...options,
    name: indexName,
    transaction
  })
}

async function removeIndexIfPresent(queryInterface, logger, tableName, indexName) {
  if (!(await indexExists(queryInterface, tableName, indexName))) {
    logger.info(`${loggerPrefix} index "${indexName}" does not exist on "${tableName}"`)
    return
  }

  logger.info(`${loggerPrefix} removing index "${indexName}" from "${tableName}"`)
  await queryInterface.removeIndex(tableName, indexName)
}

async function backfillAuthorSearchName(queryInterface, logger, transaction, offset = 0) {
  while (true) {
    const authors = await queryInterface.sequelize.query(`SELECT id, name FROM ${AUTHORS_TABLE} ORDER BY id ASC LIMIT :limit OFFSET :offset`, {
      replacements: { limit: 500, offset },
      type: Sequelize.QueryTypes.SELECT,
      transaction
    })

    if (!authors.length) return

    logger.info(`${loggerPrefix} backfilling derived author fields for ${authors.length} authors`)
    for (const author of authors) {
      const derivedFields = buildAuthorDerivedFields(author.name)
      await queryInterface.sequelize.query(
        `UPDATE ${AUTHORS_TABLE}
         SET lastFirst = :lastFirst,
             searchName = :searchName
       WHERE id = :id`,
        {
          replacements: {
            id: author.id,
            lastFirst: derivedFields.lastFirst,
            searchName: derivedFields.searchName
          },
          transaction
        }
      )
    }

    if (authors.length < 500) {
      return
    }
    offset += 500
  }
}

function compareAuthorsForMerge(left, right) {
  const leftHasAsin = !!left.asin?.trim()
  const rightHasAsin = !!right.asin?.trim()
  if (leftHasAsin !== rightHasAsin) return leftHasAsin ? -1 : 1

  const leftHasDescription = !!left.description?.trim()
  const rightHasDescription = !!right.description?.trim()
  if (leftHasDescription !== rightHasDescription) return leftHasDescription ? -1 : 1

  const leftCreatedAt = Number.isFinite(new Date(left.createdAt).getTime()) ? new Date(left.createdAt).getTime() : Number.MAX_SAFE_INTEGER
  const rightCreatedAt = Number.isFinite(new Date(right.createdAt).getTime()) ? new Date(right.createdAt).getTime() : Number.MAX_SAFE_INTEGER
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt

  return String(left.id).localeCompare(String(right.id))
}

async function mergeDuplicateAuthors(queryInterface, logger, transaction) {
  const authors = await queryInterface.sequelize.query(
    `SELECT id, name, asin, description, createdAt, libraryId, searchName
       FROM ${AUTHORS_TABLE}
      WHERE searchName IS NOT NULL AND searchName != ''
      ORDER BY libraryId ASC, searchName ASC, createdAt ASC, id ASC`,
    {
      type: Sequelize.QueryTypes.SELECT,
      transaction
    }
  )

  const duplicateGroups = new Map()
  for (const author of authors) {
    const key = `${author.libraryId}::${author.searchName}`
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, [])
    duplicateGroups.get(key).push(author)
  }

  const groupsToMerge = [...duplicateGroups.values()].filter((authorsInGroup) => authorsInGroup.length > 1)
  if (!groupsToMerge.length) {
    logger.info(`${loggerPrefix} no duplicate authors found to merge`)
    return
  }

  logger.info(`${loggerPrefix} merging ${groupsToMerge.length} duplicate author groups`)

  for (const authorsInGroup of groupsToMerge) {
    const survivors = [...authorsInGroup].sort(compareAuthorsForMerge)
    const survivor = survivors[0]
    const duplicateIds = survivors.slice(1).map((author) => author.id)
    if (!duplicateIds.length) continue

    logger.info(`${loggerPrefix} merging duplicate authors in library ${survivor.libraryId} for searchName "${survivor.searchName}" into "${survivor.id}"`)

    await queryInterface.sequelize.query(
      `UPDATE ${BOOK_AUTHORS_TABLE}
          SET authorId = :survivorId
        WHERE authorId IN (:duplicateIds)`,
      {
        replacements: {
          survivorId: survivor.id,
          duplicateIds
        },
        transaction
      }
    )

    await queryInterface.sequelize.query(
      `DELETE FROM ${AUTHORS_TABLE}
        WHERE id IN (:duplicateIds)`,
      {
        replacements: {
          duplicateIds
        },
        transaction
      }
    )
  }
}

async function cleanupDuplicateBookAuthors(queryInterface, transaction) {
  const bookAuthorsTableDescription = await queryInterface.describeTable(BOOK_AUTHORS_TABLE)
  if (!bookAuthorsTableDescription?.authorId) return

  await queryInterface.sequelize.query(
    `DELETE FROM ${BOOK_AUTHORS_TABLE}
      WHERE EXISTS (
        SELECT 1
        FROM ${BOOK_AUTHORS_TABLE} AS duplicateBookAuthors
        WHERE duplicateBookAuthors.bookId = ${BOOK_AUTHORS_TABLE}.bookId
          AND duplicateBookAuthors.authorId = ${BOOK_AUTHORS_TABLE}.authorId
          AND (
            duplicateBookAuthors.createdAt < ${BOOK_AUTHORS_TABLE}.createdAt
            OR (
              duplicateBookAuthors.createdAt = ${BOOK_AUTHORS_TABLE}.createdAt
              AND duplicateBookAuthors.id < ${BOOK_AUTHORS_TABLE}.id
            )
          )
      )`,
    {
      transaction
    }
  )
}

async function refreshLibraryItemAuthorNames(queryInterface, transaction) {
  const libraryItemsTableDescription = await queryInterface.describeTable(LIBRARY_ITEMS_TABLE)
  if (!libraryItemsTableDescription?.authorNamesFirstLast || !libraryItemsTableDescription?.authorNamesLastFirst) return

  await queryInterface.sequelize.query(
    `UPDATE ${LIBRARY_ITEMS_TABLE}
        SET (authorNamesFirstLast, authorNamesLastFirst) = (
          SELECT GROUP_CONCAT(authors.name, ', ' ORDER BY bookAuthors.createdAt ASC),
                 GROUP_CONCAT(authors.lastFirst, ', ' ORDER BY bookAuthors.createdAt ASC)
          FROM authors JOIN bookAuthors ON authors.id = bookAuthors.authorId
          WHERE bookAuthors.bookId = ${LIBRARY_ITEMS_TABLE}.mediaId
        )
      WHERE mediaType = 'book'`,
    {
      transaction
    }
  )
}

/**
 * This upward migration adds a searchName column to authors and indexes the
 * derived fields used for normalized lookup and sorting.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  const tableDescription = await queryInterface.describeTable(AUTHORS_TABLE)

  await queryInterface.sequelize.transaction(async (transaction) => {
    if (!tableDescription.searchName) {
      logger.info(`${loggerPrefix} adding column "searchName" to "${AUTHORS_TABLE}"`)
      await queryInterface.addColumn(
        AUTHORS_TABLE,
        'searchName',
        {
          type: Sequelize.DataTypes.STRING
        },
        {
          transaction
        }
      )
    } else {
      logger.info(`${loggerPrefix} column "searchName" already exists on "${AUTHORS_TABLE}"`)
    }

    if (!tableDescription.lastFirst) {
      logger.info(`${loggerPrefix} adding column "lastFirst" to "${AUTHORS_TABLE}"`)
      await queryInterface.addColumn(
        AUTHORS_TABLE,
        'lastFirst',
        {
          type: Sequelize.DataTypes.STRING
        },
        {
          transaction
        }
      )
    }

    await backfillAuthorSearchName(queryInterface, logger, transaction, 0)
    await mergeDuplicateAuthors(queryInterface, logger, transaction)
    await cleanupDuplicateBookAuthors(queryInterface, transaction)
    await refreshLibraryItemAuthorNames(queryInterface, transaction)

    await addIndexIfMissing(
      queryInterface,
      logger,
      AUTHORS_TABLE,
      AUTHOR_LAST_FIRST_INDEX,
      {
        fields: [{ name: 'lastFirst', collate: 'NOCASE' }]
      },
      transaction
    )

    await addIndexIfMissing(
      queryInterface,
      logger,
      AUTHORS_TABLE,
      AUTHOR_SEARCH_INDEX,
      {
        fields: [{ name: 'searchName', collate: 'NOCASE' }]
      },
      transaction
    )

    await addIndexIfMissing(
      queryInterface,
      logger,
      AUTHORS_TABLE,
      UNIQUE_SEARCH_INDEX,
      {
        fields: ['searchName', 'libraryId'],
        unique: true
      },
      transaction
    )
  })

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration removes the searchName column and indexes added by the
 * upward migration.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  await removeIndexIfPresent(queryInterface, logger, AUTHORS_TABLE, UNIQUE_SEARCH_INDEX)
  await removeIndexIfPresent(queryInterface, logger, AUTHORS_TABLE, AUTHOR_SEARCH_INDEX)
  await removeIndexIfPresent(queryInterface, logger, AUTHORS_TABLE, AUTHOR_LAST_FIRST_INDEX)

  const tableDescription = await queryInterface.describeTable(AUTHORS_TABLE)
  if (tableDescription.searchName) {
    logger.info(`${loggerPrefix} removing column "searchName" from "${AUTHORS_TABLE}"`)
    await queryInterface.removeColumn(AUTHORS_TABLE, 'searchName')
  } else {
    logger.info(`${loggerPrefix} column "searchName" does not exist on "${AUTHORS_TABLE}"`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
