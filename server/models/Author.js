const { DataTypes, Model } = require('sequelize')

const oldAuthor = require('../objects/entities/Author')

module.exports = (sequelize) => {
  class Author extends Model {
    static async getOldAuthors() {
      const authors = await this.findAll()
      return authors.map(au => au.getOldAuthor())
    }

    getOldAuthor() {
      return new oldAuthor({
        id: this.id,
        asin: this.asin,
        name: this.name,
        description: this.description,
        imagePath: this.imagePath,
        libraryId: this.libraryId,
        addedAt: this.createdAt.valueOf(),
        updatedAt: this.updatedAt.valueOf()
      })
    }

    static updateFromOld(oldAuthor) {
      const author = this.getFromOld(oldAuthor)
      return this.update(author, {
        where: {
          id: author.id
        }
      })
    }

    static createFromOld(oldAuthor) {
      const author = this.getFromOld(oldAuthor)
      return this.create(author)
    }

    static createBulkFromOld(oldAuthors) {
      const authors = oldAuthors.map(this.getFromOld)
      return this.bulkCreate(authors)
    }

    static getFromOld(oldAuthor) {
      return {
        id: oldAuthor.id,
        name: oldAuthor.name,
        asin: oldAuthor.asin,
        description: oldAuthor.description,
        imagePath: oldAuthor.imagePath,
        libraryId: oldAuthor.libraryId
      }
    }

    static removeById(authorId) {
      return this.destroy({
        where: {
          id: authorId
        }
      })
    }
  }

  Author.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    asin: DataTypes.STRING,
    description: DataTypes.TEXT,
    imagePath: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'author'
  })

  const { library } = sequelize.models
  library.hasMany(Author, {
    onDelete: 'CASCADE'
  })
  Author.belongsTo(library)

  return Author
}