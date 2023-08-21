const Sequelize = require('sequelize')
const Database = require('../../Database')

module.exports = {
  /**
   * Get authors with count of num books
   * @param {string} libraryId 
   * @returns {{id:string, name:string, count:number}}
   */
  async getAuthorsWithCount(libraryId) {
    const authors = await Database.authorModel.findAll({
      where: [
        {
          libraryId
        },
        Sequelize.where(Sequelize.literal('count'), {
          [Sequelize.Op.gt]: 0
        })
      ],
      attributes: [
        'id',
        'name',
        [Sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 'count']
      ],
      order: [
        ['count', 'DESC']
      ]
    })
    return authors.map(au => {
      return {
        id: au.id,
        name: au.name,
        count: au.dataValues.count
      }
    })
  },

  /**
   * Search authors
   * @param {string} libraryId 
   * @param {string} query 
   * @param {number} limit
   * @param {number} offset
   * @returns {object[]} oldAuthor with numBooks
   */
  async search(libraryId, query, limit, offset) {
    const authors = await Database.authorModel.findAll({
      where: {
        name: {
          [Sequelize.Op.substring]: query
        },
        libraryId
      },
      attributes: {
        include: [
          [Sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 'numBooks']
        ]
      },
      limit,
      offset
    })
    const authorMatches = []
    for (const author of authors) {
      const oldAuthor = author.getOldAuthor().toJSON()
      oldAuthor.numBooks = author.dataValues.numBooks
      authorMatches.push(oldAuthor)
    }
    return authorMatches
  }
}
