const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('node:fs')
const Path = require('node:path')
const os = require('node:os')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const Logger = require('../../../server/Logger')

describe('ServerSettings', () => {
  let previousMetadataPath
  let previousBackupPath
  let previousAllowIframe
  let directory

  beforeEach(() => {
    previousMetadataPath = global.MetadataPath
    previousBackupPath = process.env.BACKUP_PATH
    previousAllowIframe = process.env.ALLOW_IFRAME
    directory = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-server-settings-'))
    global.MetadataPath = directory
    delete process.env.BACKUP_PATH
    delete process.env.ALLOW_IFRAME
    sinon.stub(Logger, 'setLogLevel')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    sinon.restore()
    global.MetadataPath = previousMetadataPath
    if (previousBackupPath === undefined) delete process.env.BACKUP_PATH
    else process.env.BACKUP_PATH = previousBackupPath
    if (previousAllowIframe === undefined) delete process.env.ALLOW_IFRAME
    else process.env.ALLOW_IFRAME = previousAllowIframe
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('keeps distinct defaults for new and partially stored settings', () => {
    const fresh = new ServerSettings()
    expect(fresh.homeBookshelfView).to.equal(1)
    expect(fresh.sortingPrefixes).to.deep.equal(['the', 'a'])
    const stored = new ServerSettings({})
    expect(stored.toJSON()).to.include({ tokenSecret: undefined, scannerParseSubtitle: undefined, homeBookshelfView: undefined, metadataFileFormat: 'json', version: null, buildNumber: 0 })
    expect(stored.sortingPrefixes).to.deep.equal(['the'])
  })

  it('preserves historical key migration and numeric coercion', () => {
    const settings = new ServerSettings({ storeCoverWithBook: true, storeMetadataWithBook: true, bookshelfView: 0, maxBackupSize: 0, rateLimitLoginRequests: '8', rateLimitLoginWindow: null })
    expect(settings.toJSON()).to.include({ storeCoverWithItem: true, storeMetadataWithItem: true, homeBookshelfView: 0, maxBackupSize: 0, rateLimitLoginRequests: 8, rateLimitLoginWindow: 0 })
    expect(() => new ServerSettings({ rateLimitLoginRequests: 1n })).to.throw(TypeError)
  })

  it('applies environment overrides when loading stored settings', () => {
    process.env.BACKUP_PATH = Path.join(directory, 'custom-backups')
    process.env.ALLOW_IFRAME = '1'
    const settings = new ServerSettings({ backupPath: '/stored', allowIframe: false })
    expect(settings.backupPath).to.equal(process.env.BACKUP_PATH)
    expect(settings.allowIframe).to.equal(true)
  })

  it('falls back to local authentication for incomplete OpenID configuration', () => {
    expect(new ServerSettings({ authActiveAuthMethods: ['openid'] }).authActiveAuthMethods).to.deep.equal(['local'])
    expect(new ServerSettings({ authActiveAuthMethods: 'invalid' }).authActiveAuthMethods).to.deep.equal(['local'])
    expect(new ServerSettings({ authActiveAuthMethods: [] }).authActiveAuthMethods).to.deep.equal(['local'])
  })

  it('removes private browser fields without modifying persisted settings', () => {
    const settings = new ServerSettings()
    settings.tokenSecret = 'test-placeholder'
    settings.authOpenIDClientID = 'client-placeholder'
    settings.authOpenIDClientSecret = 'secret-placeholder'
    const browser = settings.toJSONForBrowser()
    for (const key of ['tokenSecret', 'authOpenIDClientID', 'authOpenIDClientSecret', 'authOpenIDMobileRedirectURIs', 'authOpenIDGroupClaim', 'authOpenIDAdvancedPermsClaim']) {
      expect(browser).not.to.have.property(key)
    }
    expect(browser.timeZone).to.be.a('string')
    expect(settings.toJSON().tokenSecret).to.equal('test-placeholder')
  })

  it('limits patches to the existing allowlist and updates the logger', () => {
    const settings = new ServerSettings()
    expect(settings.update({ language: 'zh-cn', logLevel: 4, tokenSecret: 'ignored', id: 'ignored' })).to.equal(true)
    expect(settings.language).to.equal('zh-cn')
    expect(settings.tokenSecret).to.equal(null)
    expect(settings.id).to.equal('server-settings')
    expect(Logger.setLogLevel.calledOnceWithExactly(4)).to.equal(true)
    expect(settings.update({ language: 'zh-cn' })).to.equal(false)
  })
})
