const { expect } = require('chai')
const Path = require('path')
const Backup = require('../../../server/objects/Backup')
const { version } = require('../../../package.json')

describe('Backup', () => {
  it('starts with empty fields and preserves the JSON shape', () => {
    const backup = new Backup()

    expect(backup.toJSON()).to.deep.equal({
      id: null,
      key: null,
      backupDirPath: null,
      datePretty: null,
      fullPath: null,
      path: null,
      filename: null,
      fileSize: null,
      createdAt: null,
      serverVersion: null
    })
    expect(backup.detailsString).to.equal('\n\n\n')
  })

  it('constructs and serializes a stored backup', () => {
    const fullPath = Path.join('metadata', 'backups', 'stored.audiobookshelf')
    const backup = new Backup({ details: ['stored', 'sqlite', '1700000000000', '2.37.1'], fullPath })
    backup.fileSize = 42

    expect(backup.toJSON()).to.deep.equal({
      id: 'stored',
      key: 'sqlite',
      backupDirPath: Path.dirname(fullPath),
      datePretty: backup.datePretty,
      fullPath,
      path: Path.join('backups', 'stored.audiobookshelf'),
      filename: 'stored.audiobookshelf',
      fileSize: 42,
      createdAt: 1700000000000,
      serverVersion: '2.37.1'
    })
    expect(backup.datePretty).to.be.a('string').and.not.empty
    expect(backup.detailsString).to.equal('stored\nsqlite\n1700000000000\n2.37.1')
  })

  it('normalizes both legacy string and numeric key 1 without losing old backup fields', () => {
    const fullPath = Path.join('metadata', 'backups', 'legacy.audiobookshelf')

    for (const legacyKey of ['1', 1]) {
      const backup = new Backup({ details: ['legacy', legacyKey, '0'], fullPath })

      expect(backup.key).to.equal(null)
      expect(backup.serverVersion).to.equal(null)
      expect(backup.createdAt).to.equal(0)
      expect(backup.detailsString).to.equal('legacy\n\n0\n')
      expect(backup.toJSON()).to.include({ key: null, serverVersion: null, createdAt: 0 })
    }
  })

  it('sets new backup metadata and keeps the existing archive format', () => {
    const backup = new Backup()
    const backupDirPath = Path.join('metadata', 'backups')
    const before = Date.now()

    backup.setData(backupDirPath)

    expect(backup.id).to.match(/^\d{4}-\d{2}-\d{2}T\d{4}$/)
    expect(backup.key).to.equal('sqlite')
    expect(backup.filename).to.equal(`${backup.id}.audiobookshelf`)
    expect(backup.path).to.equal(Path.join('backups', backup.filename))
    expect(backup.fullPath).to.equal(Path.join(backupDirPath, backup.filename))
    expect(backup.serverVersion).to.equal(version)
    expect(backup.createdAt).to.be.within(before, Date.now())
    expect(backup.detailsString).to.equal([backup.id, 'sqlite', backup.createdAt, version].join('\n'))
  })
})
