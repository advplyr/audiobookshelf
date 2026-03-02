#!/usr/bin/env node

const sqlite3 = require('sqlite3')
const { Client } = require('pg')

const SQLITE_PATH = process.env.SQLITE_PATH || '/config/absdatabase.sqlite'
const DATABASE_URL = process.env.DATABASE_URL
const PG_SCHEMA = process.env.PG_SCHEMA || 'public'
const BATCH_SIZE = Number(process.env.MIGRATION_BATCH_SIZE || 500)
const DRY_RUN = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true'

if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is required')
  process.exit(1)
}

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
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    return value
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

  return value
}

async function main() {
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
    const pgTables = new Set(pgTablesRows.rows.map((row) => row.table_name))

    const tablesToMigrate = sqliteTables.filter((table) => pgTables.has(table))
    tablesToMigrate.sort((a, b) => {
      const ai = preferredOrder.indexOf(a)
      const bi = preferredOrder.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

    if (!tablesToMigrate.length) {
      throw new Error('No overlapping tables found between SQLite and PostgreSQL')
    }

    console.log(`[migrate] tables to migrate: ${tablesToMigrate.join(', ')}`)

    const pgColumnsByTable = new Map()
    for (const table of tablesToMigrate) {
      const columnsResult = await pg.query(
        `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [PG_SCHEMA, table]
      )
      const columnMap = new Map(columnsResult.rows.map((column) => [column.column_name, column]))
      pgColumnsByTable.set(table, columnMap)
    }

    if (!DRY_RUN) {
      await pg.query('BEGIN')
      await pg.query('SET session_replication_role = replica')

      const truncateList = tablesToMigrate.map((table) => `${quoteIdent(PG_SCHEMA)}.${quoteIdent(table)}`).join(', ')
      await pg.query(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`)
      console.log('[migrate] truncated target tables')
    }

    for (const table of tablesToMigrate) {
      const rows = await sqliteAll(sqliteDb, `SELECT * FROM ${quoteIdent(table)}`)
      const pgColumns = pgColumnsByTable.get(table)
      const insertColumns = rows.length ? Object.keys(rows[0]).filter((column) => pgColumns.has(column)) : []

      if (!rows.length || !insertColumns.length) {
        console.log(`[migrate] ${table}: skipped (rows=${rows.length}, insertableColumns=${insertColumns.length})`)
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
              const pgColumn = pgColumns.get(column)
              params.push(convertValue(row[column], pgColumn))
              placeholders.push(`$${paramIndex++}`)
            }
            valuesSql.push(`(${placeholders.join(', ')})`)
          }

          const insertSql = `INSERT INTO ${quoteIdent(PG_SCHEMA)}.${quoteIdent(table)} (${insertColumns.map(quoteIdent).join(', ')}) VALUES ${valuesSql.join(', ')}`
          await pg.query(insertSql, params)
        }
      }

      console.log(`[migrate] ${table}: ${rows.length} rows`)
    }

    if (!DRY_RUN) {
      await pg.query('SET session_replication_role = DEFAULT')
      await pg.query('COMMIT')
      console.log('[migrate] migration transaction committed')
    }

    const parity = []
    for (const table of tablesToMigrate) {
      const sqliteCountRow = await sqliteGet(sqliteDb, `SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`)
      const pgCountResult = await pg.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdent(PG_SCHEMA)}.${quoteIdent(table)}`)
      parity.push({
        table,
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

main().catch((error) => {
  console.error('[migrate] failed:', error)
  process.exit(1)
})
