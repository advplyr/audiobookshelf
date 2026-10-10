const { expect } = require('chai')
const Notification = require('../../../server/objects/Notification')

describe('Notification', () => {
  it('keeps missing stored fields and their existing defaults', () => {
    const notification = new Notification({ enabled: 1, lastFiredAt: 0 })
    expect(notification.toJSON()).to.include({ id: undefined, eventName: undefined, createdAt: undefined, libraryId: null, enabled: true, lastFiredAt: null, type: 'info' })
    expect(notification.urls).to.deep.equal([])
    expect(notification.titleTemplate).to.equal('')
  })

  it('preserves the different type defaults for new and stored notifications', () => {
    const notification = new Notification()
    expect(notification.type).to.equal('info')
    notification.setData({ eventName: 'onTest', urls: ['json://example'], titleTemplate: 'Title', bodyTemplate: 'Body' })
    expect(notification.type).to.equal(null)
    expect(notification.id).to.be.a('string')
    expect(notification.createdAt).to.be.a('number')
    expect(new Notification(notification.toJSON()).type).to.equal('info')
  })

  it('resets failure state when re-enabled without resetting the total fired count', () => {
    const notification = new Notification()
    notification.updateNotificationFired(false)
    notification.updateNotificationFired(false)
    expect(notification.numConsecutiveFailedAttempts).to.equal(2)
    expect(notification.update({ enabled: true })).to.equal(true)
    expect(notification.toJSON()).to.include({ lastFiredAt: null, lastAttemptFailed: false, numConsecutiveFailedAttempts: 0, numTimesFired: 2 })
    notification.updateNotificationFired(true)
    expect(notification.numTimesFired).to.equal(3)
    expect(notification.lastAttemptFailed).to.equal(false)
  })

  it('copies changed URLs and leaves omitted fields unchanged', () => {
    const notification = new Notification({ eventName: 'onTest', urls: ['one'] })
    expect(notification.update({ urls: ['one'] })).to.equal(false)
    const urls = ['two']
    expect(notification.update({ urls, libraryId: 'library', type: 'warning', titleTemplate: 'Updated' })).to.equal(true)
    urls.push('three')
    expect(notification.urls).to.deep.equal(['two'])
    expect(notification.eventName).to.equal('onTest')
    expect(notification.update({ libraryId: null, type: null })).to.equal(true)
    expect(notification.libraryId).to.equal(null)
    expect(notification.type).to.equal(null)
  })

  it('replaces repeated variables and numbers while leaving falsy and missing values intact', () => {
    const notification = new Notification({
      urls: ['json://example'],
      titleTemplate: '{{ name }} {{name}} {{count}}',
      bodyTemplate: '{{zero}} {{flag}} {{missing}} {{value}}'
    })
    expect(notification.getApprisePayload({ name: 'Book', count: 2, zero: 0, flag: false, value: '$&' })).to.deep.equal({
      urls: ['json://example'],
      title: 'Book Book 2',
      body: '{{zero}} {{flag}} {{missing}} {{value}}'
    })
  })
})
