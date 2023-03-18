const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Feeds can be created from LibraryItem, Collection, Playlist or Series
 */
module.exports = (sequelize) => {
  class Feed extends Model {
    getEntity(options) {
      if (!this.entityType) return Promise.resolve(null)
      const mixinMethodName = `get${this.entityType}`
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
    EntityId: DataTypes.UUIDV4,
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
    modelName: 'Feed'
  })

  const { User, LibraryItem, Collection, Series, Playlist } = sequelize.models

  User.hasMany(Feed)
  Feed.belongsTo(User)

  LibraryItem.hasMany(Feed, {
    foreignKey: 'EntityId',
    constraints: false,
    scope: {
      entityType: 'LibraryItem'
    }
  })
  Feed.belongsTo(LibraryItem, { foreignKey: 'EntityId', constraints: false })

  Collection.hasMany(Feed, {
    foreignKey: 'EntityId',
    constraints: false,
    scope: {
      entityType: 'Collection'
    }
  })
  Feed.belongsTo(Collection, { foreignKey: 'EntityId', constraints: false })

  Series.hasMany(Feed, {
    foreignKey: 'EntityId',
    constraints: false,
    scope: {
      entityType: 'Series'
    }
  })
  Feed.belongsTo(Series, { foreignKey: 'EntityId', constraints: false })

  Playlist.hasMany(Feed, {
    foreignKey: 'EntityId',
    constraints: false,
    scope: {
      entityType: 'Playlist'
    }
  })
  Feed.belongsTo(Playlist, { foreignKey: 'EntityId', constraints: false })

  Feed.addHook('afterFind', findResult => {
    if (!Array.isArray(findResult)) findResult = [findResult]
    for (const instance of findResult) {
      if (instance.entityType === 'LibraryItem' && instance.LibraryItem !== undefined) {
        instance.Entity = instance.LibraryItem
      } else if (instance.mediaItemType === 'Collection' && instance.Collection !== undefined) {
        instance.Entity = instance.Collection
      } else if (instance.mediaItemType === 'Series' && instance.Series !== undefined) {
        instance.Entity = instance.Series
      } else if (instance.mediaItemType === 'Playlist' && instance.Playlist !== undefined) {
        instance.Entity = instance.Playlist
      }

      // To prevent mistakes:
      delete instance.LibraryItem
      delete instance.dataValues.LibraryItem
      delete instance.Collection
      delete instance.dataValues.Collection
      delete instance.Series
      delete instance.dataValues.Series
      delete instance.Playlist
      delete instance.dataValues.Playlist
    }
  })

  return Feed
}