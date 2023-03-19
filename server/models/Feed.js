const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Feeds can be created from LibraryItem, Collection, Playlist or Series
 */
module.exports = (sequelize) => {
  class Feed extends Model {
    getEntity(options) {
      if (!this.entityType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.entityType)}`
      return this[mixinMethodName](options)
    }
  }

  Feed.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    slug: DataTypes.STRING,
    entityType: DataTypes.STRING,
    entityId: DataTypes.UUIDV4,
    entityUpdatedAt: DataTypes.DATE,
    serverAddress: DataTypes.STRING,
    feedURL: DataTypes.STRING,
    imageURL: DataTypes.STRING,
    siteURL: DataTypes.STRING,
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    author: DataTypes.STRING,
    podcastType: DataTypes.STRING,
    language: DataTypes.STRING,
    ownerName: DataTypes.STRING,
    ownerEmail: DataTypes.STRING,
    explicit: DataTypes.BOOLEAN,
    preventIndexing: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'feed'
  })

  const { user, libraryItem, collection, series, playlist } = sequelize.models

  user.hasMany(Feed)
  Feed.belongsTo(user)

  libraryItem.hasMany(Feed, {
    foreignKey: 'entityId',
    constraints: false,
    scope: {
      entityType: 'libraryItem'
    }
  })
  Feed.belongsTo(libraryItem, { foreignKey: 'entityId', constraints: false })

  collection.hasMany(Feed, {
    foreignKey: 'entityId',
    constraints: false,
    scope: {
      entityType: 'collection'
    }
  })
  Feed.belongsTo(collection, { foreignKey: 'entityId', constraints: false })

  series.hasMany(Feed, {
    foreignKey: 'entityId',
    constraints: false,
    scope: {
      entityType: 'series'
    }
  })
  Feed.belongsTo(series, { foreignKey: 'entityId', constraints: false })

  playlist.hasMany(Feed, {
    foreignKey: 'entityId',
    constraints: false,
    scope: {
      entityType: 'playlist'
    }
  })
  Feed.belongsTo(playlist, { foreignKey: 'entityId', constraints: false })

  Feed.addHook('afterFind', findResult => {
    if (!findResult) return

    if (!Array.isArray(findResult)) findResult = [findResult]
    for (const instance of findResult) {
      if (instance.entityType === 'libraryItem' && instance.libraryItem !== undefined) {
        instance.entity = instance.libraryItem
        instance.dataValues.entity = instance.dataValues.libraryItem
      } else if (instance.entityType === 'collection' && instance.collection !== undefined) {
        instance.entity = instance.collection
        instance.dataValues.entity = instance.dataValues.collection
      } else if (instance.entityType === 'series' && instance.series !== undefined) {
        instance.entity = instance.series
        instance.dataValues.entity = instance.dataValues.series
      } else if (instance.entityType === 'playlist' && instance.playlist !== undefined) {
        instance.entity = instance.playlist
        instance.dataValues.entity = instance.dataValues.playlist
      }

      // To prevent mistakes:
      delete instance.libraryItem
      delete instance.dataValues.libraryItem
      delete instance.collection
      delete instance.dataValues.collection
      delete instance.series
      delete instance.dataValues.series
      delete instance.playlist
      delete instance.dataValues.playlist
    }
  })

  return Feed
}