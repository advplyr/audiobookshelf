class DLNAManager {
  constructor() {
    console.log('It worked')
    this.Client = require('dlnacasts')()
    this.Client.on('update', function (player) {
      console.log('all players: ', this.players)
    })
  }

  start_playback(id, data) {
    console.log(id, data)
  }
}

module.exports = DLNAManager
