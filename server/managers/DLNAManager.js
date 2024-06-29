const { clientEmitter } = require('../SocketAuthority')
const DLNADevice = require('../objects/DLNADevice')
const DLNASession = require('../objects/DLNASession')
const SSDPclient = require('node-ssdp').Client
const Auth = require('../Auth')
class DLNAManager {
  constructor(auth) {
    this.playback_sessions = []
    this.devices = []
    this.ssdpclient = new SSDPclient()
    this.ssdpclient.on('response', this.add_device.bind(this))
    setInterval(this.update_sessions.bind(this), 500)
    this.ssdpclient.search('urn:schemas-upnp-org:service:AVTransport:1')
    this.auth = auth
  }
  add_device(header) {
    if (
      !this.devices ||
      !this.devices.find((dev) => {
        return dev.url == header.LOCATION
      })
    ) {
      this.devices.push(new DLNADevice(header.LOCATION))
    }
  }
  start_playback(id, player, audiobook, start_time, serverAddress) {
    this.playback_sessions = this.playback_sessions.filter((item) => !(item.socket_id == id))
    this.playback_sessions.push(
      new DLNASession(
        id,
        this.devices.find((pl) => {
          return pl.UDN == player
        }),
        audiobook,
        start_time,
        serverAddress
      )
    )
  }
  exit_session(id) {
    //Stop playback when player is closed
    for (let item of this.playback_sessions) {
      if (item.socket_id == id) {
        item.player.pause()
      }
    }
    this.playback_sessions = this.playback_sessions.filter((item) => !(item.socket_id == id))
    console.log('sessions:', this.playback_sessions)
  }
  update_sessions() {
    for (let pb_session of this.playback_sessions) {
      pb_session.update()
    }
  }
  pause_session(id) {
    var session = this.playback_sessions.find((item) => item.socket_id == id)
    if (session) {
      session.player.pause()
    }
  }
  continue_session(id) {
    var session = this.playback_sessions.find((item) => item.socket_id == id)
    if (session) {
      session.player.play()
    }
  }
  seek(id, time) {
    var session = this.playback_sessions.find((item) => item.socket_id == id)
    if (session) {
      session.load(time)
    }
  }
  setVolume(id, volume) {
    console.log('SetVolume', volume)
    var session = this.playback_sessions.find((item) => item.socket_id == id)
    if (!session) {
      return
    }
    session.player.setVolume(volume * 100)
  }
}

module.exports = DLNAManager
