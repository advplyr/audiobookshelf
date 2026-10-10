const { expect } = require('chai')
const DeviceInfo = require('../../../server/objects/DeviceInfo')

describe('DeviceInfo', () => {
  it('omits missing fields and sanitizes stored client strings', () => {
    expect(new DeviceInfo().toJSON()).to.deep.equal({})
    const device = new DeviceInfo({ id: 'id', clientName: '<b>App</b>', sdkVersion: 34, model: undefined, extra: 'ignored' })
    expect(device.toJSON()).to.deep.equal({ id: 'id', clientName: 'App', sdkVersion: '' })
    expect(device).not.to.have.property('extra')
  })

  it('normalizes Android SDK numbers and sanitizes client fields', () => {
    const device = new DeviceInfo()
    device.setData('127.0.0.1', null, { sdkVersion: 34, model: '<b>Pixel</b>', manufacturer: 'Google' }, '2.0', 'user')
    expect(device.toJSON()).to.include({ sdkVersion: '34', model: 'Pixel', clientName: 'Abs Android', deviceName: 'Google Pixel', clientVersion: '2.0' })
    expect(device.deviceDescription).to.equal('Pixel SDK 34 / v2.0')
    expect(device.deviceId).to.equal(device.id)
  })

  it('uses browser details and the server version for web clients', () => {
    const device = new DeviceInfo()
    device.setData(null, { browser: { name: 'Firefox' }, os: { name: 'Linux' }, device: {} }, null, '2.0', undefined)
    expect(device.toJSON()).to.include({ clientName: 'Abs Web', deviceName: 'Linux N/A Firefox', clientVersion: '2.0' })
    expect(device.toJSON()).not.to.have.property('userId')
  })

  it('preserves identity while clearing fields absent from updated data', () => {
    const device = new DeviceInfo({ id: 'old', deviceId: 'persistent', model: 'Phone', clientName: 'App' })
    const incoming = new DeviceInfo({ id: 'new', deviceId: 'other', clientName: 'App' })
    expect(device.update(incoming)).to.equal(true)
    expect(device.toJSON()).to.deep.equal({ id: 'old', deviceId: 'persistent', clientName: 'App' })
    expect(device.update(incoming.toJSON())).to.equal(false)
  })

  it('keeps temporary device IDs deterministic', () => {
    const first = new DeviceInfo({ userId: 'user', browserName: 'Firefox' })
    const second = new DeviceInfo({ userId: 'user', browserName: 'Firefox' })
    expect(first.getTempDeviceId()).to.equal(second.getTempDeviceId())
    expect(first.getTempDeviceId()).to.match(/^temp-/)
  })
})
