const globals = require('../globals')
const Database = require('../../Database')

/**
 * Union of supported audio and ebook file extensions, without leading dot
 */
const fileSearchExtensions = [...globals.SupportedAudioTypes, ...globals.SupportedEbookTypes]

/**
 * Maximum number of library item ids returned by getFileMatchIds
 */
const maxFileMatchIds = 1000

/**
 * Check if a search query looks like a file name, i.e. ends with a known audio or ebook extension
 * @param {string} query
 * @returns {boolean}
 */
function isFileSearchQuery(query) {
  if (!query || typeof query !== 'string') return false
  const trimmedQuery = query.trim().toLowerCase()
  const dotIndex = trimmedQuery.lastIndexOf('.')
  if (dotIndex < 0) return false
  return fileSearchExtensions.includes(trimmedQuery.slice(dotIndex + 1))
}

/**
 * Get ids of library items in the library that have a file path or folder path matching the text search query
 * @param {string} libraryId
 * @param {TextSearchQuery} textSearchQuery
 * @returns {Promise<string[]>}
 */
async function getFileMatchIds(libraryId, textSearchQuery) {
  const matchFilePath = textSearchQuery.matchExpression(`json_extract(lf.value, '$.metadata.path')`)
  const [fileRows] = await Database.sequelize.query(`SELECT DISTINCT li.id FROM libraryItems li, json_each(li.libraryFiles) lf WHERE json_valid(li.libraryFiles) AND li.libraryId = :libraryId AND ${matchFilePath} LIMIT ${maxFileMatchIds};`, {
    replacements: {
      libraryId
    },
    raw: true
  })

  const matchItemPath = textSearchQuery.matchExpression('path')
  const [pathRows] = await Database.sequelize.query(`SELECT id FROM libraryItems WHERE libraryId = :libraryId AND ${matchItemPath} LIMIT ${maxFileMatchIds};`, {
    replacements: {
      libraryId
    },
    raw: true
  })

  return [...new Set([...fileRows.map((row) => row.id), ...pathRows.map((row) => row.id)])]
}

module.exports = {
  isFileSearchQuery,
  getFileMatchIds
}
