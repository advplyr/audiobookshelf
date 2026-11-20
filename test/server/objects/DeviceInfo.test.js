const chai = require('chai')
const DeviceInfo = require('../../../server/objects/DeviceInfo')

const expect = chai.expect

describe('DeviceInfo', () => {
  const ua = { browser: {}, os: { name: 'iOS' }, device: {} }

  function setData(ip, clientDeviceInfo, userId) {
    const deviceInfo = new DeviceInfo()
    deviceInfo.setData(ip, ua, clientDeviceInfo, '2.0.0', userId)
    return deviceInfo
  }

  describe('setData', () => {
    it('should give the same deviceId to requests without a deviceId from the same user and client', () => {
      const first = setData('10.0.0.1', { clientName: 'Test Client', clientVersion: '1.0.0' }, 'user-1')
      const second = setData('10.0.0.2', { clientName: 'Test Client', clientVersion: '1.0.0' }, 'user-1')

      expect(first.deviceId).to.be.a('string').that.is.not.empty
      expect(second.deviceId).to.equal(first.deviceId)
      expect(second.id).to.not.equal(first.id)
    })

    it('should give different deviceIds to different users on the same client', () => {
      const user1First = setData('10.0.0.1', { clientName: 'Test Client', clientVersion: '1.0.0' }, 'user-1')
      const user1Second = setData('10.0.0.1', { clientName: 'Test Client', clientVersion: '1.0.0' }, 'user-1')
      const user2First = setData('10.0.0.1', { clientName: 'Test Client', clientVersion: '1.0.0' }, 'user-2')
      const user2Second = setData('10.0.0.1', { clientName: 'Test Client', clientVersion: '1.0.0' }, 'user-2')

      expect(user1Second.deviceId).to.equal(user1First.deviceId)
      expect(user2Second.deviceId).to.equal(user2First.deviceId)
      expect(user2First.deviceId).to.not.equal(user1First.deviceId)
    })

    it('should give different deviceIds to different clients of the same user', () => {
      const clientA = setData('10.0.0.1', { clientName: 'Client A', clientVersion: '1.0.0' }, 'user-1')
      const clientAAgain = setData('10.0.0.1', { clientName: 'Client A', clientVersion: '1.0.0' }, 'user-1')
      const clientB = setData('10.0.0.1', { clientName: 'Client B', clientVersion: '1.0.0' }, 'user-1')

      expect(clientAAgain.deviceId).to.equal(clientA.deviceId)
      expect(clientB.deviceId).to.not.equal(clientA.deviceId)
    })
  })
})
