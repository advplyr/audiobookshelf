const { DataTypes, Model } = require('sequelize')

const oldCollection = require('../objects/Collection')
const { areEquivalent } = require('../utils/index')

module.exports = (sequelize) => {
  class Collection extends Model {
    static async getOldCollections() {
      const collections = await this.findAll({
        include: {
          model: sequelize.models.book,
          include: sequelize.models.libraryItem
        }
      })
      return collections.map(c => this.getOldCollection(c))
    }

    static getOldCollection(collectionExpanded) {
      const libraryItemIds = collectionExpanded.books?.map(b => b.libraryItem?.id || null).filter(lid => lid) || []
      return new oldCollection({
        id: collectionExpanded.id,
        libraryId: collectionExpanded.libraryId,
        name: collectionExpanded.name,
        description: collectionExpanded.description,
        books: libraryItemIds,
        lastUpdate: collectionExpanded.updatedAt.valueOf(),
        createdAt: collectionExpanded.createdAt.valueOf()
      })
    }

    static createFromOld(oldCollection) {
      const collection = this.getFromOld(oldCollection)
      return this.create(collection)
    }

    static async fullUpdateFromOld(oldCollection, collectionBooks) {
      const existingCollection = await this.findByPk(oldCollection.id, {
        include: sequelize.models.collectionBook
      })
      if (!existingCollection) return false

      let hasUpdates = false
      const collection = this.getFromOld(oldCollection)

      for (const cb of collectionBooks) {
        const existingCb = existingCollection.collectionBooks.find(i => i.bookId === cb.bookId)
        if (!existingCb) {
          await sequelize.models.collectionBook.create(cb)
          hasUpdates = true
        } else if (existingCb.order != cb.order) {
          await existingCb.update({ order: cb.order })
          hasUpdates = true
        }
      }
      for (const cb of existingCollection.collectionBooks) {
        // collectionBook was removed
        if (!collectionBooks.some(i => i.bookId === cb.bookId)) {
          await cb.destroy()
          hasUpdates = true
        }
      }

      let hasCollectionUpdates = false
      for (const key in collection) {
        let existingValue = existingCollection[key]
        if (existingValue instanceof Date) existingValue = existingValue.valueOf()
        if (!areEquivalent(collection[key], existingValue)) {
          hasCollectionUpdates = true
        }
      }
      if (hasCollectionUpdates) {
        existingCollection.update(collection)
        hasUpdates = true
      }
      return hasUpdates
    }

    static getFromOld(oldCollection) {
      return {
        id: oldCollection.id,
        name: oldCollection.name,
        description: oldCollection.description,
        createdAt: oldCollection.createdAt,
        updatedAt: oldCollection.lastUpdate,
        libraryId: oldCollection.libraryId
      }
    }

    static removeById(collectionId) {
      return this.destroy({
        where: {
          id: collectionId
        }
      })
    }
  }

  Collection.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'collection'
  })

  const { library } = sequelize.models

  library.hasMany(Collection)
  Collection.belongsTo(library)

  return Collection
}