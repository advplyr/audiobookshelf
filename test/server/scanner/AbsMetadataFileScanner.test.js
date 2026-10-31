const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const Path = require('path')
const sinon = require('sinon')
const { LogLevel } = require('../../../server/utils/constants')
const AbsMetadataFileScanner = require('../../../server/scanner/AbsMetadataFileScanner')

describe('AbsMetadataFileScanner', () => {
  let dir
  let originalMetadataPath
  let libraryScan

  beforeEach(() => {
    dir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-meta-'))
    originalMetadataPath = global.MetadataPath
    global.MetadataPath = Path.join(dir, 'metadata')
    libraryScan = { addLog: sinon.spy() }
  })

  afterEach(() => {
    global.MetadataPath = originalMetadataPath
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function libraryItemDataWith(json) {
    if (json === undefined) return { metadataJsonLibraryFile: null }
    const path = Path.join(dir, 'metadata.json')
    fs.writeFileSync(path, JSON.stringify(json))
    return { metadataJsonLibraryFile: { metadata: { path } }, path }
  }

  describe('scanBookMetadataFile', () => {
    it('sets book metadata from the metadata.json next to the item and logs it', async () => {
      const data = libraryItemDataWith({ title: 'ABS Title', authors: ['Author One'], genres: [], tags: [], explicit: true, language: null })
      const bookMetadata = { title: 'Old', tags: ['keep'], genres: ['keep'], language: 'en' }
      await AbsMetadataFileScanner.scanBookMetadataFile(libraryScan, data, bookMetadata)
      expect(bookMetadata).to.deep.equal({ title: 'ABS Title', authors: ['Author One'], tags: ['keep'], genres: ['keep'], explicit: true, language: 'en' })
      expect(libraryScan.addLog.calledOnceWithExactly(LogLevel.INFO, `Found metadata file "${data.path}"`)).to.equal(true)
    })

    it('falls back to the metadata items folder of an existing library item', async () => {
      const itemDir = Path.join(global.MetadataPath, 'items', 'li-1')
      fs.mkdirSync(itemDir, { recursive: true })
      fs.writeFileSync(Path.join(itemDir, 'metadata.json'), JSON.stringify({ title: 'From Cache' }))
      const bookMetadata = {}
      await AbsMetadataFileScanner.scanBookMetadataFile(libraryScan, libraryItemDataWith(undefined), bookMetadata, 'li-1')
      expect(bookMetadata).to.deep.equal({ title: 'From Cache' })
      expect(libraryScan.addLog.firstCall.args[1]).to.equal(`Found metadata file "${Path.join(itemDir, 'metadata.json')}"`)
    })

    it('does nothing when there is no metadata file', async () => {
      const bookMetadata = { title: 'Same' }
      await AbsMetadataFileScanner.scanBookMetadataFile(libraryScan, libraryItemDataWith(undefined), bookMetadata, 'missing-item')
      await AbsMetadataFileScanner.scanBookMetadataFile(libraryScan, libraryItemDataWith(undefined), bookMetadata)
      expect(bookMetadata).to.deep.equal({ title: 'Same' })
      expect(libraryScan.addLog.called).to.equal(false)
    })
  })

  describe('scanPodcastMetadataFile', () => {
    it('sets podcast metadata and skips null values and empty tags', async () => {
      const data = libraryItemDataWith({ title: 'Podcast', author: 'Host', tags: [], feedURL: null, explicit: false })
      const podcastMetadata = { tags: ['keep'], feedURL: 'https://old' }
      await AbsMetadataFileScanner.scanPodcastMetadataFile(libraryScan, data, podcastMetadata)
      expect(podcastMetadata).to.deep.equal({ title: 'Podcast', author: 'Host', tags: ['keep'], feedURL: 'https://old', explicit: false })
      expect(libraryScan.addLog.calledOnceWithExactly(LogLevel.INFO, `Found metadata file "${data.path}"`)).to.equal(true)
    })

    it('falls back to the metadata items folder and does nothing when nothing is found', async () => {
      const itemDir = Path.join(global.MetadataPath, 'items', 'li-2')
      fs.mkdirSync(itemDir, { recursive: true })
      fs.writeFileSync(Path.join(itemDir, 'metadata.json'), JSON.stringify({ title: 'Cached Podcast' }))
      const podcastMetadata = {}
      await AbsMetadataFileScanner.scanPodcastMetadataFile(libraryScan, libraryItemDataWith(undefined), podcastMetadata, 'li-2')
      expect(podcastMetadata).to.deep.equal({ title: 'Cached Podcast' })

      const untouched = { title: 'Same' }
      await AbsMetadataFileScanner.scanPodcastMetadataFile(libraryScan, libraryItemDataWith(undefined), untouched, 'nope')
      expect(untouched).to.deep.equal({ title: 'Same' })
    })
  })
})
