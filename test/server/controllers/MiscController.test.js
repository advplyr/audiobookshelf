const { expect } = require('chai')
const sinon = require('sinon')

const MiscController = require('../../../server/controllers/MiscController')
const Database = require('../../../server/Database')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const Logger = require('../../../server/Logger')

describe('MiscController - updateAuthSettings', () => {
  let previousMetadataPath

  beforeEach(() => {
    previousMetadataPath = global.MetadataPath
    global.MetadataPath = '/metadata'
    Database.serverSettings = new ServerSettings()
    sinon.stub(Database, 'updateServerSettings').resolves()
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'debug')
  })

  afterEach(() => {
    sinon.restore()
    global.MetadataPath = previousMetadataPath
  })

  async function updateMobileRedirectURIs(uris) {
    const fakeRes = { json: sinon.spy(), sendStatus: sinon.spy() }
    await MiscController.updateAuthSettings({ user: { isAdminOrUp: true }, body: { authOpenIDMobileRedirectURIs: uris } }, fakeRes)
    return Database.serverSettings.authOpenIDMobileRedirectURIs
  }

  it('accepts valid mobile redirect URIs', async () => {
    const uris = ['audiobookshelf://oauth', 'https://example.com/path', 'com.example.app:/oauth2redirect/example-provider', 'com.google.android.wear:/3p_auth/com.example.app']
    expect(await updateMobileRedirectURIs(uris)).to.deep.equal(uris)
  })

  it('rejects invalid mobile redirect URIs', async () => {
    const testCases = ['javascript:alert(1)', 'https://', 'abs:/', 'abs:oauth', 'abs://host?x=1', 'abs://host/a b']

    for (const uri of testCases) {
      expect(await updateMobileRedirectURIs([uri]), uri).to.deep.equal(['audiobookshelf://oauth'])
    }
  })

  it('does not backtrack on long invalid URIs', async () => {
    const start = Date.now()
    await updateMobileRedirectURIs(['a://h' + '/a'.repeat(24) + '!'])
    await updateMobileRedirectURIs(['a:/a' + '/a'.repeat(24) + '!'])
    expect(Date.now() - start).to.be.below(100)
  })
})
