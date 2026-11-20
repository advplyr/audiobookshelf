const { literal } = require('sequelize')

/**
 * Sort legacy blank sequences like NULL, without treating the valid sequence "0" as missing.
 * @param {string} column Internal SQL column alias, never user input
 * @param {boolean} sortDesc
 */
function seriesSequenceOrder(column, sortDesc = false) {
  const direction = sortDesc ? 'DESC NULLS FIRST' : 'ASC NULLS LAST'
  // SQLite's default TRIM only removes spaces; include tabs and line breaks as well.
  return literal(`CAST(NULLIF(TRIM(\`${column}\`, CHAR(9, 10, 11, 12, 13, 32)), '') AS FLOAT) ${direction}`)
}

module.exports = seriesSequenceOrder
