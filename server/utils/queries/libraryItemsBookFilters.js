const Sequelize = require('sequelize')
const Database = require('../../Database')
const Logger = require('../../Logger')
const authorFilters = require('./authorFilters')
const { asciiOnlyToLowerCase } = require('../index')

module.exports = {
  /**
   * User permissions to restrict books for explicit content & tags
   * @param {import('../../objects/user/User')} user 
   * @returns {{ bookWhere:Sequelize.WhereOptions, replacements:object }}
   */
  getUserPermissionBookWhereQuery(user) {
    const bookWhere = []
    const replacements = {}
    if (!user) return { bookWhere, replacements }

    if (!user.canAccessExplicitContent) {
      bookWhere.push({
        explicit: false
      })
    }
    if (!user.permissions.accessAllTags && user.itemTagsSelected.length) {
      replacements['userTagsSelected'] = user.itemTagsSelected
      if (user.permissions.selectedTagsNotAccessible) {
        bookWhere.push(Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected))`), 0))
      } else {
        bookWhere.push(Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected))`), {
          [Sequelize.Op.gte]: 1
        }))
      }
    }
    return {
      bookWhere,
      replacements
    }
  },

  /**
   * When collapsing series and filtering by progress
   * different where options are required
   * 
   * @param {string} value 
   * @returns {Sequelize.WhereOptions}
   */
  getCollapseSeriesMediaProgressFilter(value) {
    const mediaWhere = {}
    if (value === 'not-finished') {
      mediaWhere['$books.mediaProgresses.isFinished$'] = {
        [Sequelize.Op.or]: [null, false]
      }
    } else if (value === 'not-started') {
      mediaWhere[Sequelize.Op.and] = [
        {
          '$books.mediaProgresses.currentTime$': {
            [Sequelize.Op.or]: [null, 0]
          }
        },
        {
          '$books.mediaProgresses.isFinished$': {
            [Sequelize.Op.or]: [null, false]
          }
        }
      ]
    } else if (value === 'finished') {
      mediaWhere['$books.mediaProgresses.isFinished$'] = true
    } else if (value === 'in-progress') {
      mediaWhere[Sequelize.Op.and] = [
        {
          [Sequelize.Op.or]: [
            {
              '$books.mediaProgresses.currentTime$': {
                [Sequelize.Op.gt]: 0
              }
            },
            {
              '$books.mediaProgresses.ebookProgress$': {
                [Sequelize.Op.gt]: 0
              }
            }
          ]
        },
        {
          '$books.mediaProgresses.isFinished$': false
        }
      ]
    }
    return mediaWhere
  },

  /**
   * Get where options for Book model
   * @param {string} group 
   * @param {[string]} value 
   * @returns {object} { Sequelize.WhereOptions, string[] }
   */
  getMediaGroupQuery(group, value) {
    if (!group) return { mediaWhere: {}, replacements: {} }

    let mediaWhere = {}
    const replacements = {}

    if (group === 'progress') {
      if (value === 'not-finished') {
        mediaWhere['$mediaProgresses.isFinished$'] = {
          [Sequelize.Op.or]: [null, false]
        }
      } else if (value === 'not-started') {
        mediaWhere[Sequelize.Op.and] = [
          {
            '$mediaProgresses.currentTime$': {
              [Sequelize.Op.or]: [null, 0]
            }
          },
          {
            '$mediaProgresses.isFinished$': {
              [Sequelize.Op.or]: [null, false]
            }
          }
        ]
      } else if (value === 'finished') {
        mediaWhere['$mediaProgresses.isFinished$'] = true
      } else if (value === 'in-progress') {
        mediaWhere[Sequelize.Op.and] = [
          {
            [Sequelize.Op.or]: [
              {
                '$mediaProgresses.currentTime$': {
                  [Sequelize.Op.gt]: 0
                }
              },
              {
                '$mediaProgresses.ebookProgress$': {
                  [Sequelize.Op.gt]: 0
                }
              }
            ]
          },
          {
            '$mediaProgresses.isFinished$': false
          }
        ]
      } else if (value === 'audio-in-progress') {
        mediaWhere[Sequelize.Op.and] = [
          {
            '$mediaProgresses.currentTime$': {
              [Sequelize.Op.gt]: 0
            }
          },
          {
            '$mediaProgresses.isFinished$': false
          }
        ]
      } else if (value === 'ebook-in-progress') {
        // Filters for ebook only
        mediaWhere = [
          Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('audioFiles')), 0),
          {
            '$mediaProgresses.ebookProgress$': {
              [Sequelize.Op.gt]: 0
            }
          },
          {
            '$mediaProgresses.isFinished$': false
          }
        ]
      } else if (value === 'ebook-finished') {
        // Filters for ebook only
        mediaWhere = [
          Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('audioFiles')), 0),
          {
            '$mediaProgresses.isFinished$': true,
            'ebookFile': {
              [Sequelize.Op.not]: null
            }
          }
        ]
      }
    } else if (group === 'series' && value === 'no-series') {
      mediaWhere['$series.id$'] = null
    } else if (group === 'abridged') {
      mediaWhere['abridged'] = true
    } else if (['genres', 'tags', 'narrators'].includes(group)) {
      mediaWhere[group] = Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(${group}) WHERE json_valid(${group}) AND json_each.value = :filterValue)`), {
        [Sequelize.Op.gte]: 1
      })
      replacements.filterValue = value
    } else if (group === 'publishers') {
      mediaWhere['publisher'] = value
    } else if (group === 'languages') {
      mediaWhere['language'] = value
    } else if (group === 'tracks') {
      if (value === 'none') {
        mediaWhere = Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('audioFiles')), 0)
      } else if (value === 'multi') {
        mediaWhere = Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('audioFiles')), {
          [Sequelize.Op.gt]: 1
        })
      } else {
        mediaWhere = Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('audioFiles')), 1)
      }
    } else if (group === 'ebooks') {
      if (value === 'ebook') {
        mediaWhere['ebookFile'] = {
          [Sequelize.Op.not]: null
        }
      }
    } else if (group === 'missing') {
      if (['asin', 'isbn', 'subtitle', 'publishedYear', 'description', 'publisher', 'language', 'cover'].includes(value)) {
        let key = value
        if (value === 'cover') key = 'coverPath'
        mediaWhere[key] = {
          [Sequelize.Op.or]: [null, '']
        }
      } else if (['genres', 'tags', 'narrators'].includes(value)) {
        mediaWhere[value] = {
          [Sequelize.Op.or]: [null, Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col(value)), 0)]
        }
      } else if (value === 'authors') {
        mediaWhere['$authors.id$'] = null
      } else if (value === 'series') {
        mediaWhere['$series.id$'] = null
      }
    }

    return { mediaWhere, replacements }
  },

  /**
   * Get sequelize order
   * @param {string} sortBy 
   * @param {boolean} sortDesc 
   * @param {boolean} collapseseries
   * @returns {Sequelize.order}
   */
  getOrder(sortBy, sortDesc, collapseseries) {
    const dir = sortDesc ? 'DESC' : 'ASC'
    if (sortBy === 'addedAt') {
      return [[Sequelize.literal('libraryItem.createdAt'), dir]]
    } else if (sortBy === 'size') {
      return [[Sequelize.literal('libraryItem.size'), dir]]
    } else if (sortBy === 'birthtimeMs') {
      return [[Sequelize.literal('libraryItem.birthtime'), dir]]
    } else if (sortBy === 'mtimeMs') {
      return [[Sequelize.literal('libraryItem.mtime'), dir]]
    } else if (sortBy === 'media.duration') {
      return [['duration', dir]]
    } else if (sortBy === 'media.metadata.publishedYear') {
      return [['publishedYear', dir]]
    } else if (sortBy === 'media.metadata.authorNameLF') {
      return [[Sequelize.literal('author_name COLLATE NOCASE'), dir]]
    } else if (sortBy === 'media.metadata.authorName') {
      return [[Sequelize.literal('author_name COLLATE NOCASE'), dir]]
    } else if (sortBy === 'media.metadata.title') {
      if (collapseseries) {
        return [[Sequelize.literal('display_title COLLATE NOCASE'), dir]]
      }

      if (global.ServerSettings.sortingIgnorePrefix) {
        return [[Sequelize.literal('titleIgnorePrefix COLLATE NOCASE'), dir]]
      } else {
        return [[Sequelize.literal('`book`.`title` COLLATE NOCASE'), dir]]
      }
    } else if (sortBy === 'sequence') {
      const nullDir = sortDesc ? 'DESC NULLS FIRST' : 'ASC NULLS LAST'
      return [[Sequelize.literal(`CAST(\`series.bookSeries.sequence\` AS FLOAT) ${nullDir}`)]]
    } else if (sortBy === 'progress') {
      return [[Sequelize.literal('mediaProgresses.updatedAt'), dir]]
    }
    return []
  },

  /**
   * When collapsing series get first book in each series
   * to know which books to exclude from primary query.
   * Additionally use this query to get the number of books in each series
   * 
   * @param {Sequelize.ModelStatic} bookFindOptions 
   * @param {Sequelize.WhereOptions} seriesWhere 
   * @returns {object} { booksToExclude, bookSeriesToInclude }
   */
  async getCollapseSeriesBooksToExclude(bookFindOptions, seriesWhere) {
    const allSeries = await Database.seriesModel.findAll({
      attributes: [
        'id',
        'name',
        [Sequelize.literal('(SELECT count(*) FROM bookSeries bs WHERE bs.seriesId = series.id)'), 'numBooks']
      ],
      distinct: true,
      subQuery: false,
      where: seriesWhere,
      include: [
        {
          model: Database.bookModel,
          attributes: ['id', 'title'],
          through: {
            attributes: ['id', 'seriesId', 'bookId', 'sequence']
          },
          ...bookFindOptions,
          required: true
        }
      ],
      order: [
        Sequelize.literal('CAST(`books.bookSeries.sequence` AS FLOAT) ASC NULLS LAST')
      ]
    })
    const bookSeriesToInclude = []
    const booksToInclude = []
    let booksToExclude = []
    allSeries.forEach(s => {
      let found = false
      for (let book of s.books) {
        if (!found && !booksToInclude.includes(book.id)) {
          booksToInclude.push(book.id)
          bookSeriesToInclude.push({
            id: book.bookSeries.id,
            numBooks: s.dataValues.numBooks
          })
          booksToExclude = booksToExclude.filter(bid => bid !== book.id)
          found = true
        } else if (!booksToExclude.includes(book.id) && !booksToInclude.includes(book.id)) {
          booksToExclude.push(book.id)
        }
      }
    })
    return { booksToExclude, bookSeriesToInclude }
  },

  /**
   * Get library items for book media type using filter and sort
   * @param {string} libraryId 
   * @param {[oldUser]} user
   * @param {[string]} filterGroup 
   * @param {[string]} filterValue 
   * @param {string} sortBy 
   * @param {string} sortDesc 
   * @param {boolean} collapseseries
   * @param {string[]} include
   * @param {number} limit 
   * @param {number} offset 
   * @param {boolean} isHomePage for home page shelves
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getFilteredLibraryItems(libraryId, user, filterGroup, filterValue, sortBy, sortDesc, collapseseries, include, limit, offset, isHomePage = false) {
    // TODO: Handle collapse sub-series
    if (filterGroup === 'series' && collapseseries) {
      collapseseries = false
    }
    if (filterGroup !== 'series' && sortBy === 'sequence') {
      sortBy = 'media.metadata.title'
    }
    if (filterGroup !== 'progress' && sortBy === 'progress') {
      sortBy = 'media.metadata.title'
    }
    const includeRSSFeed = include.includes('rssfeed')

    // For sorting by author name an additional attribute must be added
    //   with author names concatenated
    let bookAttributes = null
    if (sortBy === 'media.metadata.authorNameLF') {
      bookAttributes = {
        include: [
          [Sequelize.literal(`(SELECT group_concat(a.lastFirst, ", ") FROM authors AS a, bookAuthors as ba WHERE ba.authorId = a.id AND ba.bookId = book.id)`), 'author_name']
        ]
      }
    } else if (sortBy === 'media.metadata.authorName') {
      bookAttributes = {
        include: [
          [Sequelize.literal(`(SELECT group_concat(a.name, ", ") FROM authors AS a, bookAuthors as ba WHERE ba.authorId = a.id AND ba.bookId = book.id)`), 'author_name']
        ]
      }
    }

    const libraryItemWhere = {
      libraryId
    }

    let seriesInclude = {
      model: Database.bookSeriesModel,
      attributes: ['id', 'seriesId', 'sequence', 'createdAt'],
      include: {
        model: Database.seriesModel,
        attributes: ['id', 'name', 'nameIgnorePrefix']
      },
      order: [
        ['createdAt', 'ASC']
      ],
      separate: true
    }

    let authorInclude = {
      model: Database.bookAuthorModel,
      attributes: ['authorId', 'createdAt'],
      include: {
        model: Database.authorModel,
        attributes: ['id', 'name']
      },
      order: [
        ['createdAt', 'ASC']
      ],
      separate: true
    }

    const sortOrder = this.getOrder(sortBy, sortDesc, collapseseries)

    const libraryItemIncludes = []
    const bookIncludes = []
    if (includeRSSFeed) {
      libraryItemIncludes.push({
        model: Database.feedModel,
        required: filterGroup === 'feed-open'
      })
    }
    if (filterGroup === 'feed-open' && !includeRSSFeed) {
      libraryItemIncludes.push({
        model: Database.feedModel,
        required: true
      })
    } else if (filterGroup === 'ebooks' && filterValue === 'supplementary') {
      // TODO: Temp workaround for filtering supplementary ebook
      libraryItemWhere['libraryFiles'] = {
        [Sequelize.Op.substring]: `"isSupplementary":true`
      }
    } else if (filterGroup === 'missing' && filterValue === 'authors') {
      authorInclude = {
        model: Database.authorModel,
        attributes: ['id'],
        through: {
          attributes: []
        }
      }
    } else if ((filterGroup === 'series' && filterValue === 'no-series') || (filterGroup === 'missing' && filterValue === 'series')) {
      seriesInclude = {
        model: Database.seriesModel,
        attributes: ['id'],
        through: {
          attributes: []
        }
      }
    } else if (filterGroup === 'authors') {
      bookIncludes.push({
        model: Database.authorModel,
        attributes: ['id', 'name'],
        where: {
          id: filterValue
        },
        through: {
          attributes: []
        }
      })
    } else if (filterGroup === 'series') {
      bookIncludes.push({
        model: Database.seriesModel,
        attributes: ['id', 'name'],
        where: {
          id: filterValue
        },
        through: {
          attributes: ['sequence']
        }
      })
      if (sortBy !== 'sequence') {
        // Secondary sort by sequence
        sortOrder.push([Sequelize.literal('CAST(`series.bookSeries.sequence` AS FLOAT) ASC NULLS LAST')])
      }
    } else if (filterGroup === 'issues') {
      libraryItemWhere[Sequelize.Op.or] = [
        {
          isMissing: true
        },
        {
          isInvalid: true
        }
      ]
    } else if (filterGroup === 'progress' && user) {
      const mediaProgressWhere = {
        userId: user.id
      }
      // Respect hide from continue listening for home page shelf
      if (isHomePage) {
        mediaProgressWhere.hideFromContinueListening = false
      }
      bookIncludes.push({
        model: Database.mediaProgressModel,
        attributes: ['id', 'isFinished', 'currentTime', 'ebookProgress', 'updatedAt'],
        where: mediaProgressWhere,
        required: false
      })
    } else if (filterGroup === 'recent') {
      libraryItemWhere['createdAt'] = {
        [Sequelize.Op.gte]: new Date(new Date() - (60 * 24 * 60 * 60 * 1000)) // 60 days ago
      }
    }

    let { mediaWhere, replacements } = this.getMediaGroupQuery(filterGroup, filterValue)

    let bookWhere = Array.isArray(mediaWhere) ? mediaWhere : [mediaWhere]

    // User permissions
    const userPermissionBookWhere = this.getUserPermissionBookWhereQuery(user)
    replacements = { ...replacements, ...userPermissionBookWhere.replacements }
    bookWhere.push(...userPermissionBookWhere.bookWhere)

    // Handle collapsed series
    let collapseSeriesBookSeries = []
    if (collapseseries) {
      let seriesBookWhere = null
      let seriesWhere = null
      if (filterGroup === 'progress') {
        seriesWhere = this.getCollapseSeriesMediaProgressFilter(filterValue)
      } else if (filterGroup === 'missing' && filterValue === 'authors') {
        seriesWhere = {
          ['$books.authors.id$']: null
        }
      } else {
        seriesBookWhere = bookWhere
      }

      const bookFindOptions = {
        where: seriesBookWhere,
        include: [
          {
            model: Database.libraryItemModel,
            required: true,
            where: libraryItemWhere,
            include: libraryItemIncludes
          },
          authorInclude,
          ...bookIncludes
        ]
      }
      const { booksToExclude, bookSeriesToInclude } = await this.getCollapseSeriesBooksToExclude(bookFindOptions, seriesWhere)
      if (booksToExclude.length) {
        bookWhere.push({
          id: {
            [Sequelize.Op.notIn]: booksToExclude
          }
        })
      }
      collapseSeriesBookSeries = bookSeriesToInclude
      if (!bookAttributes?.include) bookAttributes = { include: [] }

      // When collapsing series and sorting by title then use the series name instead of the book title
      //  for this set an attribute "display_title" to use in sorting
      if (global.ServerSettings.sortingIgnorePrefix) {
        bookAttributes.include.push([Sequelize.literal(`IFNULL((SELECT s.nameIgnorePrefix FROM bookSeries AS bs, series AS s WHERE bs.seriesId = s.id AND bs.bookId = book.id AND bs.id IN (${bookSeriesToInclude.map(v => `"${v.id}"`).join(', ')})), titleIgnorePrefix)`), 'display_title'])
      } else {
        bookAttributes.include.push([Sequelize.literal(`IFNULL((SELECT s.name FROM bookSeries AS bs, series AS s WHERE bs.seriesId = s.id AND bs.bookId = book.id AND bs.id IN (${bookSeriesToInclude.map(v => `"${v.id}"`).join(', ')})), \`book\`.\`title\`)`), 'display_title'])
      }
    }

    const { rows: books, count } = await Database.bookModel.findAndCountAll({
      where: bookWhere,
      distinct: true,
      attributes: bookAttributes,
      replacements,
      include: [
        {
          model: Database.libraryItemModel,
          required: true,
          where: libraryItemWhere,
          include: libraryItemIncludes
        },
        seriesInclude,
        authorInclude,
        ...bookIncludes
      ],
      order: sortOrder,
      subQuery: false,
      limit: limit || null,
      offset
    })

    const libraryItems = books.map((bookExpanded) => {
      const libraryItem = bookExpanded.libraryItem.toJSON()
      const book = bookExpanded.toJSON()

      if (filterGroup === 'series' && book.series?.length) {
        // For showing sequence on book cover when filtering for series
        libraryItem.series = {
          id: book.series[0].id,
          name: book.series[0].name,
          sequence: book.series[0].bookSeries?.sequence || null
        }
      }

      delete book.libraryItem
      delete book.authors
      delete book.series

      // For showing details of collapsed series
      if (collapseseries && book.bookSeries?.length) {
        const collapsedSeries = book.bookSeries.find(bs => collapseSeriesBookSeries.some(cbs => cbs.id === bs.id))
        if (collapsedSeries) {
          const collapseSeriesObj = collapseSeriesBookSeries.find(csbs => csbs.id === collapsedSeries.id)
          libraryItem.collapsedSeries = {
            id: collapsedSeries.series.id,
            name: collapsedSeries.series.name,
            nameIgnorePrefix: collapsedSeries.series.nameIgnorePrefix,
            sequence: collapsedSeries.sequence,
            numBooks: collapseSeriesObj?.numBooks || 0
          }
        }
      }

      if (libraryItem.feeds?.length) {
        libraryItem.rssFeed = libraryItem.feeds[0]
      }

      libraryItem.media = book

      return libraryItem
    })

    return {
      libraryItems,
      count
    }
  },

  /**
   * Get library items for continue series shelf
   * A series is included on the shelf if it meets the following:
   * 1. Has at least 1 finished book
   * 2. Has no books in progress
   * 3. Has at least 1 unfinished book
   * TODO: Reduce queries
   * @param {string} libraryId 
   * @param {oldUser} user 
   * @param {string[]} include 
   * @param {number} limit 
   * @param {number} offset 
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getContinueSeriesLibraryItems(libraryId, user, include, limit, offset) {
    const libraryItemIncludes = []
    if (include.includes('rssfeed')) {
      libraryItemIncludes.push({
        model: Database.feedModel
      })
    }

    const bookWhere = []
    // TODO: Permissions should also be applied to subqueries
    // User permissions
    const userPermissionBookWhere = this.getUserPermissionBookWhereQuery(user)
    bookWhere.push(...userPermissionBookWhere.bookWhere)

    const { rows: series, count } = await Database.seriesModel.findAndCountAll({
      where: [
        {
          id: {
            [Sequelize.Op.notIn]: user.seriesHideFromContinueListening
          },
          libraryId
        },
        // TODO: Simplify queries
        // Has at least 1 book finished
        Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM mediaProgresses mp, bookSeries bs WHERE bs.seriesId = series.id AND mp.mediaItemId = bs.bookId AND mp.userId = :userId AND mp.isFinished = 1)`), {
          [Sequelize.Op.gte]: 1
        }),
        // Has at least 1 book not finished
        Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM bookSeries bs LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = bs.bookId AND mp.userId = :userId WHERE bs.seriesId = series.id AND (mp.isFinished = 0 OR mp.isFinished IS NULL))`), {
          [Sequelize.Op.gte]: 1
        }),
        // Has no books in progress
        Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM mediaProgresses mp, bookSeries bs WHERE mp.mediaItemId = bs.bookId AND mp.userId = :userId AND bs.seriesId = series.id AND mp.isFinished = 0 AND mp.currentTime > 0)`), 0)
      ],
      attributes: {
        include: [
          [Sequelize.literal('(SELECT max(mp.updatedAt) FROM bookSeries bs, mediaProgresses mp WHERE mp.mediaItemId = bs.bookId AND mp.userId = :userId AND bs.seriesId = series.id)'), 'recent_progress']
        ]
      },
      replacements: {
        userId: user.id,
        ...userPermissionBookWhere.replacements
      },
      include: {
        model: Database.bookSeriesModel,
        attributes: ['bookId', 'sequence'],
        separate: true,
        subQuery: false,
        order: [
          [Sequelize.literal('CAST(sequence AS FLOAT) ASC NULLS LAST')]
        ],
        where: {
          '$book.mediaProgresses.isFinished$': {
            [Sequelize.Op.or]: [null, 0]
          }
        },
        include: {
          model: Database.bookModel,
          where: bookWhere,
          include: [
            {
              model: Database.libraryItemModel,
              include: libraryItemIncludes
            },
            {
              model: Database.authorModel,
              through: {
                attributes: []
              }
            },
            {
              model: Database.mediaProgressModel,
              where: {
                userId: user.id
              },
              required: false
            }
          ]
        }
      },
      order: [
        [Sequelize.literal('recent_progress DESC')]
      ],
      distinct: true,
      subQuery: false,
      limit,
      offset
    })

    const libraryItems = series.map(s => {
      if (!s.bookSeries.length) return null // this is only possible if user has restricted books in series
      const libraryItem = s.bookSeries[0].book.libraryItem.toJSON()
      const book = s.bookSeries[0].book.toJSON()
      delete book.libraryItem
      libraryItem.series = {
        id: s.id,
        name: s.name,
        sequence: s.bookSeries[0].sequence
      }
      if (libraryItem.feeds?.length) {
        libraryItem.rssFeed = libraryItem.feeds[0]
      }
      libraryItem.media = book
      return libraryItem
    }).filter(s => s)

    return {
      libraryItems,
      count
    }
  },

  /**
   * Get book library items for the "Discover" shelf
   * Random selection of books that are not started
   *  - only includes the first book of a not-started series
   * @param {string} libraryId 
   * @param {oldUser} user 
   * @param {string[]} include 
   * @param {number} limit 
   * @returns {object} {libraryItems:LibraryItem, count:number}
   */
  async getDiscoverLibraryItems(libraryId, user, include, limit) {
    const userPermissionBookWhere = this.getUserPermissionBookWhereQuery(user)

    // Step 1: Get the first book of every series that hasnt been started yet
    const seriesNotStarted = await Database.seriesModel.findAll({
      where: [
        {
          libraryId
        },
        Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM bookSeries bs LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = bs.bookId WHERE bs.seriesId = series.id AND mp.userId = :userId AND (mp.isFinished = 1 OR mp.currentTime > 0))`), 0)
      ],
      replacements: {
        userId: user.id,
        ...userPermissionBookWhere.replacements
      },
      attributes: ['id'],
      include: {
        model: Database.bookSeriesModel,
        attributes: ['bookId', 'sequence'],
        separate: true,
        required: true,
        include: {
          model: Database.bookModel,
          where: userPermissionBookWhere.bookWhere
        },
        order: [
          [Sequelize.literal('CAST(sequence AS FLOAT) ASC NULLS LAST')]
        ],
        limit: 1
      },
      subQuery: false,
      limit,
      order: Database.sequelize.random()
    })

    const booksFromSeriesToInclude = seriesNotStarted.map(se => se.bookSeries?.[0]?.bookId).filter(bid => bid)

    // optional include rssFeed
    const libraryItemIncludes = []
    if (include.includes('rssfeed')) {
      libraryItemIncludes.push({
        model: Database.feedModel
      })
    }

    // Step 2: Get books not started and not in a series OR is the first book of a series not started (ordered randomly)
    const { rows: books, count } = await Database.bookModel.findAndCountAll({
      where: [
        {
          '$mediaProgresses.isFinished$': {
            [Sequelize.Op.or]: [null, 0]
          },
          '$mediaProgresses.currentTime$': {
            [Sequelize.Op.or]: [null, 0]
          },
          [Sequelize.Op.or]: [
            Sequelize.where(Sequelize.literal(`(SELECT COUNT(*) FROM bookSeries bs where bs.bookId = book.id)`), 0),
            {
              id: {
                [Sequelize.Op.in]: booksFromSeriesToInclude
              }
            }
          ]
        },
        ...userPermissionBookWhere.bookWhere
      ],
      replacements: userPermissionBookWhere.replacements,
      include: [
        {
          model: Database.libraryItemModel,
          where: {
            libraryId
          },
          include: libraryItemIncludes
        },
        {
          model: Database.mediaProgressModel,
          where: {
            userId: user.id
          },
          required: false
        },
        {
          model: Database.bookAuthorModel,
          attributes: ['authorId'],
          include: {
            model: Database.authorModel
          },
          separate: true
        },
        {
          model: Database.bookSeriesModel,
          attributes: ['seriesId', 'sequence'],
          include: {
            model: Database.seriesModel
          },
          separate: true
        }
      ],
      subQuery: false,
      distinct: true,
      limit,
      order: Database.sequelize.random()
    })

    // Step 3: Map books to library items
    const libraryItems = books.map((bookExpanded) => {
      const libraryItem = bookExpanded.libraryItem.toJSON()
      const book = bookExpanded.toJSON()
      delete book.libraryItem
      libraryItem.media = book

      if (libraryItem.feeds?.length) {
        libraryItem.rssFeed = libraryItem.feeds[0]
      }

      return libraryItem
    })

    return {
      libraryItems,
      count
    }
  },

  /**
   * Get book library items in a collection
   * @param {oldCollection} collection 
   * @returns {Promise<LibraryItem[]>}
   */
  async getLibraryItemsForCollection(collection) {
    if (!collection?.books?.length) {
      Logger.error(`[libraryItemsBookFilters] Invalid collection`, collection)
      return []
    }

    const books = await Database.bookModel.findAll({
      include: [
        {
          model: Database.libraryItemModel,
          where: {
            id: {
              [Sequelize.Op.in]: collection.books
            }
          }
        },
        {
          model: Database.authorModel,
          through: {
            attributes: []
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['sequence']
          }
        }
      ]
    })

    return books.map((book) => {
      const libraryItem = book.libraryItem
      delete book.libraryItem
      libraryItem.media = book
      return libraryItem
    })
  },

  /**
   * Get library items for series
   * @param {import('../../objects/entities/Series')} oldSeries 
   * @param {import('../../objects/user/User')} [oldUser] 
   * @returns {Promise<import('../../objects/LibraryItem')[]>}
   */
  async getLibraryItemsForSeries(oldSeries, oldUser) {
    const { libraryItems } = await this.getFilteredLibraryItems(oldSeries.libraryId, oldUser, 'series', oldSeries.id, null, null, false, [], null, null)
    return libraryItems.map(li => Database.libraryItemModel.getOldLibraryItem(li))
  },

  /**
   * Search books, authors, series
   * @param {import('../../objects/user/User')} oldUser
   * @param {import('../../objects/Library')} oldLibrary 
   * @param {string} query 
   * @param {number} limit 
   * @param {number} offset 
   * @returns {{book:object[], narrators:object[], authors:object[], tags:object[], series:object[]}}
   */
  async search(oldUser, oldLibrary, query, limit, offset) {
    const userPermissionBookWhere = this.getUserPermissionBookWhereQuery(oldUser)

    // Search title, subtitle, asin, isbn
    const books = await Database.bookModel.findAll({
      where: [
        {
          [Sequelize.Op.or]: [
            {
              title: {
                [Sequelize.Op.substring]: query
              }
            },
            {
              subtitle: {
                [Sequelize.Op.substring]: query
              }
            },
            {
              asin: {
                [Sequelize.Op.substring]: query
              }
            },
            {
              isbn: {
                [Sequelize.Op.substring]: query
              }
            }
          ]
        },
        ...userPermissionBookWhere.bookWhere
      ],
      replacements: userPermissionBookWhere.replacements,
      include: [
        {
          model: Database.libraryItemModel,
          where: {
            libraryId: oldLibrary.id
          }
        },
        {
          model: Database.bookSeriesModel,
          include: {
            model: Database.seriesModel
          },
          separate: true
        },
        {
          model: Database.bookAuthorModel,
          include: {
            model: Database.authorModel
          },
          separate: true
        }
      ],
      subQuery: false,
      distinct: true,
      limit,
      offset
    })

    const itemMatches = []

    for (const book of books) {
      const libraryItem = book.libraryItem
      delete book.libraryItem
      libraryItem.media = book

      let matchText = null
      let matchKey = null
      for (const key of ['title', 'subtitle', 'asin', 'isbn']) {
        const valueToLower = asciiOnlyToLowerCase(book[key])
        if (valueToLower.includes(query)) {
          matchText = book[key]
          matchKey = key
          break
        }
      }

      if (matchKey) {
        itemMatches.push({
          matchText,
          matchKey,
          libraryItem: Database.libraryItemModel.getOldLibraryItem(libraryItem).toJSONExpanded()
        })
      }
    }

    // Search narrators
    const narratorMatches = []
    const [narratorResults] = await Database.sequelize.query(`SELECT value, count(*) AS numBooks FROM books b, libraryItems li, json_each(b.narrators) WHERE json_valid(b.narrators) AND json_each.value LIKE :query AND b.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value LIMIT :limit OFFSET :offset;`, {
      replacements: {
        query: `%${query}%`,
        libraryId: oldLibrary.id,
        limit,
        offset
      },
      raw: true
    })
    for (const row of narratorResults) {
      narratorMatches.push({
        name: row.value,
        numBooks: row.numBooks
      })
    }

    // Search tags
    const tagMatches = []
    const [tagResults] = await Database.sequelize.query(`SELECT value, count(*) AS numItems FROM books b, libraryItems li, json_each(b.tags) WHERE json_valid(b.tags) AND json_each.value LIKE :query AND b.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value LIMIT :limit OFFSET :offset;`, {
      replacements: {
        query: `%${query}%`,
        libraryId: oldLibrary.id,
        limit,
        offset
      },
      raw: true
    })
    for (const row of tagResults) {
      tagMatches.push({
        name: row.value,
        numItems: row.numItems
      })
    }

    // Search series
    const allSeries = await Database.seriesModel.findAll({
      where: {
        name: {
          [Sequelize.Op.substring]: query
        },
        libraryId: oldLibrary.id
      },
      replacements: userPermissionBookWhere.replacements,
      include: {
        separate: true,
        model: Database.bookSeriesModel,
        include: {
          model: Database.bookModel,
          where: userPermissionBookWhere.bookWhere,
          include: {
            model: Database.libraryItemModel
          }
        }
      },
      subQuery: false,
      distinct: true,
      limit,
      offset
    })
    const seriesMatches = []
    for (const series of allSeries) {
      const books = series.bookSeries.map((bs) => {
        const libraryItem = bs.book.libraryItem
        libraryItem.media = bs.book
        return Database.libraryItemModel.getOldLibraryItem(libraryItem).toJSON()
      })
      seriesMatches.push({
        series: series.getOldSeries().toJSON(),
        books
      })
    }

    // Search authors
    const authorMatches = await authorFilters.search(oldLibrary.id, query, limit, offset)

    return {
      book: itemMatches,
      narrators: narratorMatches,
      tags: tagMatches,
      series: seriesMatches,
      authors: authorMatches
    }
  },

  /**
   * Genres with num books
   * @param {string} libraryId 
   * @returns {{genre:string, count:number}[]}
   */
  async getGenresWithCount(libraryId) {
    const genres = []
    const [genreResults] = await Database.sequelize.query(`SELECT value, count(*) AS numItems FROM books b, libraryItems li, json_each(b.genres) WHERE json_valid(b.genres) AND b.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value ORDER BY numItems DESC;`, {
      replacements: {
        libraryId
      },
      raw: true
    })
    for (const row of genreResults) {
      genres.push({
        genre: row.value,
        count: row.numItems
      })
    }
    return genres
  },

  /**
   * Get stats for book library
   * @param {string} libraryId 
   * @returns {Promise<{ totalSize:number, totalDuration:number, numAudioFiles:number, totalItems:number}>}
   */
  async getBookLibraryStats(libraryId) {
    const [statResults] = await Database.sequelize.query(`SELECT SUM(li.size) AS totalSize, SUM(b.duration) AS totalDuration, SUM(json_array_length(b.audioFiles)) AS numAudioFiles, COUNT(*) AS totalItems FROM libraryItems li, books b WHERE b.id = li.mediaId AND li.libraryId = :libraryId;`, {
      replacements: {
        libraryId
      }
    })
    return statResults[0]
  },

  /**
   * Get longest books in library
   * @param {string} libraryId 
   * @param {number} limit 
   * @returns {Promise<{ id:string, title:string, duration:number }[]>}
   */
  async getLongestBooks(libraryId, limit) {
    const books = await Database.bookModel.findAll({
      attributes: ['id', 'title', 'duration'],
      include: {
        model: Database.libraryItemModel,
        attributes: ['id', 'libraryId'],
        where: {
          libraryId
        }
      },
      order: [
        ['duration', 'DESC']
      ],
      limit
    })
    return books.map(book => {
      return {
        id: book.libraryItem.id,
        title: book.title,
        duration: book.duration
      }
    })
  }
}