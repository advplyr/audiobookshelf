const Path = require('path')
const { Sequelize } = require('sequelize')

const Logger = require('./Logger')

class Database {
  constructor() {
    this.sequelize = null
  }

  async init() {
    if (!await this.connect()) {
      throw new Error('Database connection failed')
    }

    await this.buildModels()
    Logger.info(`[Database] Db initialized`, Object.keys(this.sequelize.models))
  }

  async connect() {
    const dbPath = Path.join(global.ConfigPath, 'database.sqlite')
    Logger.info(`[Database] Initializing db at "${dbPath}"`)
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath
    })

    try {
      await this.sequelize.authenticate()
      Logger.info(`[Database] Db connection was successful`)
      return true
    } catch (error) {
      Logger.error(`[Database] Failed to connect to db`, error)
      return false
    }
  }

  buildModels() {
    require('./models/User')(this.sequelize)
    require('./models/FileMetadata')(this.sequelize)
    require('./models/Library')(this.sequelize)
    require('./models/LibraryFolder')(this.sequelize)
    require('./models/LibraryItem')(this.sequelize)
    require('./models/EBookFile')(this.sequelize)
    require('./models/Book')(this.sequelize)
    require('./models/Podcast')(this.sequelize)
    require('./models/PodcastEpisode')(this.sequelize)
    require('./models/MediaProgress')(this.sequelize)
    require('./models/LibraryFile')(this.sequelize)
    require('./models/Person')(this.sequelize)
    require('./models/AudioBookmark')(this.sequelize)
    require('./models/AudioTrack')(this.sequelize)
    require('./models/BookAuthor')(this.sequelize)
    require('./models/BookChapter')(this.sequelize)
    require('./models/Genre')(this.sequelize)
    require('./models/BookGenre')(this.sequelize)
    require('./models/BookNarrator')(this.sequelize)
    require('./models/Series')(this.sequelize)
    require('./models/BookSeries')(this.sequelize)
    require('./models/Tag')(this.sequelize)
    require('./models/BookTag')(this.sequelize)
    require('./models/PodcastTag')(this.sequelize)
    require('./models/Collection')(this.sequelize)
    require('./models/CollectionBook')(this.sequelize)

    return this.sequelize.sync()
  }

  async createTestUser() {
    const User = this.sequelize.models.User

    let user = await User.findOne({
      where: {
        username: 'Tester'
      }
    })

    if (user) {
      Logger.info(`[Database] Tester user was found`, user.toJSON())
    } else {
      user = await User.create({ username: 'Tester' })
      Logger.info(`[Database] Created Tester user`, user.toJSON())
    }
  }
}


module.exports = new Database()
