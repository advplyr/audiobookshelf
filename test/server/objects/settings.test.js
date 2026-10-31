const { expect } = require('chai')
const sinon = require('sinon')
const EmailSettings = require('../../../server/objects/settings/EmailSettings')
const NotificationSettings = require('../../../server/objects/settings/NotificationSettings')

describe('EmailSettings', () => {
  afterEach(() => sinon.restore())

  it('preserves missing stored fields and the legacy TLS verification default', () => {
    const settings = new EmailSettings({ host: 'smtp.example.com' })
    expect(settings.toJSON()).to.include({ host: 'smtp.example.com', port: undefined, secure: false, rejectUnauthorized: true })
    expect(settings.ereaderDevices).to.deep.equal([])
  })

  it('normalizes update values and converts empty strings to null', () => {
    const settings = new EmailSettings()
    const payload = { port: '587', secure: 0, rejectUnauthorized: 1, host: '' }
    expect(settings.update(payload)).to.equal(true)
    expect(payload).to.deep.equal({ port: 587, secure: false, rejectUnauthorized: true, host: '' })
    expect(settings.toJSON()).to.include({ port: 587, secure: false, rejectUnauthorized: true, host: null })
    expect(settings.update({ port: 'invalid' })).to.equal(true)
    expect(settings.port).to.equal(465)
    expect(settings.update(null)).to.equal(false)
  })

  it('validates device availability and copies accepted devices', () => {
    sinon.stub(console, 'error')
    const settings = new EmailSettings()
    const devices = [
      { name: 'Kindle', email: 'kindle@example.com', availabilityOption: 'specificUsers', users: ['user'] },
      { name: 'Default', email: 'default@example.com', availabilityOption: 'invalid', users: ['user'] },
      { name: 'Missing email' }
    ]
    expect(settings.update({ ereaderDevices: devices })).to.equal(true)
    expect(settings.ereaderDevices).to.have.length(2)
    expect(settings.ereaderDevices[1]).to.include({ availabilityOption: 'adminOrUp' })
    expect(settings.ereaderDevices[1].users).to.deep.equal([])
    devices[0].users.push('other')
    expect(settings.ereaderDevices[0].users).to.deep.equal(['user'])
    expect(settings.getEReaderDevices({ id: 'user', isAdminOrUp: false, isUser: true }).map((d) => d.name)).to.deep.equal(['Kindle'])
    expect(settings.getEReaderDevice('missing')).to.equal(undefined)
    expect(settings.update({ ereaderDevices: 'invalid' })).to.equal(false)
  })

  it('preserves SMTP port, authentication and self-signed certificate behavior', () => {
    const settings = new EmailSettings()
    settings.update({ host: 'smtp.example.com', user: 'user', pass: null, port: 587, secure: true, rejectUnauthorized: false })
    expect(settings.getTransportObject()).to.deep.equal({ host: 'smtp.example.com', port: 587, secure: false, auth: { user: 'user', pass: null }, tls: { rejectUnauthorized: false } })
    settings.update({ port: 465 })
    expect(settings.getTransportObject().secure).to.equal(true)
  })
})

describe('NotificationSettings', () => {
  afterEach(() => sinon.restore())

  it('loads legacy defaults including zero values', () => {
    const settings = new NotificationSettings({ maxFailedAttempts: 0, maxNotificationQueue: 0, notificationDelay: 0 })
    expect(settings.toJSON()).to.include({ appriseType: undefined, appriseApiUrl: null, maxFailedAttempts: 5, maxNotificationQueue: 20, notificationDelay: 1000 })
    expect(settings.isUseable).to.equal(false)
  })

  it('preserves reset-on-missing settings update behavior', () => {
    const settings = new NotificationSettings({ appriseApiUrl: 'https://example.com', maxFailedAttempts: 9, maxNotificationQueue: 30 })
    expect(settings.update({})).to.equal(true)
    expect(settings.toJSON()).to.include({ appriseApiUrl: null, maxFailedAttempts: 5, maxNotificationQueue: 20 })
    expect(settings.update({ maxFailedAttempts: '3', maxNotificationQueue: '4' })).to.equal(true)
    expect(settings.maxFailedAttempts).to.equal(3)
    expect(settings.maxNotificationQueue).to.equal(4)
  })

  it('creates, filters, updates and removes notification objects', () => {
    const settings = new NotificationSettings()
    expect(settings.createNotification(null)).to.equal(false)
    expect(settings.createNotification({ eventName: 'onTest', urls: [], titleTemplate: '', bodyTemplate: '' })).to.equal(false)
    expect(settings.createNotification({ eventName: 'onTest', urls: ['test'], titleTemplate: 'Title', bodyTemplate: 'Body', enabled: true })).to.equal(true)
    const notification = settings.getActiveNotificationsForEvent('onTest')[0]
    expect(settings.getHasActiveNotificationsForEvent('onTest')).to.equal(true)
    expect(settings.updateNotification({ id: notification.id, enabled: false })).to.equal(true)
    expect(settings.getHasActiveNotificationsForEvent('onTest')).to.equal(false)
    expect(settings.removeNotification(notification.id)).to.equal(true)
    expect(settings.removeNotification(notification.id)).to.equal(false)
    expect(settings.getNotification(notification.id)).to.equal(undefined)
  })
})
