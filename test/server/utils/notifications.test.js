const { expect } = require('chai')
const { version } = require('../../../package.json')
const notifications = require('../../../server/utils/notifications')

describe('notification event configuration', () => {
  it('preserves CommonJS exports, event order, and the current version', () => {
    expect(Object.keys(notifications)).to.deep.equal(['notificationData'])
    const { events } = notifications.notificationData
    expect(events.map((event) => event.name)).to.deep.equal([
      'onPodcastEpisodeDownloaded', 'onBackupCompleted', 'onBackupFailed', 'onRSSFeedFailed', 'onRSSFeedDisabled', 'onTest'
    ])
    expect(events.find((event) => event.name === 'onTest').testData.version).to.equal('v' + version)
  })

  it('keeps mixed test-data values and complete template variables', () => {
    const { events } = notifications.notificationData
    for (const event of events) {
      expect(Object.keys(event.testData).sort()).to.deep.equal([...event.variables].sort())
      expect(event.defaults.title).to.be.a('string')
      expect(event.defaults.body).to.be.a('string')
    }
    expect(events.find((event) => event.name === 'onRSSFeedFailed').testData.numFailed).to.equal(3)
    expect(events.find((event) => event.name === 'onBackupCompleted').testData.backupCount).to.equal('1')
    expect(events[0].libraryMediaType).to.equal('podcast')
    expect(events[1]).not.to.have.property('libraryMediaType')
  })
})
