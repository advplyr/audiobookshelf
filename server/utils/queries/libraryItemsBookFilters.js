const Sequelize = require('sequelize')
const Database = require('../../Database')
const Logger = require('../../Logger')

module.exports = {
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
        mediaWhere[Sequelize.Op.and] = [
          {
            '$mediaProgresses.ebookProgress$': {
              [Sequelize.Op.gt]: 0
            }
          },
          {
            '$mediaProgresses.isFinished$': false
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
      if (value === 'multi') {
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
      } else if (['genres', 'tags', 'narrator'].includes(value)) {
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
        return [[Sequelize.literal('title COLLATE NOCASE'), dir]]
      }
    } else if (sortBy === 'sequence') {
      const nullDir = sortDesc ? 'DESC NULLS FIRST' : 'ASC NULLS LAST'
      return [[Sequelize.literal(`CAST(\`series.bookSeries.sequence\` AS INTEGER) COLLATE NOCASE ${nullDir}`)]]
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
    const allSeries = await Database.models.series.findAll({
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
          model: Database.models.book,
          attributes: ['id', 'title'],
          through: {
            attributes: ['id', 'seriesId', 'bookId', 'sequence']
          },
          ...bookFindOptions,
          required: true
        }
      ],
      order: [
        Sequelize.literal('CAST(`books.bookSeries.sequence` AS INTEGER) COLLATE NOCASE ASC NULLS LAST')
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
   * @param {[string]} filterGroup 
   * @param {[string]} filterValue 
   * @param {string} sortBy 
   * @param {string} sortDesc 
   * @param {boolean} collapseseries
   * @param {string[]} include
   * @param {number} limit 
   * @param {number} offset 
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getFilteredLibraryItems(libraryId, userId, filterGroup, filterValue, sortBy, sortDesc, collapseseries, include, limit, offset) {
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
      model: Database.models.bookSeries,
      attributes: ['id', 'seriesId', 'sequence', 'createdAt'],
      include: {
        model: Database.models.series,
        attributes: ['id', 'name', 'nameIgnorePrefix']
      },
      order: [
        ['createdAt', 'ASC']
      ],
      separate: true
    }

    let authorInclude = {
      model: Database.models.bookAuthor,
      attributes: ['authorId', 'createdAt'],
      include: {
        model: Database.models.author,
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
        model: Database.models.feed,
        required: filterGroup === 'feed-open'
      })
    }
    if (filterGroup === 'feed-open' && !includeRSSFeed) {
      libraryItemIncludes.push({
        model: Database.models.feed,
        required: true
      })
    } else if (filterGroup === 'ebooks' && filterValue === 'supplementary') {
      // TODO: Temp workaround for filtering supplementary ebook
      libraryItemWhere['libraryFiles'] = {
        [Sequelize.Op.substring]: `"isSupplementary":true`
      }
    } else if (filterGroup === 'missing' && filterValue === 'authors') {
      authorInclude = {
        model: Database.models.author,
        attributes: ['id'],
        through: {
          attributes: []
        }
      }
    } else if ((filterGroup === 'series' && filterValue === 'no-series') || (filterGroup === 'missing' && filterValue === 'series')) {
      seriesInclude = {
        model: Database.models.series,
        attributes: ['id'],
        through: {
          attributes: []
        }
      }
    } else if (filterGroup === 'authors') {
      bookIncludes.push({
        model: Database.models.author,
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
        model: Database.models.series,
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
        sortOrder.push([Sequelize.literal('CAST(`series.bookSeries.sequence` AS INTEGER) COLLATE NOCASE ASC NULLS LAST')])
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
    } else if (filterGroup === 'progress') {
      bookIncludes.push({
        model: Database.models.mediaProgress,
        attributes: ['id', 'isFinished', 'currentTime', 'ebookProgress', 'updatedAt'],
        where: {
          userId
        },
        required: false
      })
    }

    const { mediaWhere, replacements } = this.getMediaGroupQuery(filterGroup, filterValue)

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
        seriesBookWhere = mediaWhere
      }

      const bookFindOptions = {
        where: seriesBookWhere,
        include: [
          {
            model: Database.models.libraryItem,
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
        mediaWhere['id'] = {
          [Sequelize.Op.notIn]: booksToExclude
        }
      }
      collapseSeriesBookSeries = bookSeriesToInclude
      if (!bookAttributes?.include) bookAttributes = { include: [] }

      // When collapsing series and sorting by title then use the series name instead of the book title
      //  for this set an attribute "display_title" to use in sorting
      if (global.ServerSettings.sortingIgnorePrefix) {
        bookAttributes.include.push([Sequelize.literal(`IFNULL((SELECT s.nameIgnorePrefix FROM bookSeries AS bs, series AS s WHERE bs.seriesId = s.id AND bs.bookId = book.id AND bs.id IN (${bookSeriesToInclude.map(v => `"${v.id}"`).join(', ')})), titleIgnorePrefix)`), 'display_title'])
      } else {
        bookAttributes.include.push([Sequelize.literal(`IFNULL((SELECT s.name FROM bookSeries AS bs, series AS s WHERE bs.seriesId = s.id AND bs.bookId = book.id AND bs.id IN (${bookSeriesToInclude.map(v => `"${v.id}"`).join(', ')})), title)`), 'display_title'])
      }
    }

    const { rows: books, count } = await Database.models.book.findAndCountAll({
      where: mediaWhere,
      distinct: true,
      attributes: bookAttributes,
      replacements,
      include: [
        {
          model: Database.models.libraryItem,
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
      limit,
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
    Logger.debug('Found', libraryItems.length, 'library items', 'total=', count)
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
   * @param {string} userId 
   * @param {string[]} include 
   * @param {number} limit 
   * @param {number} offset 
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getContinueSeriesLibraryItems(libraryId, userId, include, limit, offset) {
    // Step 1: Get all media progress for user that belongs to a series book
    const mediaProgressForUserForSeries = await Database.models.mediaProgress.findAll({
      where: {
        userId
      },
      include: [
        {
          model: Database.models.book,
          attributes: ['id', 'title'],
          include: {
            model: Database.models.series,
            attributes: ['id'],
            through: {
              attributes: []
            },
            required: true
          },
          required: true
        }
      ]
    })

    // Step 1.5: Identify the series that have at least 1 finished book and have no books in progress
    let seriesToInclude = []
    let seriesToExclude = []
    for (const prog of mediaProgressForUserForSeries) {
      const series = prog.mediaItem?.series || []
      for (const s of series) {
        if (prog.currentTime > 0 && !prog.isFinished) { // in-progress
          seriesToInclude = seriesToInclude.filter(sid => sid !== s.id)
          if (!seriesToExclude.includes(s.id)) seriesToExclude.push(s.id)
        } else if (prog.isFinished && !seriesToExclude.includes(s.id) && !seriesToInclude.includes(s.id)) { // finished
          seriesToInclude.push(s.id)
        }
      }
    }

    // optional include rssFeed with library item
    const libraryItemIncludes = []
    if (include.includes('rssfeed')) {
      libraryItemIncludes.push({
        model: Database.models.feed
      })
    }

    // Step 2: Get all series identified in step 1.5 and filter out series where all books are finished
    const { rows: series, count } = await Database.models.series.findAndCountAll({
      where: {
        id: {
          [Sequelize.Op.in]: seriesToInclude
        },
        '$bookSeries.book.mediaProgresses.isFinished$': {
          [Sequelize.Op.or]: [false, null]
        }
      },
      distinct: true,
      include: [
        {
          model: Database.models.bookSeries,
          include: {
            model: Database.models.book,
            include: [
              {
                model: Database.models.libraryItem,
                where: {
                  libraryId
                },
                include: libraryItemIncludes
              },
              {
                model: Database.models.bookAuthor,
                attributes: ['authorId'],
                include: {
                  model: Database.models.author
                },
                separate: true
              },
              {
                model: Database.models.mediaProgress,
                where: {
                  userId
                },
                required: false
              }
            ],
            required: true
          },
          required: true
        }
      ],
      order: [
        // Sort by progress most recently updated
        [Database.models.bookSeries, Database.models.book, Database.models.mediaProgress, 'updatedAt', 'DESC'],
      ],
      subQuery: false,
      limit,
      offset
    })

    Logger.debug('Found', series.length, 'series to continue', 'total=', count)

    // Step 3: Map series to library items by selecting the first unfinished book in the series
    const libraryItems = series.map(s => {
      // Natural sort sequence, nulls last
      // TODO: sort in query. was unable to sort nested association with sequelize
      s.bookSeries.sort((a, b) => {
        if (!a.sequence) return 1
        if (!b.sequence) return -1
        return a.sequence.localeCompare(b.sequence, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      })

      // Get first unfinished book to use
      const bookSeries = s.bookSeries.find(bs => !bs.book.mediaProgresses?.[0]?.isFinished)
      const libraryItem = bookSeries.book.libraryItem.toJSON()

      libraryItem.series = {
        id: s.id,
        name: s.name,
        sequence: bookSeries.sequence
      }

      if (libraryItem.feeds?.length) {
        libraryItem.rssFeed = libraryItem.feeds[0]
      }

      libraryItem.media = bookSeries.book
      return libraryItem
    })
    return {
      libraryItems,
      count
    }
  }
}