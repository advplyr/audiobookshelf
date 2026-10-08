const { expect } = require('chai')
const sinon = require('sinon')

const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const Logger = require('../../../server/Logger')

describe('ServerSettings - mDNS', () => {
  let metadataPath
  before(() => {
    metadataPath = global.MetadataPath
    global.MetadataPath = '/metadata'
  })
  after(() => {
    global.MetadataPath = metadataPath
  })
  beforeEach(() => {
    // Saved settings without metadataFileFormat log a warning
    sinon.stub(Logger, 'warn')
  })
  afterEach(() => {
    sinon.restore()
  })

  it('should default to no mDNS name so the translated default name is used', () => {
    const settings = new ServerSettings()
    expect(settings.mdnsEnabled).to.be.true
    expect(settings.mdnsName).to.be.null
    expect(settings.toJSON().mdnsName).to.be.null
    expect(settings.toJSONForBrowser().mdnsName).to.be.null
  })

  it('should keep a saved mDNS name and treat a missing or empty one as the default', () => {
    expect(new ServerSettings({ mdnsName: 'School' }).mdnsName).to.equal('School')
    expect(new ServerSettings({ mdnsName: '' }).mdnsName).to.be.null
    expect(new ServerSettings({}).mdnsName).to.be.null
  })

  it('should round trip through toJSON', () => {
    const saved = new ServerSettings({ mdnsEnabled: false, mdnsName: 'School', mdnsServiceId: 'id', mdnsFallbackFor: 'School', mdnsFallbackLevel: 2, mdnsHostnameFallbackFor: 'school', mdnsHostnameFallbackLevel: 3 }).toJSON()
    const settings = new ServerSettings(saved)
    expect(settings).to.include({ mdnsEnabled: false, mdnsName: 'School', mdnsServiceId: 'id', mdnsFallbackFor: 'School', mdnsFallbackLevel: 2, mdnsHostnameFallbackFor: 'school', mdnsHostnameFallbackLevel: 3 })
    expect(new ServerSettings({}).mdnsHostnameFallbackLevel).to.be.null
    expect(new ServerSettings(new ServerSettings().toJSON()).mdnsName).to.be.null
  })

  it('should not send the fallback state to the browser', () => {
    const json = new ServerSettings({ mdnsFallbackFor: 'School', mdnsFallbackLevel: 2, mdnsHostnameFallbackFor: 'school', mdnsHostnameFallbackLevel: 1 }).toJSONForBrowser()
    expect(json).to.not.have.property('mdnsFallbackFor')
    expect(json).to.not.have.property('mdnsFallbackLevel')
    expect(json).to.not.have.property('mdnsHostnameFallbackFor')
    expect(json).to.not.have.property('mdnsHostnameFallbackLevel')
  })
})
