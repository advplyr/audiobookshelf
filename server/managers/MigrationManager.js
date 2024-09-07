const { Umzug, SequelizeStorage } = require('umzug')
const { Sequelize, DataTypes } = require('sequelize')
const semver = require('semver')
const path = require('path')
const Module = require('module')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')

class MigrationManager {
  static MIGRATIONS_META_TABLE = 'migrationsMeta'

  constructor(sequelize, configPath = global.configPath) {
    if (!sequelize || !(sequelize instanceof Sequelize)) throw new Error('Sequelize instance is required for MigrationManager.')
    this.sequelize = sequelize
    if (!configPath) throw new Error('Config path is required for MigrationManager.')
    this.configPath = configPath
    this.migrationsSourceDir = path.join(__dirname, '..', 'migrations')
    this.initialized = false
    this.migrationsDir = null
    this.maxVersion = null
    this.databaseVersion = null
    this.serverVersion = null
    this.umzug = null
  }

  async init(serverVersion) {
    if (!(await fs.pathExists(this.configPath))) throw new Error(`Config path does not exist: ${this.configPath}`)

    this.migrationsDir = path.join(this.configPath, 'migrations')

    this.serverVersion = this.extractVersionFromTag(serverVersion)
    if (!this.serverVersion) throw new Error(`Invalid server version: ${serverVersion}. Expected a version tag like v1.2.3.`)

    await this.fetchVersionsFromDatabase()
    if (!this.maxVersion || !this.databaseVersion) throw new Error('Failed to fetch versions from the database.')

    if (semver.gt(this.serverVersion, this.maxVersion)) {
      try {
        await this.copyMigrationsToConfigDir()
      } catch (error) {
        throw new Error('Failed to copy migrations to the config directory.', { cause: error })
      }

      try {
        await this.updateMaxVersion()
      } catch (error) {
        throw new Error('Failed to update max version in the database.', { cause: error })
      }
    }

    this.initialized = true
  }

  async runMigrations() {
    if (!this.initialized) throw new Error('MigrationManager is not initialized. Call init() first.')

    const versionCompare = semver.compare(this.serverVersion, this.databaseVersion)
    if (versionCompare == 0) {
      Logger.info('[MigrationManager] Database is already up to date.')
      return
    }

    this.initUmzug()
    const migrations = await this.umzug.migrations()
    const executedMigrations = (await this.umzug.executed()).map((m) => m.name)

    const migrationDirection = versionCompare == 1 ? 'up' : 'down'

    let migrationsToRun = []
    migrationsToRun = this.findMigrationsToRun(migrations, executedMigrations, migrationDirection)

    // Only proceed with migration if there are migrations to run
    if (migrationsToRun.length > 0) {
      const originalDbPath = path.join(this.configPath, 'absdatabase.sqlite')
      const backupDbPath = path.join(this.configPath, 'absdatabase.backup.sqlite')
      try {
        Logger.info(`[MigrationManager] Migrating database ${migrationDirection} to version ${this.serverVersion}`)
        Logger.info(`[MigrationManager] Migrations to run: ${migrationsToRun.join(', ')}`)
        // Create a backup copy of the SQLite database before starting migrations
        await fs.copy(originalDbPath, backupDbPath)
        Logger.info('Created a backup of the original database.')

        // Run migrations
        await this.umzug[migrationDirection]({ migrations: migrationsToRun, rerun: 'ALLOW' })

        // Clean up the backup
        await fs.remove(backupDbPath)

        Logger.info('[MigrationManager] Migrations successfully applied to the original database.')
      } catch (error) {
        Logger.error('[MigrationManager] Migration failed:', error)

        await this.sequelize.close()

        // Step 3: If migration fails, save the failed original and restore the backup
        const failedDbPath = path.join(this.configPath, 'absdatabase.failed.sqlite')
        await fs.move(originalDbPath, failedDbPath, { overwrite: true })
        await fs.move(backupDbPath, originalDbPath, { overwrite: true })

        Logger.info('[MigrationManager] Restored the original database from the backup.')
        Logger.info('[MigrationManager] Saved the failed database as absdatabase.failed.sqlite.')

        process.exit(1)
      }
    } else {
      Logger.info('[MigrationManager] No migrations to run.')
    }

    await this.updateDatabaseVersion()
  }

