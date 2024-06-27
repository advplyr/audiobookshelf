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
}
module.exports = new DLNAController()
