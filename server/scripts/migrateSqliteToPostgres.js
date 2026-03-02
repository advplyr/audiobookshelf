#!/usr/bin/env node

const sqlite3 = require('sqlite3')
const { Client } = require('pg')

const SQLITE_PATH = process.env.SQLITE_PATH || '/config/absdatabase.sqlite'
const DATABASE_URL = process.env.DATABASE_URL
const PG_SCHEMA = process.env.PG_SCHEMA || 'public'
const BATCH_SIZE = Number(process.env.MIGRATION_BATCH_SIZE || 500)
const DRY_RUN = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true'

const preferredOrder = [
  'migrationsMeta',
  'SequelizeMeta',
  'settings',
  'users',
  'apiKeys',
  'sessions',
  'libraries',
  'libraryFolders',
  'authors',
  'series',
  'books',
  'podcasts',
  'podcastEpisodes',
  'libraryItems',
  'bookAuthors',
  'bookSeries',
  'collections',
  'collectionBooks',
  'playlists',
  'playlistMediaItems',
  'mediaProgresses',
  'devices',
  'playbackSessions',
  'feeds',
  'feedEpisodes',
  'mediaItemShares',
  'customMetadataProviders'
]

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`
}

function openSqlite(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err)
      resolve(db)
    })
  })
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}

function sqliteGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

async function findOverlongVarcharValues(sqliteDb, tablesToMigrate, pgColumnsByTable) {
  const issues = []

  for (const { sqliteTable, postgresTable } of tablesToMigrate) {
    const pgColumns = pgColumnsByTable.get(postgresTable)
    if (!pgColumns) continue

    for (const column of pgColumns.values()) {
      if (column.data_type !== 'character varying' || !column.character_maximum_length) continue

      const sqliteColumn = column.column_name
      const maxLength = Number(column.character_maximum_length)
      const quotedTable = quoteIdent(sqliteTable)
      const quotedColumn = quoteIdent(sqliteColumn)

      try {
        const maxLengthRow = await sqliteGet(
          sqliteDb,
          `SELECT MAX(LENGTH(${quotedColumn})) AS maxLength FROM ${quotedTable} WHERE ${quotedColumn} IS NOT NULL`
        )
        const actualMaxLength = Number(maxLengthRow?.maxLength || 0)
        if (actualMaxLength <= maxLength) continue

        const overCountRow = await sqliteGet(
          sqliteDb,
          `SELECT COUNT(*) AS count FROM ${quotedTable} WHERE LENGTH(${quotedColumn}) > ?`,
          [maxLength]
        )

        issues.push({
          sqliteTable,
          sqliteColumn,
          postgresTable,
          postgresColumn: column.column_name,
          maxLength,
          actualMaxLength,
          overCount: Number(overCountRow?.count || 0)
        })
      } catch (error) {
        // Ignore columns missing in sqlite source table
      }
    }
  }

  return issues
}

function isIntegerCompatible(value) {
  if (value === null || value === undefined) return true

  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return false
    if (!/^-?\d+$/.test(trimmed)) return false
    const parsed = Number(trimmed)
    return Number.isFinite(parsed)
  }

  return false
}

async function findIntegerTypeIssues(sqliteDb, tablesToMigrate, pgColumnsByTable) {
  const issues = []

  for (const { sqliteTable, postgresTable } of tablesToMigrate) {
    const pgColumns = pgColumnsByTable.get(postgresTable)
    if (!pgColumns) continue

    for (const column of pgColumns.values()) {
      const dataType = column.data_type
      if (dataType !== 'smallint' && dataType !== 'integer' && dataType !== 'bigint') continue

      const sqliteColumn = column.column_name
      const quotedTable = quoteIdent(sqliteTable)
      const quotedColumn = quoteIdent(sqliteColumn)

      let rows
      try {
        rows = await sqliteAll(sqliteDb, `SELECT ${quotedColumn} AS value FROM ${quotedTable} WHERE ${quotedColumn} IS NOT NULL`)
      } catch (error) {
        // Ignore columns missing in sqlite source table
        continue
      }

      let badCount = 0
      let sampleValue = null
      for (const row of rows) {
        if (!isIntegerCompatible(row.value)) {
          badCount += 1
          if (sampleValue === null) sampleValue = row.value
        }
      }

      if (badCount > 0) {
        issues.push({
          sqliteTable,
          sqliteColumn,
          postgresTable,
          postgresColumn: column.column_name,
          postgresType: dataType,
          badCount,
          sampleValue
        })
      }
    }
  }

  return issues
}

function normalizeBoolean(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return v === 'true' || v === '1' || v === 't'
  }
  return !!value
}

function normalizeJson(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') return JSON.stringify(value)

  const textValue = String(value)

  try {
    const parsed = JSON.parse(textValue)
    if (typeof parsed === 'string') {
      try {
        return JSON.stringify(JSON.parse(parsed))
      } catch (error) {
        return JSON.stringify(parsed)
      }
    }
    return JSON.stringify(parsed)
  } catch (error) {
    // Keep non-JSON payloads as JSON string values so inserts remain valid JSON.
    return JSON.stringify(textValue)
  }
}

function convertValue(value, pgColumn) {
  if (!pgColumn) return value
  const dataType = pgColumn.data_type
  const udtName = pgColumn.udt_name

  if (dataType === 'boolean') {
    return normalizeBoolean(value)
  }

  if (dataType === 'json' || dataType === 'jsonb' || udtName === 'json' || udtName === 'jsonb') {
    return normalizeJson(value)
  }

  if ((dataType === 'smallint' || dataType === 'integer' || dataType === 'bigint') && value !== null && value !== undefined) {
    if (typeof value === 'number') return value
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      return Number(value)
    }
  }

  return value
}

function getOverlongColumns(row, insertColumns) {
  const overlong = []

  for (const column of insertColumns) {
    const maxLength = column.metadata.character_maximum_length
    if (!maxLength) continue

    const value = row[column.sqliteColumn]
    if (value === null || value === undefined) continue

    const length = String(value).length
    if (length > maxLength) {
      overlong.push({
        sqliteColumn: column.sqliteColumn,
        postgresColumn: column.postgresColumn,
        maxLength,
        actualLength: length
      })
    }
  }

  return overlong
}

async function main() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }

  console.log(`[migrate] sqlite source: ${SQLITE_PATH}`)
  console.log(`[migrate] postgres target schema: ${PG_SCHEMA}`)
  console.log(`[migrate] dry run: ${DRY_RUN}`)

  const sqliteDb = await openSqlite(SQLITE_PATH)
  const pg = new Client({ connectionString: DATABASE_URL })
  await pg.connect()

  try {
    const sqliteTablesRows = await sqliteAll(
      sqliteDb,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    const sqliteTables = sqliteTablesRows.map((row) => row.name)

    const pgTablesRows = await pg.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type='BASE TABLE' ORDER BY table_name`,
      [PG_SCHEMA]
    )

    const pgTablesByLowerName = new Map(pgTablesRows.rows.map((row) => [row.table_name.toLowerCase(), row.table_name]))

    const tablesToMigrate = sqliteTables
      .map((sqliteTable) => {
        const postgresTable = pgTablesByLowerName.get(sqliteTable.toLowerCase())
        if (!postgresTable) return null
        return {
          sqliteTable,
          postgresTable
        }
      })
      .filter(Boolean)

    tablesToMigrate.sort((a, b) => {
      const ai = preferredOrder.findIndex((tableName) => tableName.toLowerCase() === a.sqliteTable.toLowerCase())
      const bi = preferredOrder.findIndex((tableName) => tableName.toLowerCase() === b.sqliteTable.toLowerCase())
      if (ai === -1 && bi === -1) return a.sqliteTable.localeCompare(b.sqliteTable)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

    if (!tablesToMigrate.length) {
      throw new Error('No overlapping tables found between SQLite and PostgreSQL')
    }

    console.log(`[migrate] tables to migrate: ${tablesToMigrate.map((table) => table.sqliteTable).join(', ')}`)

    const pgColumnsByTable = new Map()
    for (const { postgresTable } of tablesToMigrate) {
      const columnsResult = await pg.query(
        `SELECT column_name, data_type, udt_name, character_maximum_length FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [PG_SCHEMA, postgresTable]
      )
      const columnMap = new Map(columnsResult.rows.map((column) => [column.column_name.toLowerCase(), column]))
      pgColumnsByTable.set(postgresTable, columnMap)
    }

    const overlongVarcharIssues = await findOverlongVarcharValues(sqliteDb, tablesToMigrate, pgColumnsByTable)
    const integerTypeIssues = await findIntegerTypeIssues(sqliteDb, tablesToMigrate, pgColumnsByTable)

    if (overlongVarcharIssues.length) {
      console.error('[migrate] overlong source values detected for varchar columns:')
      overlongVarcharIssues.forEach((issue) => {
        console.error(
          `[migrate]   ${issue.sqliteTable}.${issue.sqliteColumn} -> ${issue.postgresTable}.${issue.postgresColumn} ` +
            `(max=${issue.maxLength}, actualMax=${issue.actualMaxLength}, overRows=${issue.overCount})`
        )
      })
      throw new Error('Migration aborted to prevent truncation/data loss. Widen target column types first.')
    }

    if (integerTypeIssues.length) {
      console.error('[migrate] non-integer source values detected for integer columns:')
      integerTypeIssues.forEach((issue) => {
        console.error(
          `[migrate]   ${issue.sqliteTable}.${issue.sqliteColumn} -> ${issue.postgresTable}.${issue.postgresColumn} ` +
            `(type=${issue.postgresType}, badRows=${issue.badCount}, sample=${JSON.stringify(issue.sampleValue)})`
        )
      })
      throw new Error('Migration aborted to prevent numeric precision loss. Widen target numeric column types first.')
    }

    if (!DRY_RUN) {
      await pg.query('BEGIN')
      await pg.query('SET session_replication_role = replica')

      const truncateList = tablesToMigrate.map(({ postgresTable }) => `${quoteIdent(PG_SCHEMA)}.${quoteIdent(postgresTable)}`).join(', ')
      await pg.query(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`)
      console.log('[migrate] truncated target tables')
    }

    for (const { sqliteTable, postgresTable } of tablesToMigrate) {
      const rows = await sqliteAll(sqliteDb, `SELECT * FROM ${quoteIdent(sqliteTable)}`)
      const pgColumns = pgColumnsByTable.get(postgresTable)
      const insertColumns = rows.length
        ? Object.keys(rows[0])
            .map((sqliteColumn) => {
              const pgColumn = pgColumns.get(sqliteColumn.toLowerCase())
              if (!pgColumn) return null
              return {
                sqliteColumn,
                postgresColumn: pgColumn.column_name,
                metadata: pgColumn
              }
            })
            .filter(Boolean)
        : []

      if (!rows.length || !insertColumns.length) {
        console.log(`[migrate] ${sqliteTable}: skipped (rows=${rows.length}, insertableColumns=${insertColumns.length})`)
        continue
      }

      if (!DRY_RUN) {
        for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
          const batchRows = rows.slice(offset, offset + BATCH_SIZE)
          const valuesSql = []
          const params = []
          let paramIndex = 1

          for (const row of batchRows) {
              const placeholders = []
              for (const column of insertColumns) {
               params.push(convertValue(row[column.sqliteColumn], column.metadata))
               placeholders.push(`$${paramIndex++}`)
              }
            valuesSql.push(`(${placeholders.join(', ')})`)
          }

          const insertSql = `INSERT INTO ${quoteIdent(PG_SCHEMA)}.${quoteIdent(postgresTable)} (${insertColumns.map((column) => quoteIdent(column.postgresColumn)).join(', ')}) VALUES ${valuesSql.join(', ')}`

          try {
            await pg.query('SAVEPOINT migrate_batch')
            await pg.query(insertSql, params)
            await pg.query('RELEASE SAVEPOINT migrate_batch')
          } catch (error) {
            await pg.query('ROLLBACK TO SAVEPOINT migrate_batch')
            console.error(`[migrate] batch insert failed for ${sqliteTable} (offset=${offset}, size=${batchRows.length}): ${error.message}`)

            for (let rowIndex = 0; rowIndex < batchRows.length; rowIndex++) {
              const row = batchRows[rowIndex]
              const singleRowParams = insertColumns.map((column) => convertValue(row[column.sqliteColumn], column.metadata))
              const singleRowInsertSql = `INSERT INTO ${quoteIdent(PG_SCHEMA)}.${quoteIdent(postgresTable)} (${insertColumns.map((column) => quoteIdent(column.postgresColumn)).join(', ')}) VALUES (${singleRowParams.map((_, index) => `$${index + 1}`).join(', ')})`

              try {
                await pg.query('SAVEPOINT migrate_row')
                await pg.query(singleRowInsertSql, singleRowParams)
                await pg.query('RELEASE SAVEPOINT migrate_row')
              } catch (rowError) {
                await pg.query('ROLLBACK TO SAVEPOINT migrate_row')
                const overlongColumns = getOverlongColumns(row, insertColumns)
                if (overlongColumns.length) {
                  overlongColumns.forEach((column) => {
                    console.error(
                      `[migrate] overlong value in ${sqliteTable}.${column.sqliteColumn} -> ${postgresTable}.${column.postgresColumn} ` +
                        `(length=${column.actualLength}, max=${column.maxLength})`
                    )
                  })
                }

                throw rowError
              }
            }
          }
        }
      }

      console.log(`[migrate] ${sqliteTable}: ${rows.length} rows`)
    }

    if (!DRY_RUN) {
      await pg.query('SET session_replication_role = DEFAULT')
      await pg.query('COMMIT')
      console.log('[migrate] migration transaction committed')
    }

    const parity = []
    for (const { sqliteTable, postgresTable } of tablesToMigrate) {
      const sqliteCountRow = await sqliteGet(sqliteDb, `SELECT COUNT(*) AS count FROM ${quoteIdent(sqliteTable)}`)
      const pgCountResult = await pg.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdent(PG_SCHEMA)}.${quoteIdent(postgresTable)}`)
      parity.push({
        table: sqliteTable,
        sqliteCount: Number(sqliteCountRow.count || 0),
        postgresCount: Number(pgCountResult.rows[0].count || 0)
      })
    }

    const mismatches = parity.filter((row) => row.sqliteCount !== row.postgresCount)
    if (mismatches.length) {
      console.error('[migrate] row-count mismatches detected:')
      mismatches.forEach((row) => {
        console.error(`[migrate]   ${row.table}: sqlite=${row.sqliteCount} postgres=${row.postgresCount}`)
      })
      process.exitCode = 2
    } else {
      console.log('[migrate] parity check passed for all migrated tables')
    }
  } finally {
    sqliteDb.close()
    await pg.end()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[migrate] failed:', error)
    process.exit(1)
  })
}

module.exports = {
  normalizeJson,
  isIntegerCompatible,
  convertValue,
  findOverlongVarcharValues,
  findIntegerTypeIssues,
  quoteIdent
}
