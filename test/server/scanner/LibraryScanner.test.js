const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')
const fs = require('../../../server/libs/fsExtra')
const fileUtils = require('../../../server/utils/fileUtils')
const libraryFilters = require('../../../server/utils/queries/libraryFilters')
const { ScanResult } = require('../../../server/utils/constants')
const LibraryScanner = require('../../../server/scanner/LibraryScanner')
const LibraryItemScanner = require('../../../server/scanner/LibraryItemScanner')

/**
 * Unit tests for the order LibraryScanner.scanFolderUpdates checks watcher file update groups in, which is what
 * lets a moved item be matched at its new path instead of being duplicated.
 */
describe('LibraryScanner.scanFolderUpdates', () => {
  const library = { id: 'lib1', name: 'Test Library', mediaType: 'book', settings: {} }
  const folder = { id: 'folder1', path: '/lib' }

  let calls
  let libraryItemModel
  let existingPaths
  let libraryItemsByPath

  beforeEach(() => {
    calls = []
    existingPaths = new Set()
    libraryItemsByPath = {}

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'warn')
    sinon.stub(SocketAuthority, 'libraryItemEmitter')
    sinon.stub(libraryFilters, 'getFilterData').resolves()
    sinon.stub(fs, 'pathExists').callsFake(async (path) => existingPaths.has(path))
    sinon.stub(fileUtils, 'getIno').resolves(null)

    libraryItemModel = {
      findOne: sinon.stub().resolves(null),
      // Only path lookups find an item, inode lookups never match (i.e. inodes did not follow the move)
      findOneExpanded: sinon.stub().callsFake(async (where) => (where.path || []).map((path) => libraryItemsByPath[path]).find((li) => li) || null)
    }
    sinon.stub(Database, 'libraryItemModel').get(() => libraryItemModel)

    sinon.stub(LibraryItemScanner, 'scanLibraryItem').callsFake(async (libraryItemId) => {
      calls.push(`rescan ${libraryItemId}`)
      return ScanResult.UPDATED
    })
    sinon.stub(LibraryItemScanner, 'scanPotentialNewLibraryItem').callsFake(async (path) => {
      calls.push(`new ${path}`)
      return { id: 'new-item' }
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  const addLibraryItem = (id, path) => {
    libraryItemsByPath[path] = {
      id,
      path,
      media: { title: id },
      save: sinon.stub().callsFake(async function () {
        calls.push(`save ${id} isMissing=${this.isMissing}`)
      })
    }
    return libraryItemsByPath[path]
  }

  it('sets a removed item as missing before scanning the new folder', async () => {
    addLibraryItem('old-item', '/lib/Old')
    existingPaths.add('/lib/New')

    const results = await LibraryScanner.scanFolderUpdates(library, folder, { New: ['01.mp3'], Old: ['01.mp3'] })

    expect(calls).to.deep.equal(['save old-item isMissing=true', 'new /lib/New'])
    expect(results).to.deep.equal({ Old: ScanResult.REMOVED, New: ScanResult.ADDED })
  })

  it('rescans an existing item that lost its files before scanning the new folder', async () => {
    addLibraryItem('old-item', '/lib/Old')
    existingPaths.add('/lib/Old')
    existingPaths.add('/lib/New')

    const results = await LibraryScanner.scanFolderUpdates(library, folder, { New: ['01.mp3'], Old: ['01.mp3'] })

    expect(calls).to.deep.equal(['rescan old-item', 'new /lib/New'])
    expect(results).to.deep.equal({ Old: ScanResult.UPDATED, New: ScanResult.ADDED })
  })

  it('checks paths that still exist before paths that were removed', async () => {
    addLibraryItem('item-a', '/lib/A')
    addLibraryItem('item-b', '/lib/B')
    existingPaths.add('/lib/B')

    await LibraryScanner.scanFolderUpdates(library, folder, { A: ['01.mp3'], B: ['01.mp3'] })

    expect(calls).to.deep.equal(['rescan item-b', 'save item-a isMissing=true'])
  })

  it('ignores a removed path that has no library item', async () => {
    existingPaths.add('/lib/New')

    const results = await LibraryScanner.scanFolderUpdates(library, folder, { Old: ['01.mp3'], New: ['01.mp3'] })

    expect(calls).to.deep.equal(['new /lib/New'])
    expect(results).to.deep.equal({ Old: ScanResult.NOTHING, New: ScanResult.ADDED })
  })
})
