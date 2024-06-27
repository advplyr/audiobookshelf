const MediaClient = require('upnp-mediarenderer-client')

class DLNADevice extends MediaClient {
  constructor(url) {
    console.log(url)
    super(url)
    this.name = ''
    this.udn = ''
    this.getDeviceDescription(this.update_Info.bind(this))
  }

  update_Info(err, desc) {
    if (err) throw err
    this.name = desc.friendlyName
    this.UDN = desc.UDN
  }
}

module.exports = DLNADevice
