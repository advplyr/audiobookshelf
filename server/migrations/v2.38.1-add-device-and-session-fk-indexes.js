/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface
 * @property {import('../Logger')} logger
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context
 */

const migrationVersion = '2.38.1'
const migrationName = `${migrationVersion}-add-device-and-session-fk-indexes`
const loggerPrefix = `[${migrationVersion} migration]`

const indexes = [
  {
    table: 'playbackSessions',
    name: 'playback_sessions_device_id',
    fields: ['deviceId']
  },
  {
    table: 'playbackSessions',
    name: 'playback_sessions_user_id',
    fields: ['userId']
  },
  {
    table: 'devices',
    name: 'devices_user_id',
    fields: ['userId']
  },
  {
    table: 'devices',
    name: 'devices_device_id',
    fields: ['deviceId']
  }
]

async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  for (const index of indexes) {
    await addIndexIfMissing(queryInterface, logger, index)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  for (const index of indexes) {
    await removeIndexIfExists(queryInterface, logger, index)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

async function addIndexIfMissing(queryInterface, logger, index) {
  const existing = await queryInterface.showIndex(index.table)
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

async function removeIndexIfExists(queryInterface, logger, index) {
  const existing = await queryInterface.showIndex(index.table)
  if (!existing.some((i) => i.name === index.name)) {
    logger.info(`${loggerPrefix} index ${index.name} does not exist on ${index.table}`)
    return
  }

  logger.info(`${loggerPrefix} removing index ${index.name}`)
  await queryInterface.removeIndex(index.table, index.name)
  logger.info(`${loggerPrefix} removed index ${index.name}`)
}

module.exports = { up, down }