  initUmzug(umzugStorage = new SequelizeStorage({ sequelize: this.sequelize })) {
    if (!this.umzug) {
      // This check is for dependency injection in tests
      const cwd = this.migrationsDir

      const parent = new Umzug({
        migrations: {
          glob: ['*.js', { cwd }],
          resolve: (params) => {
            // make script think it's in migrationsSourceDir
            const migrationPath = params.path
            const migrationName = params.name
            const contents = fs.readFileSync(migrationPath, 'utf8')
            const fakePath = path.join(this.migrationsSourceDir, path.basename(migrationPath))
            const module = new Module(fakePath)
            module.filename = fakePath
            module.paths = Module._nodeModulePaths(this.migrationsSourceDir)
            module._compile(contents, fakePath)
            const script = module.exports
            return {
              name: migrationName,
              path: migrationPath,
              up: script.up,
              down: script.down
            }
          }
        },
        context: { queryInterface: this.sequelize.getQueryInterface(), logger: Logger },
        storage: umzugStorage,
        logger: Logger
      })

      // Sort migrations by version
      this.umzug = new Umzug({
        ...parent.options,
        migrations: async () =>
          (await parent.migrations()).sort((a, b) => {
            const versionA = this.extractVersionFromTag(a.name)
            const versionB = this.extractVersionFromTag(b.name)
            return semver.compare(versionA, versionB)
          })
      })
    }
  }

  async fetchVersionsFromDatabase() {
    await this.checkOrCreateMigrationsMetaTable()

    const [{ version }] = await this.sequelize.query("SELECT value as version FROM :migrationsMeta WHERE key = 'version'", {
      replacements: { migrationsMeta: MigrationManager.MIGRATIONS_META_TABLE },
      type: Sequelize.QueryTypes.SELECT
    })
    this.databaseVersion = version

    const [{ maxVersion }] = await this.sequelize.query("SELECT value as maxVersion FROM :migrationsMeta WHERE key = 'maxVersion'", {
      replacements: { migrationsMeta: MigrationManager.MIGRATIONS_META_TABLE },
      type: Sequelize.QueryTypes.SELECT
    })
    this.maxVersion = maxVersion
  }

  async checkOrCreateMigrationsMetaTable() {
    const queryInterface = this.sequelize.getQueryInterface()
    if (!(await queryInterface.tableExists(MigrationManager.MIGRATIONS_META_TABLE))) {
      await queryInterface.createTable(MigrationManager.MIGRATIONS_META_TABLE, {
        key: {
          type: DataTypes.STRING,
          allowNull: false
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false
        }
      })
      await this.sequelize.query("INSERT INTO :migrationsMeta (key, value) VALUES ('version', :version), ('maxVersion', '0.0.0')", {
        replacements: { version: this.serverVersion, migrationsMeta: MigrationManager.MIGRATIONS_META_TABLE },
        type: Sequelize.QueryTypes.INSERT
      })
    }
  }

  extractVersionFromTag(tag) {
    if (!tag) return null
    const versionMatch = tag.match(/^v?(\d+\.\d+\.\d+)/)
    return versionMatch ? versionMatch[1] : null
  }

  async copyMigrationsToConfigDir() {
    await fs.ensureDir(this.migrationsDir) // Ensure the target directory exists

    if (!(await fs.pathExists(this.migrationsSourceDir))) return

    const files = await fs.readdir(this.migrationsSourceDir)
    await Promise.all(
      files
        .filter((file) => path.extname(file) === '.js')
        .map(async (file) => {
          const sourceFile = path.join(this.migrationsSourceDir, file)
          const targetFile = path.join(this.migrationsDir, file)
          await fs.copy(sourceFile, targetFile) // Asynchronously copy the files
        })
    )
  }

  findMigrationsToRun(migrations, executedMigrations, direction) {
    const migrationsToRun = migrations
      .filter((migration) => {
        const migrationVersion = this.extractVersionFromTag(migration.name)
        if (direction === 'up') {
          return semver.gt(migrationVersion, this.databaseVersion) && semver.lte(migrationVersion, this.serverVersion) && !executedMigrations.includes(migration.name)
        } else {
          // A down migration should be run even if the associated up migration wasn't executed before
          return semver.lte(migrationVersion, this.databaseVersion) && semver.gt(migrationVersion, this.serverVersion)
        }
      })
      .map((migration) => migration.name)
    if (direction === 'down') {
      return migrationsToRun.reverse()
    } else {
      return migrationsToRun
    }
  }

  async updateMaxVersion() {
    try {
      await this.sequelize.query("UPDATE :migrationsMeta SET value = :maxVersion WHERE key = 'maxVersion'", {
        replacements: { maxVersion: this.serverVersion, migrationsMeta: MigrationManager.MIGRATIONS_META_TABLE },
        type: Sequelize.QueryTypes.UPDATE
      })
    } catch (error) {
      throw new Error('Failed to update maxVersion in the migrationsMeta table.', { cause: error })
    }
    this.maxVersion = this.serverVersion
  }

  async updateDatabaseVersion() {
    try {
      await this.sequelize.query("UPDATE :migrationsMeta SET value = :version WHERE key = 'version'", {
        replacements: { version: this.serverVersion, migrationsMeta: MigrationManager.MIGRATIONS_META_TABLE },
        type: Sequelize.QueryTypes.UPDATE
      })
    } catch (error) {
      throw new Error('Failed to update version in the migrationsMeta table.', { cause: error })
    }
    this.databaseVersion = this.serverVersion
  }
}

module.exports = MigrationManager
