const { expect, config } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')
const fs = require('../../../server/libs/fsExtra')
const Logger = require('../../../server/Logger')
const MigrationManager = require('../../../server/managers/MigrationManager')
const { Umzug, memoryStorage } = require('umzug')
const path = require('path')

describe('MigrationManager', () => {
  let sequelizeStub
  let umzugStub
  let migrationManager
  let loggerInfoStub
  let loggerErrorStub
  let fsCopyStub
  let fsMoveStub
  let fsRemoveStub
  let fsEnsureDirStub
  let fsPathExistsStub
  let processExitStub
  let configPath = 'path/to/config'

  const serverVersion = '1.2.0'

  beforeEach(() => {
    sequelizeStub = sinon.createStubInstance(Sequelize)
    umzugStub = {
      migrations: sinon.stub(),
      executed: sinon.stub(),
      up: sinon.stub(),
      down: sinon.stub()
    }
    sequelizeStub.getQueryInterface.returns({})
    migrationManager = new MigrationManager(sequelizeStub, configPath)
    migrationManager.fetchVersionsFromDatabase = sinon.stub().resolves()
    migrationManager.copyMigrationsToConfigDir = sinon.stub().resolves()
    migrationManager.updateMaxVersion = sinon.stub().resolves()
    migrationManager.umzug = umzugStub
    loggerInfoStub = sinon.stub(Logger, 'info')
    loggerErrorStub = sinon.stub(Logger, 'error')
    fsCopyStub = sinon.stub(fs, 'copy').resolves()
    fsMoveStub = sinon.stub(fs, 'move').resolves()
    fsRemoveStub = sinon.stub(fs, 'remove').resolves()
    fsEnsureDirStub = sinon.stub(fs, 'ensureDir').resolves()
    fsPathExistsStub = sinon.stub(fs, 'pathExists').resolves(true)
    processExitStub = sinon.stub(process, 'exit')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('runMigrations', () => {
    it('should run up migrations successfully', async () => {
      // Arrange
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'

      umzugStub.migrations.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }])
      umzugStub.executed.resolves([{ name: 'v1.1.0-migration.js' }])

      // Act
      await migrationManager.runMigrations('1.2.0')

      // Assert
      expect(migrationManager.fetchVersionsFromDatabase.calledOnce).to.be.true
      expect(migrationManager.copyMigrationsToConfigDir.calledOnce).to.be.true
      expect(migrationManager.updateMaxVersion.calledOnce).to.be.true
      expect(umzugStub.up.calledOnce).to.be.true
      expect(umzugStub.up.calledWith({ migrations: ['v1.1.1-migration.js', 'v1.2.0-migration.js'] })).to.be.true
      expect(fsCopyStub.calledOnce).to.be.true
      expect(fsCopyStub.calledWith(path.join(configPath, 'absdatabase.sqlite'), path.join(configPath, 'absdatabase.backup.sqlite'))).to.be.true
      expect(fsRemoveStub.calledOnce).to.be.true
      expect(fsRemoveStub.calledWith(path.join(configPath, 'absdatabase.backup.sqlite'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Migrations successfully applied'))).to.be.true
    })

    it('should run down migrations successfully', async () => {
      // Arrange
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.maxVersion = '1.2.0'

      umzugStub.migrations.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }])
      umzugStub.executed.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }])

      // Act
      await migrationManager.runMigrations('1.1.0')

      // Assert
      expect(migrationManager.fetchVersionsFromDatabase.calledOnce).to.be.true
      expect(migrationManager.copyMigrationsToConfigDir.called).to.be.false
      expect(migrationManager.updateMaxVersion.called).to.be.false
      expect(umzugStub.down.calledOnce).to.be.true
      expect(umzugStub.down.calledWith({ migrations: ['v1.2.0-migration.js', 'v1.1.1-migration.js'] })).to.be.true
      expect(fsCopyStub.calledOnce).to.be.true
      expect(fsCopyStub.calledWith(path.join(configPath, 'absdatabase.sqlite'), path.join(configPath, 'absdatabase.backup.sqlite'))).to.be.true
      expect(fsRemoveStub.calledOnce).to.be.true
      expect(fsRemoveStub.calledWith(path.join(configPath, 'absdatabase.backup.sqlite'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Migrations successfully applied'))).to.be.true
    })

    it('should log that no migrations are needed if serverVersion equals databaseVersion', async () => {
      // Arrange
      migrationManager.serverVersion = '1.2.0'
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.maxVersion = '1.2.0'

      // Act
      await migrationManager.runMigrations(serverVersion)

      // Assert
      expect(umzugStub.up.called).to.be.false
      expect(loggerInfoStub.calledWith(sinon.match('Database is already up to date.'))).to.be.true
    })

    it('should handle migration failure and restore the original database', async () => {
      // Arrange
      migrationManager.serverVersion = '1.2.0'
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'

      umzugStub.migrations.resolves([{ name: 'v1.2.0-migration.js' }])
      umzugStub.executed.resolves([{ name: 'v1.1.0-migration.js' }])
      umzugStub.up.rejects(new Error('Migration failed'))

      const originalDbPath = path.join(configPath, 'absdatabase.sqlite')
      const backupDbPath = path.join(configPath, 'absdatabase.backup.sqlite')

      // Act
      await migrationManager.runMigrations(serverVersion)

      // Assert
      expect(umzugStub.up.calledOnce).to.be.true
      expect(loggerErrorStub.calledWith(sinon.match('Migration failed'))).to.be.true
      expect(fsMoveStub.calledWith(originalDbPath, sinon.match('absdatabase.failed.sqlite'), { overwrite: true })).to.be.true
      expect(fsMoveStub.calledWith(backupDbPath, originalDbPath, { overwrite: true })).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Restored the original database'))).to.be.true
      expect(processExitStub.calledOnce).to.be.true
    })
  })

  describe('init', () => {
    it('should throw error if serverVersion is not provided', async () => {
      // Act
      try {
        const result = await migrationManager.init()
        expect.fail('Expected init to throw an error, but it did not.')
      } catch (error) {
        expect(error.message).to.equal('Invalid server version: undefined. Expected a version tag like v1.2.3.')
      }
    })

    it('should initialize the MigrationManager', async () => {
      // arrange
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'
      migrationManager.umzug = null
      migrationManager.configPath = __dirname

      // Act
      await migrationManager.init(serverVersion, memoryStorage())

      // Assert
      expect(migrationManager.serverVersion).to.equal('1.2.0')
      expect(migrationManager.sequelize).to.equal(sequelizeStub)
      expect(migrationManager.umzug).to.be.an.instanceOf(Umzug)
      expect((await migrationManager.umzug.migrations()).map((m) => m.name)).to.deep.equal(['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.10.0-migration.js'])
    })
  })

  describe('fetchVersionsFromDatabase', () => {
    it('should fetch versions from a real database', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const serverSettings = { version: 'v1.1.0', maxVersion: 'v1.1.0' }
      // Create a settings table with a single row
      await sequelize.query('CREATE TABLE settings (key TEXT, value JSON)')
      await sequelize.query('INSERT INTO settings (key, value) VALUES (:key, :value)', { replacements: { key: 'server-settings', value: JSON.stringify(serverSettings) } })
      const migrationManager = new MigrationManager(sequelize, configPath)

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      expect(migrationManager.maxVersion).to.equal('1.1.0')
      expect(migrationManager.databaseVersion).to.equal('1.1.0')
    })

    it('should set versions to null if no result is returned from the database', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      await sequelize.query('CREATE TABLE settings (key TEXT, value JSON)')
      const migrationManager = new MigrationManager(sequelize, configPath)

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      expect(migrationManager.maxVersion).to.be.null
      expect(migrationManager.databaseVersion).to.be.null
    })

    it('should return a default maxVersion if no maxVersion is set in the database', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const serverSettings = { version: 'v1.1.0' }
      // Create a settings table with a single row
      await sequelize.query('CREATE TABLE settings (key TEXT, value JSON)')
      await sequelize.query('INSERT INTO settings (key, value) VALUES (:key, :value)', { replacements: { key: 'server-settings', value: JSON.stringify(serverSettings) } })
      const migrationManager = new MigrationManager(sequelize, configPath)

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      expect(migrationManager.maxVersion).to.equal('0.0.0')
      expect(migrationManager.databaseVersion).to.equal('1.1.0')
    })

    it('should throw an error if the database query fails', async () => {
      // Arrange
      const sequelizeStub = sinon.createStubInstance(Sequelize)
      sequelizeStub.query.rejects(new Error('Database query failed'))
      const migrationManager = new MigrationManager(sequelizeStub, configPath)

      // Act
      try {
        await migrationManager.fetchVersionsFromDatabase()
        expect.fail('Expected fetchVersionsFromDatabase to throw an error, but it did not.')
      } catch (error) {
        // Assert
        expect(error.message).to.equal('Database query failed')
      }
    })
  })

  describe('updateMaxVersion', () => {
    it('should update the maxVersion in the database', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const serverSettings = { version: 'v1.1.0', maxVersion: 'v1.1.0' }
      // Create a settings table with a single row
      await sequelize.query('CREATE TABLE settings (key TEXT, value JSON)')
      await sequelize.query('INSERT INTO settings (key, value) VALUES (:key, :value)', { replacements: { key: 'server-settings', value: JSON.stringify(serverSettings) } })
      const migrationManager = new MigrationManager(sequelize, configPath)

      // Act
      await migrationManager.updateMaxVersion('v1.2.0')

      // Assert
      const [result] = await sequelize.query("SELECT json_extract(value, '$.maxVersion') AS maxVersion FROM settings WHERE key = :key", { replacements: { key: 'server-settings' }, type: Sequelize.QueryTypes.SELECT })
      expect(result.maxVersion).to.equal('v1.2.0')
    })
  })

  describe('extractVersionFromTag', () => {
    it('should return null if tag is not provided', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, configPath)

      // Act
      const result = migrationManager.extractVersionFromTag()

      // Assert
      expect(result).to.be.null
    })

    it('should return null if tag does not match the version format', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, configPath)
      const tag = 'invalid-tag'

      // Act
      const result = migrationManager.extractVersionFromTag(tag)

      // Assert
      expect(result).to.be.null
    })

    it('should extract the version from the tag', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, configPath)
      const tag = 'v1.2.3'

      // Act
      const result = migrationManager.extractVersionFromTag(tag)

      // Assert
      expect(result).to.equal('1.2.3')
    })
  })

  describe('copyMigrationsToConfigDir', () => {
    it('should copy migrations to the config directory', async () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, configPath)
      migrationManager.migrationsDir = path.join(configPath, 'migrations')
      const migrationsSourceDir = path.join(__dirname, '..', '..', '..', 'server', 'migrations')
      const targetDir = migrationManager.migrationsDir
      const files = ['migration1.js', 'migration2.js', 'readme.md']

      const readdirStub = sinon.stub(fs, 'readdir').resolves(files)

      // Act
      await migrationManager.copyMigrationsToConfigDir()

      // Assert
      expect(fsEnsureDirStub.calledOnce).to.be.true
      expect(fsEnsureDirStub.calledWith(targetDir)).to.be.true
      expect(readdirStub.calledOnce).to.be.true
      expect(readdirStub.calledWith(migrationsSourceDir)).to.be.true
      expect(fsCopyStub.calledTwice).to.be.true
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration1.js'), path.join(targetDir, 'migration1.js'))).to.be.true
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration2.js'), path.join(targetDir, 'migration2.js'))).to.be.true
    })

    it('should throw an error if copying the migrations fails', async () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, configPath)
      migrationManager.migrationsDir = path.join(configPath, 'migrations')
      const migrationsSourceDir = path.join(__dirname, '..', '..', '..', 'server', 'migrations')
      const targetDir = migrationManager.migrationsDir
      const files = ['migration1.js', 'migration2.js', 'readme.md']

      const readdirStub = sinon.stub(fs, 'readdir').resolves(files)
      fsCopyStub.restore()
      fsCopyStub = sinon.stub(fs, 'copy').rejects()

      // Act
      try {
        // Act
        await migrationManager.copyMigrationsToConfigDir()
        expect.fail('Expected copyMigrationsToConfigDir to throw an error, but it did not.')
      } catch (error) {}

      // Assert
      expect(fsEnsureDirStub.calledOnce).to.be.true
      expect(fsEnsureDirStub.calledWith(targetDir)).to.be.true
      expect(readdirStub.calledOnce).to.be.true
      expect(readdirStub.calledWith(migrationsSourceDir)).to.be.true
      expect(fsCopyStub.calledTwice).to.be.true
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration1.js'), path.join(targetDir, 'migration1.js'))).to.be.true
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration2.js'), path.join(targetDir, 'migration2.js'))).to.be.true
    })
  })

  describe('findMigrationsToRun', () => {
    it('should return migrations to run when direction is "up"', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js']
      migrationManager.databaseVersion = '1.0.0'
      migrationManager.serverVersion = '1.2.0'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal(['v1.1.0-migration.js', 'v1.2.0-migration.js'])
    })

    it('should return migrations to run when direction is "down"', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.2.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal(['v1.3.0-migration.js'])
    })

    it('should return empty array when no migrations to run up', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.4.0'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal([])
    })

    it('should return empty array when no migrations to run down', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = []
      migrationManager.databaseVersion = '1.4.0'
      migrationManager.serverVersion = '1.3.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal([])
    })

    it('should return down migrations to run when direction is "down" and up migration was not executed', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = []
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.0.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal(['v1.3.0-migration.js', 'v1.2.0-migration.js', 'v1.1.0-migration.js'])
    })

    it('should return empty array when direction is "down" and server version is higher than database version', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.0.0'
      migrationManager.serverVersion = '1.3.0'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal([])
    })

    it('should return empty array when direction is "up" and server version is lower than database version', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.3.0-migration.js']
      migrationManager.databaseVersion = '1.3.0'
      migrationManager.serverVersion = '1.0.0'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal([])
    })

    it('should return up migrations to run when server version is between migrations', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js']
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.serverVersion = '1.2.3'
      const direction = 'up'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal(['v1.2.0-migration.js'])
    })

    it('should return down migrations to run when server version is between migrations', () => {
      // Arrange
      const migrations = [{ name: 'v1.0.0-migration.js' }, { name: 'v1.1.0-migration.js' }, { name: 'v1.2.0-migration.js' }, { name: 'v1.3.0-migration.js' }]
      const executedMigrations = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js']
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.serverVersion = '1.1.3'
      const direction = 'down'

      // Act
      const result = migrationManager.findMigrationsToRun(migrations, executedMigrations, direction)

      // Assert
      expect(result).to.deep.equal(['v1.2.0-migration.js'])
    })
  })
})
