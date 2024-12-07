/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.17.5'
const migrationName = `${migrationVersion}-remove-host-from-feed-urls`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration removes the host (serverAddress) from URL columns in the feeds and feedEpisodes tables.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  logger.info(`${loggerPrefix} Removing serverAddress from Feeds table URLs`)
  await queryInterface.sequelize.query(`
    UPDATE Feeds
    SET feedUrl = REPLACE(feedUrl, COALESCE(serverAddress, ''), ''),
        imageUrl = REPLACE(imageUrl, COALESCE(serverAddress, ''), ''),
        siteUrl = REPLACE(siteUrl, COALESCE(serverAddress, ''), '');
  `)
  logger.info(`${loggerPrefix} Removed serverAddress from Feeds table URLs`)

  logger.info(`${loggerPrefix} Removing serverAddress from FeedEpisodes table URLs`)
  await queryInterface.sequelize.query(`
    UPDATE FeedEpisodes
      SET siteUrl = REPLACE(siteUrl, (SELECT COALESCE(serverAddress, '') FROM Feeds WHERE Feeds.id = FeedEpisodes.feedId), ''),
          enclosureUrl = REPLACE(enclosureUrl, (SELECT COALESCE(serverAddress, '') FROM Feeds WHERE Feeds.id = FeedEpisodes.feedId), '');
  `)
  logger.info(`${loggerPrefix} Removed serverAddress from FeedEpisodes table URLs`)

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script adds the host (serverAddress) back to URL columns in the feeds and feedEpisodes tables.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  logger.info(`${loggerPrefix} Adding serverAddress back to Feeds table URLs`)
  await queryInterface.sequelize.query(`
    UPDATE Feeds
    SET feedUrl = COALESCE(serverAddress, '') || feedUrl,
        imageUrl = COALESCE(serverAddress, '') || imageUrl,
        siteUrl = COALESCE(serverAddress, '') || siteUrl;
  `)
  logger.info(`${loggerPrefix} Added serverAddress back to Feeds table URLs`)

  logger.info(`${loggerPrefix} Adding serverAddress back to FeedEpisodes table URLs`)
  await queryInterface.sequelize.query(`
    UPDATE FeedEpisodes
      SET siteUrl = (SELECT COALESCE(serverAddress, '') || FeedEpisodes.siteUrl FROM Feeds WHERE Feeds.id = FeedEpisodes.feedId),
          enclosureUrl = (SELECT COALESCE(serverAddress, '') || FeedEpisodes.enclosureUrl FROM Feeds WHERE Feeds.id = FeedEpisodes.feedId);
  `)
  logger.info(`${loggerPrefix} Added serverAddress back to FeedEpisodes table URLs`)

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
