import type { QueryInterface } from 'sequelize'
import type Logger from '../Logger'

export interface MigrationContext {
  queryInterface: QueryInterface
  logger: typeof Logger
}

export interface MigrationOptions {
  context: MigrationContext
}

// Sequelize declares showIndex as returning object, but SQLite returns an array.
export interface MigrationIndex {
  name: string
}
