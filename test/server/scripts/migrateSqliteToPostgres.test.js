const { expect } = require('chai')
const sqlite3 = require('sqlite3')

const {
  normalizeJson,
  isIntegerCompatible,
  convertValue,
  findOverlongVarcharValues,
  findIntegerTypeIssues
} = require('../../../server/scripts/migrateSqliteToPostgres')

function openMemoryDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(':memory:', (error) => {
      if (error) return reject(error)
      resolve(db)
    })
  })
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) return reject(error)
      resolve()
    })
  })
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) return reject(error)
      resolve()
    })
  })
}

describe('migrateSqliteToPostgres script helpers', () => {
  it('should keep malformed JSON payloads insertable by returning valid JSON text', () => {
    const malformed = '"{"x",1}"'
    const normalized = normalizeJson(malformed)

    expect(() => JSON.parse(normalized)).to.not.throw()
    expect(JSON.parse(normalized)).to.equal('"{"x",1}"')
  })

  it('should detect overlong varchar values before migration', async () => {
    const db = await openMemoryDb()

    try {
      await run(db, 'CREATE TABLE books (subtitle TEXT)')
      await run(db, 'INSERT INTO books (subtitle) VALUES (?)', ['x'.repeat(300)])
      await run(db, 'INSERT INTO books (subtitle) VALUES (?)', ['ok'])

      const tablesToMigrate = [{ sqliteTable: 'books', postgresTable: 'books' }]
      const pgColumnsByTable = new Map([
        [
          'books',
          new Map([
            [
              'subtitle',
              {
                column_name: 'subtitle',
                data_type: 'character varying',
                character_maximum_length: 255
              }
            ]
          ])
        ]
      ])

      const issues = await findOverlongVarcharValues(db, tablesToMigrate, pgColumnsByTable)

      expect(issues).to.have.length(1)
      expect(issues[0]).to.include({
        sqliteTable: 'books',
        sqliteColumn: 'subtitle',
        postgresTable: 'books',
        postgresColumn: 'subtitle',
        maxLength: 255,
        actualMaxLength: 300,
        overCount: 1
      })
    } finally {
      await close(db)
    }
  })

  it('should detect non-integer values for integer target columns', async () => {
    const db = await openMemoryDb()

    try {
      await run(db, 'CREATE TABLE playbackSessions (timeListening REAL)')
      await run(db, 'INSERT INTO playbackSessions (timeListening) VALUES (?)', [25.802536999999997])
      await run(db, 'INSERT INTO playbackSessions (timeListening) VALUES (?)', [42])

      const tablesToMigrate = [{ sqliteTable: 'playbackSessions', postgresTable: 'playbackSessions' }]
      const pgColumnsByTable = new Map([
        [
          'playbackSessions',
          new Map([
            [
              'timelistening',
              {
                column_name: 'timeListening',
                data_type: 'integer'
              }
            ]
          ])
        ]
      ])

      const issues = await findIntegerTypeIssues(db, tablesToMigrate, pgColumnsByTable)

      expect(issues).to.have.length(1)
      expect(issues[0].sqliteTable).to.equal('playbackSessions')
      expect(issues[0].sqliteColumn).to.equal('timeListening')
      expect(issues[0].postgresType).to.equal('integer')
      expect(issues[0].badCount).to.equal(1)
    } finally {
      await close(db)
    }
  })

  it('should only accept integer-compatible values for integer columns', () => {
    expect(isIntegerCompatible(10)).to.equal(true)
    expect(isIntegerCompatible('10')).to.equal(true)
    expect(isIntegerCompatible(10.5)).to.equal(false)
    expect(isIntegerCompatible('10.5')).to.equal(false)
  })

  it('should coerce integer-like strings for postgres integer columns', () => {
    expect(convertValue('42', { data_type: 'integer' })).to.equal(42)
    expect(convertValue('-7', { data_type: 'bigint' })).to.equal(-7)
    expect(convertValue('4.2', { data_type: 'integer' })).to.equal('4.2')
  })

  it('should always return valid json text for postgres json columns', () => {
    const convertedObject = convertValue({ a: 1 }, { data_type: 'jsonb', udt_name: 'jsonb' })
    const convertedMalformed = convertValue('"{"x",1}"', { data_type: 'jsonb', udt_name: 'jsonb' })

    expect(JSON.parse(convertedObject)).to.deep.equal({ a: 1 })
    expect(JSON.parse(convertedMalformed)).to.equal('"{"x",1}"')
  })
})
