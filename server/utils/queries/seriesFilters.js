const Sequelize = require('sequelize')
const Logger = require('../../Logger')
const Database = require('../../Database')
const libraryItemsBookFilters = require('./libraryItemsBookFilters')

module.exports = {
  decode(text) {
    return Buffer.from(decodeURIComponent(text), 'base64').toString()
  },

  /**
   * Get series filtered and sorted
   *
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {string} filterBy
   * @param {string} sortBy
   * @param {boolean} sortDesc
   * @param {string[]} include
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<{ series:object[], count:number }>}
   */
  async getFilteredSeries(library, user, filterBy, sortBy, sortDesc, include, limit, offset) {
    let filterValue = null
    let filterGroup = null
    if (filterBy) {
      const searchGroups = ['genres', 'tags', 'authors', 'progress', 'narrators', 'publishers', 'languages']
      const group = searchGroups.find((_group) => filterBy.startsWith(_group + '.'))
      filterGroup = group || filterBy
      filterValue = group ? this.decode(filterBy.replace(`${group}.`, '')) : null
    }

    const seriesIncludes = []
    if (include.includes('rssfeed')) {
      seriesIncludes.push({
        model: Database.feedModel
      })
    }

    const userPermissionBookWhere = libraryItemsBookFilters.getUserPermissionBookWhereQuery(user)

    const seriesWhere = [
      {
        libraryId: library.id
      }
    ]

    // Handle library setting to hide single book series
    // TODO: Merge with existing query
    if (library.settings.hideSingleBookSeries) {
      seriesWhere.push(
        Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id)`), {
          [Sequelize.Op.gt]: 1
        })
      )
    }

    // Handle filters
    // TODO: Simplify and break-out
    let attrQuery = null
    if (['genres', 'tags', 'narrators'].includes(filterGroup)) {
      attrQuery = `SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id AND (SELECT count(*) FROM json_each(b.${filterGroup}) WHERE json_valid(b.${filterGroup}) AND json_each.value = :filterValue) > 0`
      userPermissionBookWhere.replacements.filterValue = filterValue
    } else if (filterGroup === 'authors') {
      attrQuery = 'SELECT count(*) FROM books b, bookSeries bs, bookAuthors ba WHERE bs.seriesId = series.id AND bs.bookId = b.id AND ba.bookId = b.id AND ba.authorId = :filterValue'
      userPermissionBookWhere.replacements.filterValue = filterValue
    } else if (filterGroup === 'publishers') {
      attrQuery = 'SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id AND b.publisher = :filterValue'
      userPermissionBookWhere.replacements.filterValue = filterValue
    } else if (filterGroup === 'languages') {
      attrQuery = 'SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id AND b.language = :filterValue'
      userPermissionBookWhere.replacements.filterValue = filterValue
    } else if (filterGroup === 'progress') {
      if (filterValue === 'not-finished') {
        attrQuery = 'SELECT count(*) FROM books b, bookSeries bs LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = b.id AND mp.userId = :userId WHERE bs.seriesId = series.id AND bs.bookId = b.id AND (mp.isFinished IS NULL OR mp.isFinished = 0)'
        userPermissionBookWhere.replacements.userId = user.id
      } else if (filterValue === 'finished') {
        const progQuery = 'SELECT count(*) FROM books b, bookSeries bs LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = b.id AND mp.userId = :userId WHERE bs.seriesId = series.id AND bs.bookId = b.id AND (mp.isFinished IS NULL OR mp.isFinished = 0)'
        seriesWhere.push(Sequelize.where(Sequelize.literal(`(${progQuery})`), 0))
        userPermissionBookWhere.replacements.userId = user.id
      } else if (filterValue === 'not-started') {
        const progQuery = 'SELECT count(*) FROM books b, bookSeries bs LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = b.id AND mp.userId = :userId WHERE bs.seriesId = series.id AND bs.bookId = b.id AND (mp.isFinished = 1 OR mp.currentTime > 0)'
        seriesWhere.push(Sequelize.where(Sequelize.literal(`(${progQuery})`), 0))
        userPermissionBookWhere.replacements.userId = user.id
      } else if (filterValue === 'in-progress') {
        attrQuery = 'SELECT count(*) FROM books b, bookSeries bs LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = b.id AND mp.userId = :userId WHERE bs.seriesId = series.id AND bs.bookId = b.id AND (mp.currentTime > 0 OR mp.ebookProgress > 0) AND mp.isFinished = 0'
        userPermissionBookWhere.replacements.userId = user.id
      }
    }

    // Handle user permissions to only include series with at least 1 book
    // TODO: Simplify to a single query
    if (userPermissionBookWhere.bookWhere.length) {
      if (!attrQuery) attrQuery = 'SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id'

      if (!user.canAccessExplicitContent) {
        attrQuery += ' AND b.explicit = 0'
      }
      if (!user.permissions?.accessAllTags && user.permissions?.itemTagsSelected?.length) {
        if (user.permissions.selectedTagsNotAccessible) {
          attrQuery += ' AND (SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected)) = 0'
        } else {
          attrQuery += ' AND (SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected)) > 0'
        }
      }
    }

    if (attrQuery) {
      seriesWhere.push(
        Sequelize.where(Sequelize.literal(`(${attrQuery})`), {
          [Sequelize.Op.gt]: 0
        })
      )
    }

    const order = []
    let seriesAttributes = {
      include: []
    }

    // Handle sort order
    const dir = sortDesc ? 'DESC' : 'ASC'
    if (sortBy === 'numBooks') {
      seriesAttributes.include.push([Sequelize.literal('(SELECT count(*) FROM bookSeries bs WHERE bs.seriesId = series.id)'), 'numBooks'])
      order.push(['numBooks', dir])
    } else if (sortBy === 'addedAt') {
      order.push(['createdAt', dir])
    } else if (sortBy === 'name') {
      if (global.ServerSettings.sortingIgnorePrefix) {
        order.push([Sequelize.literal('nameIgnorePrefix COLLATE NOCASE'), dir])
      } else {
        order.push([Sequelize.literal('`series`.`name` COLLATE NOCASE'), dir])
      }
    } else if (sortBy === 'totalDuration') {
      seriesAttributes.include.push([Sequelize.literal('(SELECT SUM(b.duration) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND b.id = bs.bookId)'), 'totalDuration'])
      order.push(['totalDuration', dir])
    } else if (sortBy === 'lastBookAdded') {
      seriesAttributes.include.push([Sequelize.literal('(SELECT MAX(b.createdAt) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND b.id = bs.bookId)'), 'mostRecentBookAdded'])
      order.push(['mostRecentBookAdded', dir])
    } else if (sortBy === 'lastBookUpdated') {
      seriesAttributes.include.push([Sequelize.literal('(SELECT MAX(b.updatedAt) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND b.id = bs.bookId)'), 'mostRecentBookUpdated'])
      order.push(['mostRecentBookUpdated', dir])
    } else if (sortBy === 'random') {
      order.push(Database.sequelize.random())
    }

    const { rows: series, count } = await Database.seriesModel.findAndCountAll({
      where: seriesWhere,
      limit,
      offset,
      distinct: true,
      subQuery: false,
      attributes: seriesAttributes,
      replacements: userPermissionBookWhere.replacements,
      include: [
        {
          model: Database.bookSeriesModel,
          include: {
            model: Database.bookModel,
            where: userPermissionBookWhere.bookWhere,
            include: [
              {
                model: Database.libraryItemModel
              },
              {
                model: Database.authorModel
              },
              {
                model: Database.seriesModel
              }
            ]
          },
          separate: true
        },
        ...seriesIncludes
      ],
      order
    })

    // Map series to old series
    const allOldSeries = []
    for (const s of series) {
      const oldSeries = s.toOldJSON()

      if (s.dataValues.totalDuration) {
        oldSeries.totalDuration = s.dataValues.totalDuration
      }

      if (s.feeds?.length) {
        oldSeries.rssFeed = s.feeds[0].toOldJSONMinified()
      }

      // TODO: Sort books by sequence in query
      s.bookSeries.sort((a, b) => {
        if (!a.sequence) return 1
        if (!b.sequence) return -1
        return a.sequence.localeCompare(b.sequence, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      })
      oldSeries.books = s.bookSeries.map((bs) => {
        const libraryItem = bs.book.libraryItem
        delete bs.book.libraryItem
        libraryItem.media = bs.book
        const oldLibraryItem = libraryItem.toOldJSONMinified()
        return oldLibraryItem
      })
      allOldSeries.push(oldSeries)
    }

    return {
      series: allOldSeries,
      count
    }
  }
}
