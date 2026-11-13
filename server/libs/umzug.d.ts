export { JSONStorage } from './umzug/storage/json'
export { MongoDBStorage } from './umzug/storage/mongodb'
export { memoryStorage } from './umzug/storage/memory'
export { RerunBehavior } from './umzug/types'

import type { Sequelize } from 'sequelize'

interface MigrationMeta {
  name: string
  path?: string
}

interface MigrationParams<Context> extends MigrationMeta {
  context: Context
}

interface Migration<Context> extends MigrationMeta {
  up(params: MigrationParams<Context>): Promise<unknown>
  down?(params: MigrationParams<Context>): Promise<unknown>
}

export interface MigrationStorage<Context> {
  executed(params: { context: Context }): Promise<string[]>
  logMigration(params: MigrationParams<Context>): Promise<void>
  unlogMigration(params: MigrationParams<Context>): Promise<void>
}

export class SequelizeStorage implements MigrationStorage<unknown> {
  constructor(options: { sequelize: Sequelize })
  executed(): Promise<string[]>
  logMigration(params: MigrationMeta): Promise<void>
  unlogMigration(params: MigrationMeta): Promise<void>
}

interface UmzugOptions<Context> {
  context: Context
  logger?: { info(message: unknown): void }
  storage?: MigrationStorage<Context>
  migrations:
    | { files: string[]; resolve(params: MigrationParams<Context> & { path: string }): Migration<Context> }
    | ((context: Context) => Promise<Migration<Context>[]>)
}

interface MigrateOptions {
  migrations: string[]
  rerun: 'ALLOW'
}

export class Umzug<Context> {
  constructor(options: UmzugOptions<Context>)
  options: UmzugOptions<Context>
  migrations(context?: Context): Promise<Migration<Context>[]>
  executed(): Promise<MigrationMeta[]>
  up(options: MigrateOptions): Promise<MigrationMeta[]>
  down(options: MigrateOptions): Promise<MigrationMeta[]>
}
