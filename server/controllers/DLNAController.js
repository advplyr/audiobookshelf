class DLNAController {
  constructor() {}
  async get_Devices(req, res) {
    var count = 0
    const players = await this.DLNAManager.devices
    return res.status(200).send(players)
  }
  middleware(req, res, next) {
    next()
  }
  async get_file(req, res) {
    console.log('id', req.params.id)
    const session = await this.DLNAManager.playback_sessions.find((item) => item.socket_id == req.params.session)
    if (!session) {
      res.status(400).send('Session not found')
      return
    }
    const track = session.tracks[req.params.id]
    if (!track) {
      res.status(400).send('Track not found')
      return
    }
    return res.status(200).sendFile(track.metadata.path)
  }
}
module.exports = new DLNAController()
