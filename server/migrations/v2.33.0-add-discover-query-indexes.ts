import type { MigrationContext, MigrationIndex, MigrationOptions } from '../types/migrations'

const migrationVersion = '2.33.0'
const migrationName = `${migrationVersion}-add-discover-query-indexes`
const loggerPrefix = `[${migrationVersion} migration]`

const indexes = [
  {
    table: 'mediaProgresses',
    name: 'media_progresses_user_item_finished_time',
    fields: ['userId', 'mediaItemId', 'isFinished', 'currentTime']
  },
  {
    table: 'bookSeries',
    name: 'book_series_series_book',
    fields: ['seriesId', 'bookId']
  }
]

async function up({ context: { queryInterface, logger } }: MigrationOptions) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  for (const index of indexes) {
    await addIndexIfMissing(queryInterface, logger, index)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

async function down({ context: { queryInterface, logger } }: MigrationOptions) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  for (const index of indexes) {
    await removeIndexIfExists(queryInterface, logger, index)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

async function addIndexIfMissing(queryInterface: MigrationContext['queryInterface'], logger: MigrationContext['logger'], index: (typeof indexes)[number]) {
  const existing = (await queryInterface.showIndex(index.table)) as MigrationIndex[]
  if (existing.some((i) => i.name === index.name)) {
    logger.info(`${loggerPrefix} index ${index.name} already exists on ${index.table}`)
    return
  }

  logger.info(`${loggerPrefix} adding index ${index.name} on ${index.table}(${index.fields.join(', ')})`)
  await queryInterface.addIndex(index.table, {
    name: index.name,
    fields: index.fields
  })
  logger.info(`${loggerPrefix} added index ${index.name}`)
}

async function removeIndexIfExists(queryInterface: MigrationContext['queryInterface'], logger: MigrationContext['logger'], index: (typeof indexes)[number]) {
  const existing = (await queryInterface.showIndex(index.table)) as MigrationIndex[]
  if (!existing.some((i) => i.name === index.name)) {
    logger.info(`${loggerPrefix} index ${index.name} does not exist on ${index.table}`)
    return
  }

  logger.info(`${loggerPrefix} removing index ${index.name}`)
  await queryInterface.removeIndex(index.table, index.name)
  logger.info(`${loggerPrefix} removed index ${index.name}`)
}

export = { up, down }
