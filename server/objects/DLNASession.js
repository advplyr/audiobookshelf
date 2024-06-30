const SocketAuthority = require('../SocketAuthority')
const timespan = require('../libs/jsonwebtoken/lib/timespan')
const clientEmitter = require('../SocketAuthority')
const Logger = require('../Logger')
class DLNASession {
  constructor(id, player, audiobook, start_time, serverAddress) {
    this.socket_id = id
    this.player = player
    this.tracks = audiobook
    this.serverAddress = serverAddress
    this.playtime = 0
    this.is_active = true
    this.status = 'PAUSED'
    this.trackIndex = null
    this.player.pause()
    this.load(start_time)
    this.socket = SocketAuthority.clients[this.socket_id].socket
  }
  update() {
    if (this.is_active) {
      this.player.getTransportInfo(
        function (err, info) {
          var status = ''
          if (info.CurrentTransportState == 'PLAYING') {
            status = 'PLAYING'
          } else if (info.CurrentTransportState == 'PAUSED_PLAYBACK') {
            status = 'PAUSED'
          } else if (info.CurrentTransportState == 'STOPPED') {
            //If playback is stopped check if playback of track ended and Load new track
            var t = this.tracks[this.trackIndex]
            if (t.duration - this.playtime < 2) {
              if (this.trackIndex < this.tracks.length - 1) {
                this.load(this.tracks[this.trackIndex + 1].startOffset)
                this.playtime = 0
                return
              } else {
                this.socket.emit('dlna_finished')
              }
            }
          }
          this.player.getPosition(
            function (err, position) {
              this.set_status(status, this.trackIndex, position)
            }.bind(this)
          )
        }.bind(this)
      )
    }
  }
  load(time) {
    var idx = this.tracks.findIndex((t) => time >= t.startOffset && time < t.startOffset + t.duration)
    var track = this.tracks[idx]
    if (this.trackIndex != idx) {
      this.trackIndex = idx
      var options = {
        autoplay: true,
        contentType: track.mimeType,
        metadata: {
          title: 'Test',
          type: 'audio', // can be 'video', 'audio' or 'image'
          subtitlesUrl: null
        }
      }
      var url = `${this.serverAddress}/public/dlna/${this.socket_id}/${this.trackIndex}/track${track.metadata.ext}`
      console.log(url)
      this.player.load(
        url,
        options,
        function (err, result) {
          if (err) Logger.error(err)
          this.player.play()
          this.player.seek(time - track.startOffset)
        }.bind(this)
      )
    } else {
      this.player.seek(time - track.startOffset)
    }
  }
  set_status(val, track, position) {
    this.playtime = position
    this.status = val
    this.socket.emit('dlna_status', { status: val, track_idx: track, pos: position })
  }
}

module.exports = DLNASession
