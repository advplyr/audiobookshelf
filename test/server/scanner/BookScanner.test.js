const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs/promises')
const os = require('os')
const Path = require('path')
const BookScanner = require('../../../server/scanner/BookScanner')
const AudioFileScanner = require('../../../server/scanner/AudioFileScanner')
const Library = require('../../../server/models/Library')
const Logger = require('../../../server/Logger')

describe('BookScanner chapters when audio files change', () => {
  let metadataPath
  let previousMetadataPath
  let previousServerSettings
  let audioFiles
  let libraryScan
  let librarySettings
  let libraryItemData
  let libraryItem
  let media

  beforeEach(async () => {
    previousMetadataPath = global.MetadataPath
    previousServerSettings = global.ServerSettings
    metadataPath = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-chapter-test-'))
    global.MetadataPath = metadataPath
    global.ServerSettings = { storeMetadataWithItem: false, metadataFileFormat: 'json' }
    sinon.stub(Logger, 'debug')
    libraryScan = { addLog: sinon.spy(), seriesRemovedFromBooks: [], authorsRemovedFromBooks: [] }
    librarySettings = { metadataPrecedence: Library.defaultMetadataPrecedence }
    audioFiles = Array.from({ length: 5 }, (_, index) => ({
      ino: `audio-${index}`,
      index: index + 1,
      trackNumFromMeta: index + 1,
      duration: 100,
      metadata: { filename: `part-${index + 1}.m4b`, path: `/synthetic/part-${index + 1}.m4b`, ext: '.m4b' },
      metaTags: {},
      chapters: [
        { id: 0, start: 0, end: 40, title: `Part ${index + 1} opening` },
        { id: 1, start: 40, end: 100, title: `Part ${index + 1} ending` }
      ]
    }))
    libraryItemData = {
      mediaMetadata: { title: 'Synthetic Book' },
      setBookMetadataFromFilenames: () => {},
      hasAudioFileChanges: true,
      audioLibraryFiles: audioFiles,
      audioLibraryFilesAdded: [audioFiles[4]],
      audioLibraryFilesModified: [],
      checkAudioFileRemoved: () => false,
      imageLibraryFiles: [],
      imageLibraryFilesRemoved: [],
      imageLibraryFilesModified: [],
      ebookLibraryFiles: []
    }
    media = {
      title: 'Synthetic Book',
      audioFiles: structuredClone(audioFiles.slice(0, 4)),
      chapters: AudioFileScanner.getBookChaptersFromAudioFiles('Synthetic Book', audioFiles.slice(0, 4), libraryScan),
      authors: [],
      series: [],
      coverPath: '/synthetic/cover.png',
      changed: sinon.spy(),
      save: sinon.stub().resolves()
    }
    libraryItem = {
      id: 'synthetic-item',
      mediaType: 'book',
      relPath: 'Synthetic Book',
      libraryFiles: audioFiles,
      media,
      getMedia: sinon.stub().resolves(media)
    }
    sinon.stub(AudioFileScanner, 'executeMediaFileScans').callsFake(async (_type, _data, files) => structuredClone(files))
    await BookScanner.saveMetadataFile(libraryItem, libraryScan)
  })

  afterEach(async () => {
    sinon.restore()
    global.MetadataPath = previousMetadataPath
    global.ServerSettings = previousServerSettings
    await fs.rm(metadataPath, { recursive: true, force: true })
  })

  async function rescan() {
    await BookScanner.rescanExistingBookLibraryItem(libraryItem, libraryItemData, librarySettings, libraryScan)
  }

  async function readSavedMetadata() {
    return JSON.parse(await fs.readFile(Path.join(metadataPath, 'items', libraryItem.id, 'metadata.json'), 'utf8'))
  }

  it('generates all chapters when all five files are present on the first scan', async () => {
    const metadata = await BookScanner.getBookMetadataFromScanData(audioFiles, null, libraryItemData, libraryScan, librarySettings)
    expect(metadata.chapters).to.have.length(10)
    expect(metadata.chapters[9].end).to.equal(500)
  })

  it('refreshes unchanged generated chapters when another file arrives after metadata was saved', async () => {
    const initialChapters = structuredClone(media.chapters)
    expect((await readSavedMetadata()).chapters).to.have.length(8)

    await rescan()

    expect(media.audioFiles).to.have.length(5)
    expect(media.chapters).to.have.length(10)
    expect(media.chapters.slice(0, 8)).to.deep.equal(initialChapters)
    expect(media.chapters[8]).to.deep.equal({ id: 8, start: 400, end: 440, title: 'Part 5 opening' })
    expect(media.chapters[9].end).to.equal(media.duration)
    expect((await readSavedMetadata()).chapters).to.deep.equal(media.chapters)

    libraryItemData.hasAudioFileChanges = false
    libraryItemData.audioLibraryFilesAdded = []
    await rescan()
    expect(media.chapters).to.have.length(10)
  })

  it('refreshes generated chapters when a missing audio file is discovered by the safety check', async () => {
    libraryItemData.hasAudioFileChanges = false
    libraryItemData.audioLibraryFilesAdded = []

    await rescan()

    expect(media.audioFiles).to.have.length(5)
    expect(media.chapters).to.have.length(10)
  })

  it('refreshes generated chapters when an audio file is removed', async () => {
    libraryItemData.audioLibraryFiles = audioFiles.slice(0, 3)
    libraryItemData.audioLibraryFilesAdded = []
    libraryItemData.checkAudioFileRemoved = (file) => file.ino === audioFiles[3].ino

    await rescan()

    expect(media.audioFiles).to.have.length(3)
    expect(media.chapters).to.have.length(6)
    expect(media.chapters[5].end).to.equal(media.duration)
  })

  for (const [name, edit] of [
    ['titles', (chapters) => { chapters[0].title = 'Custom opening' }],
    ['timings', (chapters) => { chapters[0].end = 35; chapters[1].start = 35 }],
    ['chapter count', (chapters) => { chapters.pop() }]
  ]) {
    it(`preserves custom ${name} in saved metadata`, async () => {
      edit(media.chapters)
      const customChapters = structuredClone(media.chapters)
      await BookScanner.saveMetadataFile(libraryItem, libraryScan)

      await rescan()

      expect(media.audioFiles).to.have.length(5)
      expect(media.chapters).to.deep.equal(customChapters)
    })
  }

  it('preserves metadata chapters edited independently of the database', async () => {
    const saved = await readSavedMetadata()
    saved.chapters[0].title = 'Custom metadata title'
    await fs.writeFile(Path.join(metadataPath, 'items', libraryItem.id, 'metadata.json'), JSON.stringify(saved))

    await rescan()

    expect(media.chapters).to.deep.equal(saved.chapters)
  })

  it('preserves an explicit sidecar even when its chapters match the previous generated list', async () => {
    const saved = await readSavedMetadata()
    const sidecarPath = Path.join(metadataPath, 'sidecar.json')
    await fs.writeFile(sidecarPath, JSON.stringify(saved))
    libraryItemData.metadataJsonLibraryFile = { metadata: { path: sidecarPath } }

    await rescan()

    expect(media.chapters).to.deep.equal(saved.chapters)
  })

  it('keeps metadata precedence for fields other than generated chapters', async () => {
    const saved = await readSavedMetadata()
    saved.title = 'Metadata title'
    await fs.writeFile(Path.join(metadataPath, 'items', libraryItem.id, 'metadata.json'), JSON.stringify(saved))

    await rescan()

    expect(media.title).to.equal('Metadata title')
    expect(media.chapters).to.have.length(10)
  })

  it('keeps saved chapters when audio metadata is not an enabled source', async () => {
    librarySettings.metadataPrecedence = ['absMetadata']
    const originalChapters = structuredClone(media.chapters)

    await rescan()

    expect(media.chapters).to.deep.equal(originalChapters)
  })

  it('still honors audio metadata when explicitly given precedence over custom metadata', async () => {
    librarySettings.metadataPrecedence = ['absMetadata', 'audioMetatags']
    media.chapters[0].title = 'Custom opening'
    await BookScanner.saveMetadataFile(libraryItem, libraryScan)

    await rescan()

    expect(media.chapters).to.have.length(10)
    expect(media.chapters[0].title).to.equal('Part 1 opening')
  })

  it('does not guess how to repair an already incomplete chapter list', async () => {
    media.audioFiles = structuredClone(audioFiles)
    libraryItemData.hasAudioFileChanges = false
    libraryItemData.audioLibraryFilesAdded = []
    const originalChapters = structuredClone(media.chapters)

    await rescan()

    expect(media.chapters).to.deep.equal(originalChapters)
  })
})
