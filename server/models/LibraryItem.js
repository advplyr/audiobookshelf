const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class LibraryItem extends Model {
    getMedia(options) {
      if (!this.mediaType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.mediaType)}`
      return this[mixinMethodName](options)
    }
  }

  LibraryItem.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ino: DataTypes.STRING,
    path: DataTypes.STRING,
    relPath: DataTypes.STRING,
    mediaId: DataTypes.UUIDV4,
    mediaType: DataTypes.STRING,
    isFile: DataTypes.BOOLEAN,
    isMissing: DataTypes.BOOLEAN,
    isInvalid: DataTypes.BOOLEAN,
    mtime: DataTypes.DATE(6),
    ctime: DataTypes.DATE(6),
    birthtime: DataTypes.DATE(6),
    lastScan: DataTypes.DATE,
    lastScanVersion: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'libraryItem'
  })

  const { library, libraryFolder, book, podcast } = sequelize.models
  library.hasMany(LibraryItem)
  LibraryItem.belongsTo(library)

  libraryFolder.hasMany(LibraryItem)
  LibraryItem.belongsTo(libraryFolder)

  book.hasOne(LibraryItem, {
    foreignKey: 'mediaId',
    constraints: false,
    scope: {
      mediaType: 'book'
    }
  })
  LibraryItem.belongsTo(book, { foreignKey: 'mediaId', constraints: false })

  podcast.hasOne(LibraryItem, {
    foreignKey: 'mediaId',
    constraints: false,
    scope: {
      mediaType: 'podcast'
    }
  })
  LibraryItem.belongsTo(podcast, { foreignKey: 'mediaId', constraints: false })

  LibraryItem.addHook('afterFind', findResult => {
    if (!findResult) return

    if (!Array.isArray(findResult)) findResult = [findResult]
    for (const instance of findResult) {
      if (instance.mediaType === 'book' && instance.book !== undefined) {
        instance.media = instance.book
        instance.dataValues.media = instance.dataValues.book
      } else if (instance.mediaType === 'podcast' && instance.podcast !== undefined) {
        instance.media = instance.podcast
        instance.dataValues.media = instance.dataValues.podcast
      }
      // To prevent mistakes:
      delete instance.book
      delete instance.dataValues.book
      delete instance.podcast
      delete instance.dataValues.podcast
    }
  })

  return LibraryItem
}