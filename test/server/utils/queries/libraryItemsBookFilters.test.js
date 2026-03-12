const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../../server/Database')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')
const Logger = require('../../../../server/Logger')

describe('libraryItemsBookFilters', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  describe('getContinueSeriesLibraryItems', () => {
    async function createSeriesWithBooks(library, libraryFolderId, user, seriesName, bookDefs) {
      const series = await Database.seriesModel.create({
        name: seriesName,
        libraryId: library.id
      })

      const books = []
      const libraryItems = []

      for (const def of bookDefs) {
        const book = await Database.bookModel.create({
          title: `${seriesName} - Book ${def.sequence}`,
          audioFiles: [],
          tags: []
        })
        books.push(book)

        const libraryItem = await Database.libraryItemModel.create({
          libraryFiles: [],
          mediaId: book.id,
          mediaType: 'book',
          libraryId: library.id,
          libraryFolderId
        })
        libraryItems.push(libraryItem)

        await Database.bookSeriesModel.create({
          bookId: book.id,
          seriesId: series.id,
          sequence: def.sequence
        })

        if (def.isFinished || def.currentTime) {
          await Database.mediaProgressModel.create({
            userId: user.id,
            mediaItemId: book.id,
            mediaItemType: 'book',
            duration: 36000,
            currentTime: def.isFinished ? 36000 : (def.currentTime || 0),
            isFinished: !!def.isFinished,
            finishedAt: def.isFinished ? (def.finishedAt || new Date()) : null,
            extraData: { libraryItemId: libraryItem.id }
          })
        }
      }

      return { series, books, libraryItems }
    }

    let user, library, libraryFolderId

    beforeEach(async () => {
      user = await Database.userModel.create({
        username: 'testuser',
        type: 'root',
        isActive: true,
        permissions: Database.userModel.getDefaultPermissionsForUserType('root'),
        extraData: { seriesHideFromContinueListening: [] }
      })

      library = await Database.libraryModel.create({
        name: 'Test Library',
        mediaType: 'book',
        settings: {
          ...Database.libraryModel.getDefaultLibrarySettingsForMediaType('book'),
          onlyShowLaterBooksInContinueSeries: false
        }
      })

      const folder = await Database.libraryFolderModel.create({
        path: '/test',
        libraryId: library.id
      })
      libraryFolderId = folder.id
    })

    describe('with onlyShowLaterBooksInContinueSeries OFF', () => {
      it('should show the first unfinished book in the series', async () => {
        await createSeriesWithBooks(library, libraryFolderId, user, 'Fantasy Series', [
          { sequence: '1', isFinished: true, finishedAt: new Date('2025-01-01') },
          { sequence: '2', isFinished: true, finishedAt: new Date('2025-02-01') },
          { sequence: '3', isFinished: false },
          { sequence: '4', isFinished: false }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.have.lengthOf(1)
        expect(result.libraryItems[0].series.sequence).to.equal('3')
      })

      it('should not include series where a book is in progress', async () => {
        await createSeriesWithBooks(library, libraryFolderId, user, 'Active Series', [
          { sequence: '1', isFinished: true, finishedAt: new Date('2025-01-01') },
          { sequence: '2', currentTime: 500 },
          { sequence: '3', isFinished: false }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.be.empty
      })

      it('should not include series where all books are finished', async () => {
        await createSeriesWithBooks(library, libraryFolderId, user, 'Done Series', [
          { sequence: '1', isFinished: true, finishedAt: new Date('2025-01-01') },
          { sequence: '2', isFinished: true, finishedAt: new Date('2025-02-01') }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.be.empty
      })
    })

    describe('with onlyShowLaterBooksInContinueSeries ON', () => {
      beforeEach(() => {
        library.settings.onlyShowLaterBooksInContinueSeries = true
      })

      it('should show the next book after the most recently finished book', async () => {
        await createSeriesWithBooks(library, libraryFolderId, user, 'Fantasy Series', [
          { sequence: '1', isFinished: true, finishedAt: new Date('2025-01-01') },
          { sequence: '2', isFinished: true, finishedAt: new Date('2025-02-01') },
          { sequence: '3', isFinished: true, finishedAt: new Date('2025-03-01') },
          { sequence: '4', isFinished: false },
          { sequence: '5', isFinished: false }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.have.lengthOf(1)
        expect(result.libraryItems[0].series.sequence).to.equal('4')
      })

      it('should show next book after re-read position, not next globally unread', async () => {
        // Books 1-5 finished, then book 1 re-read (most recent finishedAt)
        await createSeriesWithBooks(library, libraryFolderId, user, 'Re-read Series', [
          { sequence: '1', isFinished: true, finishedAt: new Date('2025-06-01') },
          { sequence: '2', isFinished: true, finishedAt: new Date('2025-02-01') },
          { sequence: '3', isFinished: true, finishedAt: new Date('2025-03-01') },
          { sequence: '4', isFinished: true, finishedAt: new Date('2025-04-01') },
          { sequence: '5', isFinished: true, finishedAt: new Date('2025-05-01') },
          { sequence: '6', isFinished: false }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.have.lengthOf(1)
        expect(result.libraryItems[0].series.sequence).to.equal('2')
      })

      it('should fall back to highest finished sequence when books are batch-finished', async () => {
        const batchTime = new Date('2025-01-01')
        await createSeriesWithBooks(library, libraryFolderId, user, 'Batch Series', [
          { sequence: '1', isFinished: true, finishedAt: batchTime },
          { sequence: '2', isFinished: true, finishedAt: batchTime },
          { sequence: '3', isFinished: true, finishedAt: batchTime },
          { sequence: '4', isFinished: false },
          { sequence: '5', isFinished: false }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.have.lengthOf(1)
        expect(result.libraryItems[0].series.sequence).to.equal('4')
      })

      it('should skip earlier unfinished books like prequels', async () => {
        await createSeriesWithBooks(library, libraryFolderId, user, 'Prequel Series', [
          { sequence: '0', isFinished: false },
          { sequence: '1', isFinished: true, finishedAt: new Date('2025-01-01') },
          { sequence: '2', isFinished: true, finishedAt: new Date('2025-02-01') },
          { sequence: '3', isFinished: false }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.have.lengthOf(1)
        expect(result.libraryItems[0].series.sequence).to.equal('3')
      })

      it('should return empty when no books exist after last finished', async () => {
        await createSeriesWithBooks(library, libraryFolderId, user, 'Complete Series', [
          { sequence: '1', isFinished: true, finishedAt: new Date('2025-01-01') },
          { sequence: '2', isFinished: true, finishedAt: new Date('2025-02-01') }
        ])

        const result = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, [], 10, 0)

        expect(result.libraryItems).to.be.empty
      })
    })
  })
})
