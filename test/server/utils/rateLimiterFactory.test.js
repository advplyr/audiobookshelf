const { expect } = require('chai')
const sinon = require('sinon')
const http = require('http')
const express = require('express')
const Logger = require('../../../server/Logger')
const rateLimiterFactory = require('../../../server/utils/rateLimiterFactory')

describe('RateLimiterFactory', () => {
  const envKeys = ['RATE_LIMIT_AUTH_MAX', 'RATE_LIMIT_AUTH_WINDOW', 'RATE_LIMIT_AUTH_MESSAGE']
  let savedEnv
  let server

  beforeEach(() => {
    savedEnv = envKeys.map((key) => process.env[key])
    envKeys.forEach((key) => delete process.env[key])
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'warn')
  })

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      server = null
    }
    envKeys.forEach((key, index) => {
      if (savedEnv[index] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[index]
    })
    sinon.restore()
  })

  async function start(factory) {
    const app = express()
    app.get('/auth', factory.getAuthRateLimiter(), (req, res) => res.json({ ok: true }))
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  }

  function request(headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port: server.address().port, path: '/auth', headers }, (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }))
      })
      req.on('error', reject)
    })
  }

  it('exports a cached singleton with the original defaults', () => {
    expect(require('../../../server/utils/rateLimiterFactory')).to.equal(rateLimiterFactory)
    expect(rateLimiterFactory.constructor.DEFAULT_WINDOW_MS).to.equal(600000)
    expect(rateLimiterFactory.constructor.DEFAULT_MAX).to.equal(40)
    const factory = new rateLimiterFactory.constructor()
    expect(factory.authRateLimiter).to.equal(null)
    const middleware = factory.getAuthRateLimiter()
    expect(factory.getAuthRateLimiter()).to.equal(middleware)
    expect(middleware.resetKey).to.be.a('function')
  })

  it('disables rate limiting only for the exact zero environment value', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '0'
    const factory = new rateLimiterFactory.constructor()
    await start(factory)
    expect(factory.getAuthRateLimiter().resetKey).to.equal(undefined)
    expect((await request()).status).to.equal(200)
    expect((await request()).status).to.equal(200)
    expect((await request()).headers).not.to.have.property('ratelimit-limit')
    expect(Logger.info.calledOnce).to.be.true
  })

  it('uses defaults for invalid and non-positive settings', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '-1'
    process.env.RATE_LIMIT_AUTH_WINDOW = 'invalid'
    await start(new rateLimiterFactory.constructor())
    const response = await request()
    expect(response.status).to.equal(200)
    expect(response.headers['ratelimit-limit']).to.equal('40')
    expect(response.headers['ratelimit-policy']).to.equal('40;w=600')
    expect(response.headers).not.to.have.property('x-ratelimit-limit')
  })

  it('preserves parseInt settings, proxy IP keys, custom errors, and cached configuration', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '1attempt'
    process.env.RATE_LIMIT_AUTH_WINDOW = '60000ms'
    process.env.RATE_LIMIT_AUTH_MESSAGE = 'Custom auth limit'
    const factory = new rateLimiterFactory.constructor()
    await start(factory)
    const headers = { 'X-Forwarded-For': '198.51.100.1, 198.51.100.2', 'User-Agent': 'RateLimitTest' }
    expect((await request(headers)).status).to.equal(200)
    process.env.RATE_LIMIT_AUTH_MAX = '0'
    const blocked = await request(headers)
    expect(blocked.status).to.equal(429)
    expect(blocked.body).to.deep.equal({ error: 'Custom auth limit' })
    expect(blocked.headers['ratelimit-policy']).to.equal('1;w=60')
    expect(Logger.warn.lastCall.args[0]).to.equal('[RateLimiter] Rate limit exceeded - IP: 198.51.100.1, Endpoint: GET /auth, User-Agent: RateLimitTest')
    expect((await request({ 'X-Client-IP': '198.51.100.3' })).status).to.equal(200)
  })

  it('falls back to the request IP and the default error message', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '1'
    await start(new rateLimiterFactory.constructor())
    expect((await request()).status).to.equal(200)
    const response = await request()
    expect(response.status).to.equal(429)
    expect(response.body).to.deep.equal({ error: 'Too many authentication requests' })
    expect(Logger.warn.lastCall.args[0]).to.include('IP: 127.0.0.1')
  })
})
