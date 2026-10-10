const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const fs = require('node:fs')
const Path = require('node:path')
const os = require('node:os')
const Setting = require('../../../server/models/Setting')
const EmailSettings = require('../../../server/objects/settings/EmailSettings')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const NotificationSettings = require('../../../server/objects/settings/NotificationSettings')

describe('Setting', () => {
  let sequelize
  let directory
  let previousMetadataPath

  beforeEach(async () => {
    previousMetadataPath = global.MetadataPath
    directory = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-setting-model-'))
    global.MetadataPath = directory
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Setting.init(sequelize)
    await sequelize.sync()
  })

  afterEach(async () => {
    await sequelize.close()
    global.MetadataPath = previousMetadataPath
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('constructs default settings when no rows exist', async () => {
    const loaded = await Setting.getOldSettings()
    expect(loaded.settings).to.deep.equal([])
    expect(loaded.emailSettings).to.be.instanceOf(EmailSettings)
    expect(loaded.serverSettings).to.be.instanceOf(ServerSettings)
    expect(loaded.notificationSettings).to.be.instanceOf(NotificationSettings)
  })

  it('upserts by legacy ID and restores settings classes from JSON', async () => {
    await Setting.updateSettingObj({ id: 'email-settings', host: 'smtp.example.com', port: 587 })
    await Setting.updateSettingObj({ id: 'notification-settings', appriseApiUrl: 'https://example.com', notifications: [{ id: 'notification', eventName: 'onTest', enabled: true }] })
    await Setting.updateSettingObj({ id: 'server-settings', language: 'zh-cn', metadataFileFormat: 'json' })
    await Setting.updateSettingObj({ id: 'email-settings', host: 'updated.example.com', port: 465 })
    expect(await Setting.count()).to.equal(3)
    const loaded = await Setting.getOldSettings()
    expect(loaded.emailSettings.host).to.equal('updated.example.com')
    expect(loaded.emailSettings.rejectUnauthorized).to.equal(true)
    expect(loaded.serverSettings.language).to.equal('zh-cn')
    expect(loaded.notificationSettings.getHasActiveNotificationsForEvent('onTest')).to.equal(true)
    expect(loaded.settings).to.have.length(3)
    expect((await Setting.findByPk('email-settings')).createdAt).to.be.instanceOf(Date)
  })

  it('preserves optional fields when settings objects are serialized and saved', async () => {
    const settings = new EmailSettings({ host: 'smtp.example.com' })
    await Setting.updateSettingObj(settings.toJSON())
    const row = await Setting.findByPk(settings.id)
    expect(row.value).not.to.have.property('port')
    expect(row.value).to.include({ secure: false, rejectUnauthorized: true })
    expect((await Setting.getOldSettings()).emailSettings.port).to.equal(undefined)
  })
})
