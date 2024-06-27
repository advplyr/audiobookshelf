const SocketAuthority = require('../SocketAuthority')
const timespan = require('../libs/jsonwebtoken/lib/timespan')
const clientEmitter = require('../SocketAuthority')
class DLNASession {
  constructor(id, player, audiobook, start_time, serverAddress, token) {
    this.socket_id = id
    this.player = player
    this.tracks = audiobook
    this.serverAddress = serverAddress
    this.playtime = 0
    this.is_active = true
    this.token = token
    this.status = 'PAUSED'
    console.log(serverAddress)
    this.trackIndex = null
    this.player.pause()
    this.load(start_time)
    this.player.on('status', function (status) {
      console.log('Session: ', status)
    })
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
            var t = this.tracks[this.trackIndex]
            if (t.duration - this.playtime < 2) {
              if (this.trackIndex < this.tracks.length) {
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
              console.log('pos:', position) // Current position in seconds
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
        autoplay: false,
        contentType: track.mimeType,
        metadata: {
          type: 'audio' // can be 'video', 'audio' or 'image'
        }
      }
      var url = this.serverAddress + track.contentUrl + '?token=' + track.userToken
      console.log(this.tracks[this.trackIndex])
      console.log(url)
      this.player.load(
        url,
        options,
        function (err, result) {
          if (err) throw err
          console.log('playing ...', this.playtime - track.startOffset)
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
