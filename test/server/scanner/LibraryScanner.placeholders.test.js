const chai = require('chai')
const sinon = require('sinon')

const LibraryScanner = require('../../../server/scanner/LibraryScanner')
const LibraryScan = require('../../../server/scanner/LibraryScan')
const LibraryItemScanner = require('../../../server/scanner/LibraryItemScanner')
const Database = require('../../../server/Database')
const libraryFilters = require('../../../server/utils/queries/libraryFilters')
const SocketAuthority = require('../../../server/SocketAuthority')
const fs = require('../../../server/libs/fsExtra')
const { ScanResult } = require('../../../server/utils/constants')

const expect = chai.expect

describe('LibraryScanner placeholder handling', () => {
  let originalSequelize

  beforeEach(() => {
    originalSequelize = Database.sequelize
    Database.sequelize = {
      models: {
        libraryItem: {
          findAll: () => {},
          getExpandedById: () => {},
          update: () => {},
          findOneExpanded: () => {},
          findOne: () => {}
        }
      }
    }
  })

  afterEach(() => {
    Database.sequelize = originalSequelize
    sinon.restore()
  })

  it('skips missing checks for placeholder items during full scans', async () => {
    const library = {
      id: 'library-1',
      name: 'Test Library',
      mediaType: 'book',
      settings: {},
      libraryFolders: [
        {
          id: 'folder-1',
          path: '/library'
        }
      ]
    }

    const libraryScan = new LibraryScan()
    libraryScan.setData(library)

    const placeholderItem = {
      id: 'item-1',
      path: '/library/Series/Placeholder',
      relPath: 'Series/Placeholder',
      ino: 123,
      isPlaceholder: true,
      isMissing: false,
      libraryFiles: [],
      save: sinon.stub().resolves(),
      changed: sinon.stub()
    }

    sinon.stub(libraryFilters, 'getFilterData').resolves()
    sinon.stub(LibraryScanner, 'scanFolder').resolves([])
    const findAllStub = sinon.stub(Database.libraryItemModel, 'findAll').resolves([placeholderItem])
    const getExpandedStub = sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(null)
    const updateStub = sinon.stub(Database.libraryItemModel, 'update').resolves()
    const checkAuthorsStub = sinon.stub(LibraryItemScanner, 'checkAuthorsAndSeriesRemovedFromBooks').resolves()

    await LibraryScanner.scanLibrary(libraryScan, false)

    expect(findAllStub.calledOnce).to.be.true
    expect(getExpandedStub.called).to.be.false
    expect(updateStub.called).to.be.false
    expect(checkAuthorsStub.calledOnce).to.be.true
    expect(libraryScan.resultsMissing).to.equal(0)
  })

  it('promotes placeholders when audio files are detected in folder updates', async () => {
    const library = {
      id: 'library-1',
      name: 'Test Library',
      mediaType: 'book',
      settings: {}
    }
    const folder = {
      id: 'folder-1',
      path: '/library',
      libraryId: library.id
    }

    const placeholderItem = {
      id: 'item-1',
      path: '/library/Series/Placeholder',
      relPath: 'Series/Placeholder',
      isPlaceholder: true,
      isMissing: false,
      media: { title: 'Placeholder Book' },
      save: sinon.stub().resolves(),
      changed: sinon.stub()
    }

    sinon.stub(libraryFilters, 'getFilterData').resolves()
    sinon.stub(Database.libraryItemModel, 'findOneExpanded').resolves(placeholderItem)
    sinon.stub(Database.libraryItemModel, 'findOne').resolves(null)
    sinon.stub(fs, 'pathExists').resolves(true)
    const scanLibraryItemStub = sinon.stub(LibraryItemScanner, 'scanLibraryItem').resolves(ScanResult.UPDATED)
    sinon.stub(SocketAuthority, 'libraryItemEmitter')

    const fileUpdateGroup = {
      'Series/Placeholder': ['track-01.mp3']
    }

    const results = await LibraryScanner.scanFolderUpdates(library, folder, fileUpdateGroup)

    expect(placeholderItem.isPlaceholder).to.be.false
    expect(placeholderItem.save.calledOnce).to.be.true
    expect(scanLibraryItemStub.calledOnce).to.be.true
    expect(results['Series/Placeholder']).to.equal(ScanResult.UPDATED)
  })

  it('promotes placeholders during full scans when media is present', async () => {
    const library = {
      id: 'library-1',
      name: 'Test Library',
      mediaType: 'book',
      settings: {},
      libraryFolders: [
        {
          id: 'folder-1',
          path: '/library'
        }
      ]
    }

    const libraryScan = new LibraryScan()
    libraryScan.setData(library)

    const placeholderItem = {
      id: 'item-1',
      path: '/library/Series/Placeholder',
      relPath: 'Series/Placeholder',
      isPlaceholder: true,
      isMissing: false,
      save: sinon.stub().resolves(),
      changed: sinon.stub()
    }

    const libraryItemData = {
      path: placeholderItem.path,
      audioLibraryFiles: [{ metadata: { ext: '.mp3' } }],
      ebookLibraryFiles: [],
      hasLibraryFileChanges: true,
      hasPathChange: false,
      checkLibraryItemData: sinon.stub().resolves(true)
    }

    sinon.stub(libraryFilters, 'getFilterData').resolves()
    sinon.stub(LibraryScanner, 'scanFolder').resolves([libraryItemData])
    sinon.stub(Database.libraryItemModel, 'findAll').resolves([placeholderItem])
    sinon.stub(LibraryItemScanner, 'rescanLibraryItemMedia').resolves({ libraryItem: placeholderItem, wasUpdated: true })
    sinon.stub(LibraryItemScanner, 'checkAuthorsAndSeriesRemovedFromBooks').resolves()
    sinon.stub(SocketAuthority, 'libraryItemsEmitter')

    await LibraryScanner.scanLibrary(libraryScan, false)

    expect(placeholderItem.isPlaceholder).to.be.false
    expect(placeholderItem.save.calledOnce).to.be.true
  })

  it('skips placeholder scans on file updates without audio', async () => {
    const library = {
      id: 'library-1',
      name: 'Test Library',
      mediaType: 'book',
      settings: {}
    }
    const folder = {
      id: 'folder-1',
      path: '/library',
      libraryId: library.id
    }

    const placeholderItem = {
      id: 'item-1',
      path: '/library/Series/Placeholder',
      relPath: 'Series/Placeholder',
      isPlaceholder: true,
      isMissing: false,
      media: { title: 'Placeholder Book' },
      save: sinon.stub().resolves(),
      changed: sinon.stub()
    }

    sinon.stub(libraryFilters, 'getFilterData').resolves()
    sinon.stub(Database.libraryItemModel, 'findOneExpanded').resolves(placeholderItem)
    sinon.stub(Database.libraryItemModel, 'findOne').resolves(null)
    sinon.stub(fs, 'pathExists').resolves(true)
    const scanLibraryItemStub = sinon.stub(LibraryItemScanner, 'scanLibraryItem').resolves(ScanResult.UPDATED)
    sinon.stub(SocketAuthority, 'libraryItemEmitter')

    const fileUpdateGroup = {
      'Series/Placeholder': ['cover.jpg']
    }

    const results = await LibraryScanner.scanFolderUpdates(library, folder, fileUpdateGroup)

    expect(scanLibraryItemStub.called).to.be.false
    expect(results['Series/Placeholder']).to.equal(ScanResult.NOTHING)
  })

  it('ignores missing checks for placeholders on file updates when path is gone', async () => {
    const library = {
      id: 'library-1',
      name: 'Test Library',
      mediaType: 'book',
      settings: {}
    }
    const folder = {
      id: 'folder-1',
      path: '/library',
      libraryId: library.id
    }

    const placeholderItem = {
      id: 'item-1',
      path: '/library/Series/Placeholder',
      relPath: 'Series/Placeholder',
      isPlaceholder: true,
      isMissing: false,
      media: { title: 'Placeholder Book' },
      save: sinon.stub().resolves(),
      changed: sinon.stub()
    }

    sinon.stub(libraryFilters, 'getFilterData').resolves()
    sinon.stub(Database.libraryItemModel, 'findOneExpanded').resolves(placeholderItem)
    sinon.stub(Database.libraryItemModel, 'findOne').resolves(null)
    sinon.stub(fs, 'pathExists').resolves(false)
    const scanLibraryItemStub = sinon.stub(LibraryItemScanner, 'scanLibraryItem').resolves(ScanResult.UPDATED)
    sinon.stub(SocketAuthority, 'libraryItemEmitter')

    const fileUpdateGroup = {
      'Series/Placeholder': ['track-01.mp3']
    }

    const results = await LibraryScanner.scanFolderUpdates(library, folder, fileUpdateGroup)

    expect(scanLibraryItemStub.called).to.be.false
    expect(results['Series/Placeholder']).to.equal(ScanResult.NOTHING)
  })
})
