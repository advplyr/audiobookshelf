const { Umzug, SequelizeStorage } = require('umzug')
const { Sequelize } = require('sequelize')
const semver = require('semver')
const path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')

class MigrationManager {
  constructor(sequelize, configPath = global.configPath) {
    if (!sequelize || !(sequelize instanceof Sequelize)) {
      throw new Error('Sequelize instance is required for MigrationManager.')
    }
    this.sequelize = sequelize
    if (!configPath) {
      throw new Error('Config path is required for MigrationManager.')
    }
    this.configPath = configPath
    this.migrationsDir = null
    this.maxVersion = null
    this.databaseVersion = null
    this.serverVersion = null
    this.umzug = null
  }

  async runMigrations(serverVersion) {
    await this.init(serverVersion)

    const versionCompare = semver.compare(this.serverVersion, this.databaseVersion)
    if (versionCompare == 0) {
      Logger.info('[MigrationManager] Database is already up to date.')
      return
    }

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
        await this.umzug[migrationDirection]({ migrations: migrationsToRun })

        // Clean up the backup
        await fs.remove(backupDbPath)

        Logger.info('[MigrationManager] Migrations successfully applied to the original database.')
      } catch (error) {
        Logger.error('[MigrationManager] Migration failed:', error)

        this.sequelize.close()

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
  }

  async init(serverVersion, umzugStorage = new SequelizeStorage({ sequelize: this.sequelize })) {
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
        throw new Error('Failed to copy migrations to the config directory.', error)
      }

      try {
        await this.updateMaxVersion(serverVersion)
      } catch (error) {
        throw new Error('Failed to update max version in the database.', error)
      }
    }

    // Step 4: Initialize the Umzug instance
    if (!this.umzug) {
      // This check is for dependency injection in tests
      const cwd = this.migrationsDir

      const parent = new Umzug({
        migrations: {
          glob: ['*.js', { cwd }]
        },
        context: this.sequelize.getQueryInterface(),
        storage: umzugStorage,
        logger: Logger.info
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
    const [result] = await this.sequelize.query("SELECT json_extract(value, '$.version') AS version, json_extract(value, '$.maxVersion') AS maxVersion FROM settings WHERE key = :key", {
      replacements: { key: 'server-settings' },
      type: Sequelize.QueryTypes.SELECT
    })

    if (result) {
      try {
        this.maxVersion = this.extractVersionFromTag(result.maxVersion) || '0.0.0'
        this.databaseVersion = this.extractVersionFromTag(result.version)
      } catch (error) {
        Logger.error('[MigrationManager] Failed to parse server settings from the database.', error)
      }
    }
  }

  extractVersionFromTag(tag) {
    if (!tag) return null
    const versionMatch = tag.match(/^v?(\d+\.\d+\.\d+)/)
    return versionMatch ? versionMatch[1] : null
  }

  async copyMigrationsToConfigDir() {
    const migrationsSourceDir = path.join(__dirname, '..', 'migrations')

    await fs.ensureDir(this.migrationsDir) // Ensure the target directory exists

    const files = await fs.readdir(migrationsSourceDir)
    await Promise.all(
      files
        .filter((file) => path.extname(file) === '.js')
        .map(async (file) => {
          const sourceFile = path.join(migrationsSourceDir, file)
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

  async updateMaxVersion(serverVersion) {
    await this.sequelize.query("UPDATE settings SET value = JSON_SET(value, '$.maxVersion', ?) WHERE key = 'server-settings'", {
      replacements: [serverVersion],
      type: Sequelize.QueryTypes.UPDATE
    })
    this.maxVersion = this.serverVersion
  }
}

module.exports = MigrationManager
