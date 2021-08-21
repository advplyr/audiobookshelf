const Logger = require('./Logger')
const BookFinder = require('./BookFinder')
const Audiobook = require('./Audiobook')
const audioFileScanner = require('./utils/audioFileScanner')
const { getAllAudiobookFiles } = require('./utils/scandir')
const { secondsToTimestamp } = require('./utils/fileUtils')

class Scanner {
  constructor(AUDIOBOOK_PATH, METADATA_PATH, db, emitter) {
    this.AudiobookPath = AUDIOBOOK_PATH
    this.MetadataPath = METADATA_PATH
    this.db = db
    this.emitter = emitter

    this.bookFinder = new BookFinder()
  }

  get audiobooks() {
    return this.db.audiobooks
  }

  async scan() {
    // console.log('Start scan audiobooks', this.audiobooks.map(a => a.fullPath).join(', '))
    const scanStart = Date.now()
    var audiobookDataFound = await getAllAudiobookFiles(this.AudiobookPath)
    for (let i = 0; i < audiobookDataFound.length; i++) {
      var audiobookData = audiobookDataFound[i]
      if (!audiobookData.parts.length) {
        Logger.error('No Valid Parts for Audiobook', audiobookData)
      } else {
        var existingAudiobook = this.audiobooks.find(a => a.fullPath === audiobookData.fullPath)
        if (existingAudiobook) {
          Logger.info('Audiobook already added', audiobookData.title)
          // Todo: Update Audiobook here
        } else {
          // console.log('Audiobook not already there... add new audiobook', audiobookData.fullPath)
          var audiobook = new Audiobook()
          audiobook.setData(audiobookData)
          await audioFileScanner.scanParts(audiobook, audiobookData.parts)
          if (!audiobook.tracks.length) {
            Logger.warn('Invalid audiobook, no valid tracks', audiobook.title)
          } else {
            Logger.info('Audiobook Scanned', audiobook.title, `(${audiobook.sizePretty}) [${audiobook.durationPretty}]`)
            await this.db.insertAudiobook(audiobook)
            this.emitter('audiobook_added', audiobook.toJSONMinified())
          }
        }
        var progress = Math.round(100 * (i + 1) / audiobookDataFound.length)
        this.emitter('scan_progress', {
          total: audiobookDataFound.length,
          done: i + 1,
          progress
        })
      }
    }
    const scanElapsed = Math.floor((Date.now() - scanStart) / 1000)
    Logger.info(`[SCANNER] Finished ${secondsToTimestamp(scanElapsed)}`)
  }

  async fetchMetadata(id, trackIndex = 0) {
    var audiobook = this.audiobooks.find(a => a.id === id)
    if (!audiobook) {
      return false
    }
    var tracks = audiobook.tracks
    var index = isNaN(trackIndex) ? 0 : Number(trackIndex)
    var firstTrack = tracks[index]
    var firstTrackFullPath = firstTrack.fullPath
    var scanResult = await audioFileScanner.scan(firstTrackFullPath)
    return scanResult
  }

  async find(req, res) {
    var method = req.params.method
    var query = req.query

    var result = null

    if (method === 'isbn') {
      result = await this.bookFinder.findByISBN(query)
    } else if (method === 'search') {
      result = await this.bookFinder.search(query.provider, query.title, query.author || null)
    }

    res.json(result)
  }

  async findCovers(req, res) {
    var query = req.query
    var result = await this.bookFinder.findCovers(query.provider, query.title, query.author || null)
    res.json(result)
  }
}
module.exports = Scanner