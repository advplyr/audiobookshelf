const { expect } = require('chai')
const dns = require('node:dns')
const sinon = require('sinon')
const { EnvHttpProxyAgent, getGlobalDispatcher } = require('undici')
const { fetchResponse, safeFetch } = require('../../../server/utils/fetchUtils')

const originalExpProxySupport = process.env.EXP_PROXY_SUPPORT

describe('fetchUtils', () => {
  afterEach(() => {
    sinon.restore()
    delete global.DisableSsrfRequestFilter
    if (originalExpProxySupport === undefined) {
      delete process.env.EXP_PROXY_SUPPORT
    } else {
      process.env.EXP_PROXY_SUPPORT = originalExpProxySupport
    }
  })

  it('blocks private, loopback, and IPv4-mapped IPv6 destinations before connecting', async () => {
    const fetchStub = sinon.stub(global, 'fetch')

    await assertRejected(safeFetch('http://127.0.0.1'), 'Call to 127.0.0.1 is blocked.')
    await assertRejected(safeFetch('http://10.0.0.1'), 'Call to 10.0.0.1 is blocked.')
    await assertRejected(safeFetch('http://[::1]'), 'is blocked.')
    await assertRejected(safeFetch('http://[::ffff:127.0.0.1]'), 'is blocked.')
    sinon.assert.notCalled(fetchStub)
  })

  it('validates every redirect destination', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1' }
    }))

    await assertRejected(safeFetch('https://example.com'), 'Call to 127.0.0.1 is blocked.')
    sinon.assert.calledOnce(fetchStub)
    expect(fetchStub.firstCall.args[1].redirect).to.equal('manual')
  })

  it('does not forward sensitive headers across origins', async () => {
    const fetchStub = sinon.stub(global, 'fetch')
      .onFirstCall().resolves(new Response(null, {
        status: 302,
        headers: { location: 'https://redirect.example/result' }
      }))
      .onSecondCall().resolves(new Response('ok'))

    await safeFetch('https://provider.example/search', {
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
        'X-Request-Id': 'request-id'
      }
    })

    const redirectedHeaders = new Headers(fetchStub.secondCall.args[1].headers)
    expect(redirectedHeaders.get('authorization')).to.equal(null)
    expect(redirectedHeaders.get('cookie')).to.equal(null)
    expect(redirectedHeaders.get('x-request-id')).to.equal('request-id')
  })

  it('keeps sensitive headers on same-origin redirects', async () => {
    const fetchStub = sinon.stub(global, 'fetch')
      .onFirstCall().resolves(new Response(null, {
        status: 302,
        headers: { location: '/result' }
      }))
      .onSecondCall().resolves(new Response('ok'))

    await safeFetch('https://provider.example/search', {
      headers: { Authorization: 'Bearer secret' }
    })

    const redirectedHeaders = new Headers(fetchStub.secondCall.args[1].headers)
    expect(redirectedHeaders.get('authorization')).to.equal('Bearer secret')
  })

  it('passes an Undici dispatcher to protected requests', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response('ok'))

    await safeFetch('https://example.com')

    expect(fetchStub.firstCall.args[1].dispatcher).to.exist
  })

  it('rejects malformed DNS lookup results before connecting', async () => {
    sinon.stub(dns, 'lookup').yields(null, ['203.0.113.10'])

    await assertLookupRejected(safeFetch('https://example.com'))
  })

  it('rejects non-IP DNS lookup results before connecting', async () => {
    sinon.stub(dns, 'lookup').yields(null, [{ address: 'redirect.example', family: 4 }])

    await assertLookupRejected(safeFetch('https://example.com'))
  })

  it('honors the configured SSRF bypass for private destinations', async () => {
    global.DisableSsrfRequestFilter = () => true
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response('ok'))

    await safeFetch('http://127.0.0.1')

    expect(fetchStub.firstCall.args[1].dispatcher).to.equal(getGlobalDispatcher())
  })

  it('allows explicitly trusted private-network destinations', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response('ok'))

    await safeFetch('http://127.0.0.1', { allowPrivateNetwork: true })

    expect(fetchStub.firstCall.args[1].dispatcher).not.to.equal(getGlobalDispatcher())
  })

  it('blocks a private redirect from a trusted public provider', async () => {
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/result' }
    }))

    await assertRejected(safeFetch('https://provider.example/search', {
      allowPrivateNetwork: true
    }), 'Call to 127.0.0.1 is blocked.')

    sinon.assert.calledOnce(fetchStub)
  })

  it('allows a private redirect when the trusted provider is local', async () => {
    const fetchStub = sinon.stub(global, 'fetch')
      .onFirstCall().resolves(new Response(null, {
        status: 302,
        headers: { location: 'http://192.168.1.10/result' }
      }))
      .onSecondCall().resolves(new Response('ok'))

    const response = await safeFetch('http://127.0.0.1/search', {
      allowPrivateNetwork: true
    })

    expect(await response.text()).to.equal('ok')
    sinon.assert.calledTwice(fetchStub)
  })

  it('does not apply the response timeout to the total body duration', async () => {
    const dispatchStub = sinon.stub(getGlobalDispatcher(), 'dispatch').returns(false)
    const fetchStub = sinon.stub(global, 'fetch').callsFake(async () => {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('first'))
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode('second'))
            controller.close()
          }, 40)
        }
      }))
    })

    const response = await fetchResponse('https://example.com', { timeout: 20 })

    expect(await response.text()).to.equal('firstsecond')
    const timeoutDispatcher = fetchStub.firstCall.args[1].dispatcher
    expect(timeoutDispatcher).not.to.equal(getGlobalDispatcher())
    timeoutDispatcher.dispatch({ origin: 'https://example.com' }, { onError() {} })
    expect(dispatchStub.firstCall.args[0].headersTimeout).to.equal(20)
    expect(dispatchStub.firstCall.args[0].bodyTimeout).to.equal(20)
  })

  it('times out while waiting for response headers', async () => {
    sinon.stub(global, 'fetch').callsFake((url, options) => {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
    })

    await assertRejected(fetchResponse('https://example.com', { timeout: 10 }), 'Request timed out after 10ms')
  })

  it('preserves a caller-provided abort signal', async () => {
    const controller = new AbortController()
    sinon.stub(global, 'fetch').callsFake((url, options) => {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
    })

    const responsePromise = fetchResponse('https://example.com', {
      timeout: 1000,
      signal: controller.signal
    })
    controller.abort(new Error('Caller aborted'))

    await assertRejected(responsePromise, 'Caller aborted')
  })

  it('uses an environment proxy dispatcher when proxy support is enabled', async () => {
    process.env.EXP_PROXY_SUPPORT = '1'
    const fetchStub = sinon.stub(global, 'fetch').resolves(new Response('ok'))

    await fetchResponse('https://example.com')

    expect(fetchStub.firstCall.args[1].dispatcher).to.be.instanceOf(EnvHttpProxyAgent)
  })
})

async function assertRejected(promise, message) {
  try {
    await promise
    throw new Error('Expected promise to reject')
  } catch (error) {
    expect(error.message).to.include(message)
  }
}

async function assertLookupRejected(promise) {
  try {
    await promise
    throw new Error('Expected promise to reject')
  } catch (error) {
    expect(error.cause.message).to.include('Call to example.com is blocked.')
  }
}
