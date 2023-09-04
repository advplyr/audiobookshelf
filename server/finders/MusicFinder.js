const MusicBrainz = require('../providers/MusicBrainz')

class MusicFinder {
  constructor() {
    this.musicBrainz = new MusicBrainz()
  }

  searchTrack(options) {
    return this.musicBrainz.searchTrack(options)
  }
}
module.exports = new MusicFinder()