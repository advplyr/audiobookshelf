const { expect } = require('chai')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const CustomProviderAdapter = require('../../../server/providers/CustomProviderAdapter')

describe('CustomProviderAdapter', () => {
  afterEach(() => {
    sinon.restore()
  })

  it('allows an administrator-configured provider on a private network', async () => {
    sinon.stub(Logger, 'debug')
    sinon.stub(Database, 'customMetadataProviderModel').get(() => ({
      findByPk: sinon.stub().resolves({
        url: 'http://127.0.0.1:8080',
        authHeaderValue: null
      })
    }))
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response(JSON.stringify({
      matches: [{ title: 'Private provider result' }]
    })))

    const results = await new CustomProviderAdapter().search('Title', null, null, 'custom-provider-id', 'book')

    expect(results).to.deep.equal([{ title: 'Private provider result' }])
    expect(fetchStub.firstCall.args[0].toString()).to.equal('http://127.0.0.1:8080/search?mediaType=book&query=Title')
  })
})
