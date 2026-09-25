const Logger = require('../Logger')
const Database = require('../Database')

/**
 * Manager for handling lastSeen updates
 */
class LastSeenManager {
  constructor() {
    /** @type {Set<string>} Set of user IDs that have made requests */
    this.activeUsers = new Set()

    /** @type {NodeJS.Timeout} Flush interval timer */
    this.flushInterval = null

    /** @type {number} Flush interval */
    this.flushIntervalMs = 1000 * 60 * 5
  }

  /**
   * Initialize the LastSeenManager
   * Start the periodic flush process
   */
  init() {
    Logger.info('[LastSeenManager] Initializing')
    this.startFlushInterval()
  }

  /**
   * Start the periodic flush interval
   */
  startFlushInterval() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    this.flushInterval = setInterval(() => {
      this.flushActiveUsers()
    }, this.flushIntervalMs)

    Logger.info(`[LastSeenManager] Started flush interval every ${this.flushIntervalMs / 1000} seconds`)
  }

  /**
   * Stop the flush interval
   */
  stopFlushInterval() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
      Logger.info('[LastSeenManager] Stopped flush interval')
    }
  }

  /**
   * Add a user to the active users set
   * @param {string} userId - User ID
   */
  addActiveUser(userId) {
    if (userId) {
      this.activeUsers.add(userId)
    }
  }

  /**
   * Flush all active users to the database and clear the set
   * Updates lastSeen timestamp for all users in the set
   */
  async flushActiveUsers() {
    if (this.activeUsers.size === 0) {
      Logger.debug('[LastSeenManager] No active users to flush')
      return
    }

    const userIds = Array.from(this.activeUsers)
    const currentTime = Date.now()

    Logger.debug(`[LastSeenManager] Flushing ${userIds.length} active users to database`)

    try {
      const affectedRows = await Database.userModel.update(
        { lastSeen: new Date(currentTime) },
        {
          where: {
            id: userIds
          },
          hooks: false
        }
      )

      Logger.debug(`[LastSeenManager] Successfully updated lastSeen for ${affectedRows[0]} users`)

      // Clear the active users set
      this.activeUsers.clear()
    } catch (error) {
      Logger.error(`[LastSeenManager] Failed to flush active users:`, error)
    }
  }

  async forceFlush() {
    Logger.info('[LastSeenManager] Force flushing active users')
    await this.flushActiveUsers()
  }

  /**
   * Cleanup and stop all processes
   */
  async cleanup() {
    Logger.info('[LastSeenManager] Cleaning up')
    this.stopFlushInterval()
    await this.forceFlush()
  }
}

module.exports = LastSeenManager
