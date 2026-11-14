import { expect } from 'chai'
import { rejects as expectRejects } from 'node:assert/strict'
import sinon from 'sinon'
import { QueryTypes, Sequelize } from 'sequelize'
import fs from '../../../server/libs/fsExtra'
import Logger from '../../../server/Logger'
import MigrationManager from '../../../server/managers/MigrationManager'
import path from 'node:path'
import { Umzug, memoryStorage } from '../../../server/libs/umzug'
import type { MigrationContext } from '../../../server/types/migrations'

// MigrationManager uses the overload that returns filenames.
const migrationFs: { readdir(directory: string): Promise<string[]> } = fs

describe('MigrationManager', () => {
  let sequelizeStub: sinon.SinonStubbedInstance<Sequelize>
  let umzug: Umzug<MigrationContext>
  let up: sinon.SinonStub<Parameters<typeof umzug.up>, ReturnType<typeof umzug.up>>
  let down: sinon.SinonStub<Parameters<typeof umzug.down>, ReturnType<typeof umzug.down>>
  let migrations: sinon.SinonStub<Parameters<typeof umzug.migrations>, ReturnType<typeof umzug.migrations>>
  let executed: sinon.SinonStub<Parameters<typeof umzug.executed>, ReturnType<typeof umzug.executed>>
  let migrationManager: MigrationManager
  let copyMigrations: sinon.SinonStub<Parameters<(MigrationManager)['copyMigrationsToConfigDir']>, ReturnType<(MigrationManager)['copyMigrationsToConfigDir']>>
  let updateMaxVersion: sinon.SinonStub<Parameters<(MigrationManager)['updateMaxVersion']>, ReturnType<(MigrationManager)['updateMaxVersion']>>
  let initUmzug: sinon.SinonStub<Parameters<(MigrationManager)['initUmzug']>, ReturnType<(MigrationManager)['initUmzug']>>
  let loggerInfoStub: sinon.SinonStub<Parameters<(typeof Logger)['info']>, ReturnType<(typeof Logger)['info']>>
  let loggerErrorStub: sinon.SinonStub<Parameters<(typeof Logger)['error']>, ReturnType<(typeof Logger)['error']>>
  let fsCopyStub: sinon.SinonStub<Parameters<(typeof fs)['copy']>, ReturnType<(typeof fs)['copy']>>
  let fsMoveStub: sinon.SinonStub<Parameters<(typeof fs)['move']>, ReturnType<(typeof fs)['move']>>
  let fsRemoveStub: sinon.SinonStub<Parameters<(typeof fs)['remove']>, ReturnType<(typeof fs)['remove']>>
  let fsEnsureDirStub: sinon.SinonStub<Parameters<(typeof fs)['ensureDir']>, ReturnType<(typeof fs)['ensureDir']>>
  let processExitStub: sinon.SinonStub<Parameters<(typeof process)['exit']>, ReturnType<(typeof process)['exit']>>
  const configPath = '/path/to/config'

  const serverVersion = '1.2.0'

  beforeEach(() => {
    sequelizeStub = sinon.createStubInstance(Sequelize)
    const queryInterface = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }).getQueryInterface()
    sequelizeStub.getQueryInterface.returns(queryInterface)
    umzug = new Umzug({ migrations: () => Promise.resolve([]), context: { queryInterface, logger: Logger }, storage: memoryStorage() })
    migrations = sinon.stub(umzug, 'migrations')
    executed = sinon.stub(umzug, 'executed')
    up = sinon.stub(umzug, 'up')
    down = sinon.stub(umzug, 'down')
    migrationManager = new MigrationManager(sequelizeStub, false, configPath)
    sinon.stub(migrationManager, 'fetchVersionsFromDatabase').resolves()
    copyMigrations = sinon.stub(migrationManager, 'copyMigrationsToConfigDir').resolves()
    updateMaxVersion = sinon.stub(migrationManager, 'updateMaxVersion').resolves()
    initUmzug = sinon.stub(migrationManager, 'initUmzug')
    migrationManager.umzug = umzug
    loggerInfoStub = sinon.stub(Logger, 'info')
    loggerErrorStub = sinon.stub(Logger, 'error')
    fsCopyStub = sinon.stub(fs, 'copy').resolves()
    fsMoveStub = sinon.stub(fs, 'move').resolves()
    fsRemoveStub = sinon.stub(fs, 'remove').resolves()
    fsEnsureDirStub = sinon.stub(fs, 'ensureDir').resolves()
    sinon.stub(fs, 'pathExists').resolves(true)
    processExitStub = sinon.stub(process, 'exit')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('init', () => {
    it('should initialize the MigrationManager', async () => {
      // arrange
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'
      migrationManager.umzug = null
      migrationManager.configPath = __dirname

      // Act
      await migrationManager.init(serverVersion)

      // Assert
      expect(fsEnsureDirStub.calledOnce).to.equal(true)
      expect(fsEnsureDirStub.calledWith(path.join(__dirname, 'migrations'))).to.equal(true)
      expect(migrationManager.serverVersion).to.equal(serverVersion)
      expect(migrationManager.sequelize).to.equal(sequelizeStub)
      expect(migrationManager.migrationsDir).to.equal(path.join(__dirname, 'migrations'))
      expect(copyMigrations.calledOnce).to.equal(true)
      expect(updateMaxVersion.calledOnce).to.equal(true)
      expect(migrationManager.initialized).to.equal(true)
    })

    it('should throw error if serverVersion is not provided', async () => {
      // Act
      try {
        await Reflect.apply(migrationManager.init.bind(migrationManager), undefined, [])
        expect.fail('Expected init to throw an error, but it did not.')
      } catch (error) {
        expect(error instanceof Error && error.message).to.equal('Invalid server version: undefined. Expected a version tag like v1.2.3.')
      }
    })
  })

  describe('runMigrations', () => {
    it('should run up migrations successfully', async () => {
      // Arrange
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'
      migrationManager.serverVersion = '1.2.0'
      migrationManager.initialized = true

      migrations.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }].map((migration) => ({ ...migration, up: () => Promise.resolve() })))
      executed.resolves([{ name: 'v1.1.0-migration.js' }])

      // Act
      await migrationManager.runMigrations()

      // Assert
      expect(initUmzug.calledOnce).to.equal(true)
      expect(up.calledOnce).to.equal(true)
      expect(up.calledWith({ migrations: ['v1.1.1-migration.js', 'v1.2.0-migration.js'], rerun: 'ALLOW' })).to.equal(true)
      expect(fsCopyStub.calledOnce).to.equal(true)
      expect(fsCopyStub.calledWith(path.join(configPath, 'absdatabase.sqlite'), path.join(configPath, 'absdatabase.backup.sqlite'))).to.equal(true)
      expect(fsRemoveStub.calledOnce).to.equal(true)
      expect(fsRemoveStub.calledWith(path.join(configPath, 'absdatabase.backup.sqlite'))).to.equal(true)
      expect(loggerInfoStub.calledWith(sinon.match('Migrations successfully applied'))).to.equal(true)
    })

    it('should run down migrations successfully', async () => {
      // Arrange
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.maxVersion = '1.2.0'
      migrationManager.serverVersion = '1.1.0'
      migrationManager.initialized = true

      migrations.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }].map((migration) => ({ ...migration, up: () => Promise.resolve() })))
      executed.resolves([{ name: 'v1.1.0-migration.js' }, { name: 'v1.1.1-migration.js' }, { name: 'v1.2.0-migration.js' }])

      // Act
      await migrationManager.runMigrations()

      // Assert
      expect(initUmzug.calledOnce).to.equal(true)
      expect(down.calledOnce).to.equal(true)
      expect(down.calledWith({ migrations: ['v1.2.0-migration.js', 'v1.1.1-migration.js'], rerun: 'ALLOW' })).to.equal(true)
      expect(fsCopyStub.calledOnce).to.equal(true)
      expect(fsCopyStub.calledWith(path.join(configPath, 'absdatabase.sqlite'), path.join(configPath, 'absdatabase.backup.sqlite'))).to.equal(true)
      expect(fsRemoveStub.calledOnce).to.equal(true)
      expect(fsRemoveStub.calledWith(path.join(configPath, 'absdatabase.backup.sqlite'))).to.equal(true)
      expect(loggerInfoStub.calledWith(sinon.match('Migrations successfully applied'))).to.equal(true)
    })

    it('should log that migrations will be skipped if database is new', async () => {
      // Arrange
      migrationManager.isDatabaseNew = true
      migrationManager.initialized = true

      // Act
      await migrationManager.runMigrations()

      // Assert
      expect(loggerInfoStub.calledWith(sinon.match('Database is new. Skipping migrations.'))).to.equal(true)
      expect(initUmzug.called).to.equal(false)
      expect(up.called).to.equal(false)
      expect(down.called).to.equal(false)
    })

    it('should log that no migrations are needed if serverVersion equals databaseVersion', async () => {
      // Arrange
      migrationManager.serverVersion = '1.2.0'
      migrationManager.databaseVersion = '1.2.0'
      migrationManager.maxVersion = '1.2.0'
      migrationManager.initialized = true

      // Act
      await migrationManager.runMigrations()

      // Assert
      expect(up.called).to.equal(false)
      expect(loggerInfoStub.calledWith(sinon.match('Database is already up to date.'))).to.equal(true)
    })

    it('should handle migration failure and restore the original database', async () => {
      // Arrange
      migrationManager.serverVersion = '1.2.0'
      migrationManager.databaseVersion = '1.1.0'
      migrationManager.maxVersion = '1.1.0'
      migrationManager.initialized = true

      migrations.resolves([{ name: 'v1.2.0-migration.js' }].map((migration) => ({ ...migration, up: () => Promise.resolve() })))
      executed.resolves([{ name: 'v1.1.0-migration.js' }])
      up.rejects(new Error('Migration failed'))

      const originalDbPath = path.join(configPath, 'absdatabase.sqlite')
      const backupDbPath = path.join(configPath, 'absdatabase.backup.sqlite')

      // Act
      await migrationManager.runMigrations()

      // Assert
      expect(initUmzug.calledOnce).to.equal(true)
      expect(up.calledOnce).to.equal(true)
      expect(loggerErrorStub.calledWith(sinon.match('Migration failed'))).to.equal(true)
      expect(fsMoveStub.calledWith(originalDbPath, sinon.match('absdatabase.failed.sqlite'), { overwrite: true })).to.equal(true)
      expect(fsMoveStub.calledWith(backupDbPath, originalDbPath, { overwrite: true })).to.equal(true)
      expect(loggerInfoStub.calledWith(sinon.match('Restored the original database'))).to.equal(true)
      expect(processExitStub.calledOnce).to.equal(true)
    })
  })

  describe('fetchVersionsFromDatabase', () => {
    it('should fetch versions from the migrationsMeta table', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      // Create a migrationsMeta table and populate it with version and maxVersion
      await sequelize.query('CREATE TABLE migrationsMeta (key VARCHAR(255), value VARCHAR(255))')
      await sequelize.query("INSERT INTO migrationsMeta (key, value) VALUES ('version', '1.1.0'), ('maxVersion', '1.1.0')")
      const migrationManager = new MigrationManager(sequelize, false, configPath)
      sinon.stub(migrationManager, 'checkOrCreateMigrationsMetaTable').resolves()

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      expect(migrationManager.maxVersion).to.equal('1.1.0')
      expect(migrationManager.databaseVersion).to.equal('1.1.0')
    })

    it('should create the migrationsMeta table if it does not exist and fetch versions from it', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const migrationManager = new MigrationManager(sequelize, false, configPath)
      migrationManager.serverVersion = serverVersion

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      const tableDescription = await sequelize.getQueryInterface().describeTable('migrationsMeta')
      expect(tableDescription).to.deep.equal({
        key: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false },
        value: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false }
      })
      expect(migrationManager.maxVersion).to.equal('0.0.0')
      expect(migrationManager.databaseVersion).to.equal('0.0.0')
    })

    it('should create the migrationsMeta with databaseVersion=serverVersion if database is new', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const migrationManager = new MigrationManager(sequelize, true, configPath)
      migrationManager.serverVersion = serverVersion

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      const tableDescription = await sequelize.getQueryInterface().describeTable('migrationsMeta')
      expect(tableDescription).to.deep.equal({
        key: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false },
        value: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false }
      })
      expect(migrationManager.maxVersion).to.equal('0.0.0')
      expect(migrationManager.databaseVersion).to.equal(serverVersion)
    })

    it('should re-create the migrationsMeta table if it existed and database is new (Database force=true)', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      // Create a migrationsMeta table and populate it with version and maxVersion
      await sequelize.query('CREATE TABLE migrationsMeta (key VARCHAR(255), value VARCHAR(255))')
      await sequelize.query("INSERT INTO migrationsMeta (key, value) VALUES ('version', '1.1.0'), ('maxVersion', '1.1.0')")
      const migrationManager = new MigrationManager(sequelize, true, configPath)
      migrationManager.serverVersion = serverVersion

      // Act
      await migrationManager.fetchVersionsFromDatabase()

      // Assert
      expect(migrationManager.maxVersion).to.equal('0.0.0')
      expect(migrationManager.databaseVersion).to.equal(serverVersion)
    })

    it('should throw an error if the database query fails', async () => {
      // Arrange
      const sequelizeStub = sinon.createStubInstance(Sequelize)
      sequelizeStub.query.rejects(new Error('Database query failed'))
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      sinon.stub(migrationManager, 'checkOrCreateMigrationsMetaTable').resolves()

      // Act
      try {
        await migrationManager.fetchVersionsFromDatabase()
        expect.fail('Expected fetchVersionsFromDatabase to throw an error, but it did not.')
      } catch (error) {
        // Assert
        expect(error instanceof Error && error.message).to.equal('Database query failed')
      }
    })
  })

  describe('updateMaxVersion', () => {
    it('should update the maxVersion in the database', async () => {
      // Arrange
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      // Create a migrationsMeta table and populate it with version and maxVersion
      await sequelize.query('CREATE TABLE migrationsMeta (key VARCHAR(255), value VARCHAR(255))')
      await sequelize.query("INSERT INTO migrationsMeta (key, value) VALUES ('version', '1.1.0'), ('maxVersion', '1.1.0')")
      const migrationManager = new MigrationManager(sequelize, false, configPath)
      migrationManager.serverVersion = '1.2.0'

      // Act
      await migrationManager.updateMaxVersion()

      // Assert
      const [{ maxVersion }] = await sequelize.query<{ maxVersion: string }>("SELECT value AS maxVersion FROM migrationsMeta WHERE key = 'maxVersion'", {
        type: QueryTypes.SELECT
      })
      expect(maxVersion).to.equal('1.2.0')
    })
  })

  describe('extractVersionFromTag', () => {
    it('should return null if tag is not provided', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)

      // Act
      const result: unknown = Reflect.apply(migrationManager.extractVersionFromTag.bind(migrationManager), undefined, [])

      // Assert
      expect(result).to.equal(null)
    })

    it('should return null if tag does not match the version format', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      const tag = 'invalid-tag'

      // Act
      const result = migrationManager.extractVersionFromTag(tag)

      // Assert
      expect(result).to.equal(null)
    })

    it('should extract the version from the tag', () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
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
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      migrationManager.migrationsDir = path.join(configPath, 'migrations')
      const migrationsSourceDir = path.join(__dirname, '..', '..', '..', 'server', 'migrations')
      const targetDir = migrationManager.migrationsDir
      const files = ['migration1.js', 'migration2.js', 'readme.md']

      const readdirStub = sinon.stub(migrationFs, 'readdir').resolves(files)

      // Act
      await migrationManager.copyMigrationsToConfigDir()

      // Assert
      expect(readdirStub.calledOnce).to.equal(true)
      expect(readdirStub.calledWith(migrationsSourceDir)).to.equal(true)
      expect(fsCopyStub.calledTwice).to.equal(true)
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration1.js'), path.join(targetDir, 'migration1.js'))).to.equal(true)
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration2.js'), path.join(targetDir, 'migration2.js'))).to.equal(true)
    })

    it('should throw an error if copying the migrations fails', async () => {
      // Arrange
      const migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      migrationManager.migrationsDir = path.join(configPath, 'migrations')
      const migrationsSourceDir = path.join(__dirname, '..', '..', '..', 'server', 'migrations')
      const targetDir = migrationManager.migrationsDir
      const files = ['migration1.js', 'migration2.js', 'readme.md']

      const readdirStub = sinon.stub(migrationFs, 'readdir').resolves(files)
      fsCopyStub.restore()
      fsCopyStub = sinon.stub(fs, 'copy').rejects()

      // Act
      await expectRejects(migrationManager.copyMigrationsToConfigDir())

      // Assert
      expect(readdirStub.calledOnce).to.equal(true)
      expect(readdirStub.calledWith(migrationsSourceDir)).to.equal(true)
      expect(fsCopyStub.calledTwice).to.equal(true)
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration1.js'), path.join(targetDir, 'migration1.js'))).to.equal(true)
      expect(fsCopyStub.calledWith(path.join(migrationsSourceDir, 'migration2.js'), path.join(targetDir, 'migration2.js'))).to.equal(true)
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
      const executedMigrations: string[] = []
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
      const executedMigrations: string[] = []
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

  describe('initUmzug', () => {
    it('should initialize the umzug instance with migrations in the proper order', async () => {
      // Arrange
      const readdirStub = sinon.stub(migrationFs, 'readdir').resolves(['v1.0.0-migration.js', 'v1.10.0-migration.js', 'v1.2.0-migration.js', 'v1.1.0-migration.js'])
      sinon.stub(fs, 'readFileSync').returns('module.exports = { up: () => {}, down: () => {} }')
      const umzugStorage = memoryStorage()
      migrationManager = new MigrationManager(sequelizeStub, false, configPath)
      const migrationsDir = path.join(configPath, 'migrations')
      migrationManager.migrationsDir = migrationsDir
      const resolvedMigrationNames = ['v1.0.0-migration.js', 'v1.1.0-migration.js', 'v1.2.0-migration.js', 'v1.10.0-migration.js']
      const resolvedMigrationPaths = resolvedMigrationNames.map((name) => path.resolve(path.join(migrationsDir, name)))

      // Act
      await migrationManager.initUmzug(umzugStorage)

      // Assert
      expect(readdirStub.calledOnce).to.equal(true)
      expect(migrationManager.umzug).to.be.an.instanceOf(Umzug)
      const migrations = await migrationManager.umzug?.migrations()
      expect(migrations?.map((m) => m.name)).to.deep.equal(resolvedMigrationNames)
      expect(migrations?.map((m) => m.path)).to.deep.equal(resolvedMigrationPaths)
    })
  })
})
