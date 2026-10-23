const { expect } = require('chai')
const sinon = require('sinon')
const manager = require('../../../server/managers/NotificationManager')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')
const Settings = require('../../../server/objects/settings/NotificationSettings')
const Notification = require('../../../server/objects/Notification')
const axios = require('axios')

describe('NotificationManager compatibility', () => {
  let settings, sending, queue, clock
  beforeEach(() => {
    settings = Database.notificationSettings; sending = manager.sendingNotification; queue = manager.notificationQueue
    Database.notificationSettings = new Settings({ appriseApiUrl: 'unused', maxNotificationQueue: 1, maxFailedAttempts: 1 })
    manager.sendingNotification = false; manager.notificationQueue = []
    clock = sinon.useFakeTimers()
  })
  afterEach(() => { clock.restore(); sinon.restore(); Database.notificationSettings = settings; manager.sendingNotification = sending; manager.notificationQueue = queue })
  it('queues only up to limit and drains after configured delay', async () => {
    expect(manager.checkTriggerNotification('first', {})).to.equal(true)
    expect(manager.checkTriggerNotification('second', { value: 2 })).to.equal(false)
    expect(manager.checkTriggerNotification('dropped', {})).to.equal(false)
    const trigger = sinon.stub(manager, 'triggerNotification').resolves()
    manager.notificationFinished()
    expect(trigger.called).to.equal(false)
    await clock.tickAsync(Database.notificationSettings.notificationDelay)
    expect(trigger.calledOnceWithExactly('second', { value: 2 })).to.equal(true)
    expect(manager.sendingNotification).to.equal(false)
  })
  it('persists failure state, disables at threshold, then emits settings', async () => {
    const notification = new Notification({ id: 'id', eventName: 'onRSSFeedFailed', enabled: true })
    Database.notificationSettings.notifications = [notification]
    const update = sinon.stub(Database, 'updateSetting').resolves(), emit = sinon.stub(SocketAuthority, 'emitter')
    await manager.triggerNotification('onRSSFeedFailed', {}, true)
    expect(notification.enabled).to.equal(false)
    expect(notification.numConsecutiveFailedAttempts).to.equal(1)
    expect(update.calledOnce).to.equal(true)
    expect(emit.calledAfter(update)).to.equal(true)
    expect(emit.firstCall.args[0]).to.equal('notifications_updated')
  })
  it('does nothing with unusable settings and keeps unknown test event false', async () => {
    Database.notificationSettings.appriseApiUrl = null
    await manager.triggerNotification('event', {})
    expect(manager.sendingNotification).to.equal(false)
    expect(manager.sendTestNotification(new Notification({ eventName: 'missing' }))).to.equal(false)
  })
  it('converts HTTP failure to false and keeps timeout', async () => {
    const post = sinon.stub(axios, 'post').rejects(new Error('failed'))
    expect(await manager.sendNotification(new Notification(), {})).to.equal(false)
    expect(post.firstCall.args[2]).to.deep.equal({ timeout: 6000 })
  })
})
