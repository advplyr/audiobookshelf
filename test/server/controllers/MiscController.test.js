const { expect } = require('chai')
const sinon = require('sinon')

const MiscController = require('../../../server/controllers/MiscController')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('MiscController - updateServerSettings (mDNS)', () => {
  let originalServerSettings
  let context
  let lockedByEnv

  const patch = async (body) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      send(body) {
        this.body = body
        return this
      },
      sendStatus(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      }
    }
    await MiscController.updateServerSettings.call(context, { user: { isAdminOrUp: true, username: 'admin' }, body }, res)
    return res
  }

  let metadataPath
  before(() => {
    metadataPath = global.MetadataPath
    global.MetadataPath = '/metadata'
  })
  after(() => {
    global.MetadataPath = metadataPath
  })

  beforeEach(() => {
    originalServerSettings = Database.serverSettings
    Database.serverSettings = new ServerSettings()
    sinon.stub(Database, 'updateServerSettings').resolves()
    sinon.stub(Logger, 'setLogLevel')
    lockedByEnv = { enabled: false, name: false }
    context = {
      mdnsManager: { lockedByEnv, apply: sinon.stub().resolves() },
      backupManager: { updateCronSchedule: sinon.stub() }
    }
  })

  afterEach(() => {
    Database.serverSettings = originalServerSettings
    sinon.restore()
  })

  it('should save a normalized name and re-apply mDNS', async () => {
    const res = await patch({ mdnsName: '  School  ' })
    expect(res.statusCode).to.equal(200)
    expect(Database.serverSettings.mdnsName).to.equal('School')
    expect(res.body.serverSettings.mdnsName).to.equal('School')
    expect(context.mdnsManager.apply.calledOnce).to.be.true
  })

  it('should respond without waiting for mDNS to be applied', async () => {
    // e.g. goodbyes or a HOST lookup that take a while, GET /api/mdns reports 'updating' meanwhile
    context.mdnsManager.apply = sinon.stub().returns(new Promise(() => {}))
    for (const body of [{ mdnsName: 'School' }, { mdnsEnabled: false }, { language: 'de' }]) {
      const res = await patch(body)
      expect(res.statusCode, JSON.stringify(body)).to.equal(200)
    }
    expect(context.mdnsManager.apply.callCount).to.equal(3)
    expect(Database.serverSettings).to.include({ mdnsName: 'School', mdnsEnabled: false, language: 'de' })
  })

  it('should not apply mDNS for unrelated settings', async () => {
    const res = await patch({ dateFormat: 'dd/MM/yyyy', allowIframe: true })
    expect(res.statusCode).to.equal(200)
    expect(context.mdnsManager.apply.called).to.be.false
  })

  it('should reset to the default name for an empty name or null', async () => {
    for (const mdnsName of ['', '   ', null]) {
      Database.serverSettings.mdnsName = 'School'
      context.mdnsManager.apply.resetHistory()
      const res = await patch({ mdnsName })
      expect(res.statusCode, JSON.stringify(mdnsName)).to.equal(200)
      expect(Database.serverSettings.mdnsName).to.be.null
      expect(context.mdnsManager.apply.calledOnce).to.be.true
    }
  })

  it('should reject invalid names', async () => {
    for (const mdnsName of ['School (2)', 'x'.repeat(64), 42, false, true, {}, [], '\u0001']) {
      const res = await patch({ mdnsName })
      expect(res.statusCode, JSON.stringify(mdnsName)).to.equal(400)
    }
    expect(Database.serverSettings.mdnsName).to.be.null
    expect(context.mdnsManager.apply.called).to.be.false
  })

  it('should re-apply mDNS when the server language changes so the default name follows it', async () => {
    const res = await patch({ language: 'de' })
    expect(res.statusCode).to.equal(200)
    expect(Database.serverSettings.language).to.equal('de')
    expect(context.mdnsManager.apply.calledOnce).to.be.true
  })

  it('should apply mDNS once when the language and the name change together', async () => {
    const res = await patch({ language: 'de', mdnsName: 'School' })
    expect(res.statusCode).to.equal(200)
    expect(Database.serverSettings).to.include({ language: 'de', mdnsName: 'School' })
    expect(context.mdnsManager.apply.calledOnce).to.be.true
  })

  it('should not re-apply mDNS when nothing changed', async () => {
    await patch({ language: 'en-us', mdnsName: null })
    await patch({ dateFormat: 'dd/MM/yyyy' })
    expect(context.mdnsManager.apply.called).to.be.false
  })

  it('should not change the name while MDNS_NAME is set', async () => {
    lockedByEnv.name = true
    expect((await patch({ mdnsName: 'School' })).statusCode).to.equal(400)
    Database.serverSettings.mdnsName = 'School'
    expect((await patch({ mdnsName: '' })).statusCode).to.equal(400)
    expect(Database.serverSettings.mdnsName).to.equal('School')
    // Sending the unchanged name (e.g. together with other settings) is fine
    expect((await patch({ mdnsName: 'School' })).statusCode).to.equal(200)
  })

  it('should accept an empty name while MDNS_NAME is set and no name is saved', async () => {
    lockedByEnv.name = true
    const res = await patch({ mdnsName: '' })
    expect(res.statusCode).to.equal(200)
    expect(Database.serverSettings.mdnsName).to.be.null
    expect(context.mdnsManager.apply.called).to.be.false
  })
})
