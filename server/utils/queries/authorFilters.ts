const Sequelize = require('sequelize')
const Database = require('../../Database')

module.exports = {
  /**
   * Get authors total count
   *
   * @param {string} libraryId
   * @returns {Promise<number>} count
   */
  async getAuthorsTotalCount(libraryId) {
    const authorsCount = await Database.authorModel.count({
      where: {
        libraryId: libraryId
      }
    })
    return authorsCount
  },

  /**
   * Get authors with count of num books
   *
   * @param {string} libraryId
   * @param {number} limit
   * @returns {Promise<{id:string, name:string, count:number}>}
   */
  async getAuthorsWithCount(libraryId, limit) {
    const authors = await Database.bookAuthorModel.findAll({
      include: [
        {
          model: Database.authorModel,
          as: 'author', // Use the correct alias as defined in your associations
          attributes: ['name'],
          where: {
            libraryId: libraryId
          }
        }
      ],
      attributes: ['authorId', [Sequelize.fn('COUNT', Sequelize.col('authorId')), 'count']],
      group: ['authorId', 'author.id'], // Include 'author.id' to satisfy GROUP BY with JOIN
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: limit
    })
    return authors.map((au) => {
      return {
        id: au.authorId,
        name: au.author.name,
        count: au.get('count') // Use get method to access aliased attributes
      }
    })
  },

  /**
   * Search authors
   *
   * @param {string} libraryId
   * @param {Database.TextQuery} query
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Object[]>} oldAuthor with numBooks
   */
  async search(libraryId, query, limit, offset) {
    const matchAuthor = query.matchExpression('name')
    const authors = await Database.authorModel.findAll({
      where: {
        [Sequelize.Op.and]: [Sequelize.literal(matchAuthor), { libraryId }]
      },
      attributes: {
        include: [[Sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 'numBooks']]
      },
      limit,
      offset
    })
    const authorMatches = []
    for (const author of authors) {
      const oldAuthor = author.toOldJSONExpanded(author.dataValues.numBooks)
      authorMatches.push(oldAuthor)
    }
    return authorMatches
  }
}
