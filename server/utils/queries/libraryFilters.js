const { Op, literal, col, fn, where } = require('sequelize')
const Database = require('../../Database')
const libraryItemsSeriesFilters = require('./libraryItemsSeriesFilters')
const libraryItemsProgressFilters = require('./libraryItemsProgressFilters')
const Logger = require('../../Logger')

module.exports = {
  decode(text) {
    return Buffer.from(decodeURIComponent(text), 'base64').toString()
  },

  getMediaGroupQuery(group, value) {
    let mediaWhere = {}

    if (['genres', 'tags', 'narrators'].includes(group)) {
      mediaWhere[group] = {
        [Op.substring]: `"${value}"`
      }
    } else if (group === 'publishers') {
      mediaWhere['publisher'] = {
        [Op.substring]: `"${value}"`
      }
    } else if (group === 'languages') {
      mediaWhere['language'] = {
        [Op.substring]: `"${value}"`
      }
    } else if (group === 'tracks') {
      if (value === 'multi') {
        mediaWhere = where(fn('json_array_length', col('audioFiles')), {
          [Op.gt]: 1
        })
      } else {
        mediaWhere = where(fn('json_array_length', col('audioFiles')), 1)
      }
    } else if (group === 'ebooks') {
      if (value === 'ebook') {
        mediaWhere['ebookFile'] = {
          [Op.not]: null
        }
      }
    }

    return mediaWhere
  },

  getOrder(sortBy, sortDesc) {
    const dir = sortDesc ? 'DESC' : 'ASC'
    if (sortBy === 'addedAt') {
      return [['createdAt', dir]]
    } else if (sortBy === 'size') {
      return [['size', dir]]
    } else if (sortBy === 'birthtimeMs') {
      return [['birthtime', dir]]
    } else if (sortBy === 'mtimeMs') {
      return [['mtime', dir]]
    } else if (sortBy === 'media.duration') {
      return [[literal('book.duration'), dir]]
    } else if (sortBy === 'media.metadata.publishedYear') {
      return [[literal('book.publishedYear'), dir]]
    } else if (sortBy === 'media.metadata.authorNameLF') {
      return [[literal('book.authors.lastFirst'), dir]]
    } else if (sortBy === 'media.metadata.authorName') {
      return [[literal('book.authors.name'), dir]]
    } else if (sortBy === 'media.metadata.title') {
      if (global.ServerSettings.sortingIgnorePrefix) {
        return [[literal('book.titleIgnorePrefix'), dir]]
      } else {
        return [[literal('book.title'), dir]]
      }
    }
    return []
  },

  async getFilteredLibraryItems(libraryId, filterBy, sortBy, sortDesc, limit, offset, userId) {
    const libraryItemModel = Database.models.libraryItem

    let mediaWhereQuery = null
    let mediaAttributes = null
    let itemWhereQuery = {
      libraryId
    }

    const itemIncludes = []

    let authorInclude = {
      model: Database.models.author,
      through: {
        attributes: []
      }
    }
    let seriesInclude = {
      model: Database.models.series,
      through: {
        attributes: ['sequence']
      }
    }

    const searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators', 'publishers', 'missing', 'languages', 'tracks', 'ebooks']
    const group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      // e.g. genre id
      const value = this.decode(filterBy.replace(`${group}.`, ''))

      if (group === 'series' && value === 'no-series') {
        return libraryItemsSeriesFilters.getLibraryItemsWithNoSeries(libraryId, sortBy, sortDesc, limit, offset)
      } else if (group === 'progress') {
        return libraryItemsProgressFilters.getLibraryItemsWithProgressFilter(value, libraryId, userId, sortBy, sortDesc, limit, offset)
      }

      if (group === 'authors') {
        authorInclude.where = {
          id: value
        }
        authorInclude.required = true
      } else if (group === 'series') {
        seriesInclude.where = {
          id: value
        }
        seriesInclude.required = true
      } else {
        mediaWhereQuery = this.getMediaGroupQuery(group, value)
      }
    } else if (filterBy === 'abridged') {
      mediaWhereQuery = {
        abridged: true
      }
    }

    const { rows: libraryItems, count } = await libraryItemModel.findAndCountAll({
      where: itemWhereQuery,
      attributes: {
        include: [
          [fn('group_concat', col('book.author.name'), ', '), 'author_name']
        ]
      },
      distinct: true,
      subQuery: false,
      include: [
        {
          model: Database.models.book,
          attributes: mediaAttributes,
          where: mediaWhereQuery,
          required: true,
          include: [authorInclude, seriesInclude, ...itemIncludes]
        }
      ],
      order: this.getOrder(sortBy, sortDesc),
      limit,
      offset
    })
    Logger.debug('Found', libraryItems.length, 'library items', 'total=', count)
    return { libraryItems, count }
  }
}