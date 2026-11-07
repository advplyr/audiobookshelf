const { expect } = require('chai')
const express = require('express')
const http = require('http')
const sinon = require('sinon')

const Logger = require('../../../server/Logger')
const RateLimiterFactory = require('../../../server/utils/rateLimiterFactory')

function listen(app) {
  const server = http.createServer(app)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

function patchPassword(port, { userId, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ password: 'current', newPassword: 'next' })
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/me/password',
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'rate-limiter-test',
          'x-user-id': userId,
          ...headers
        }
      },
      (res) => {
        res.resume()
        res.on('end', () => resolve({ status: res.statusCode }))
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function passwordChangeApp(limiter) {
  const app = express()
  app.patch(
    '/me/password',
    (req, res, next) => {
      const userId = req.get('x-user-id')
      if (userId) req.user = { id: userId }
      next()
    },
    limiter,
    (req, res) => {
      res.status(400).send('Invalid password')
    }
  )
  return app
}

function postLogin(port, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'alice', password: 'guess' })
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'rate-limiter-test',
          ...headers
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data, headers: res.headers })
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

describe('rateLimiterFactory', () => {
  const previousMax = process.env.RATE_LIMIT_AUTH_MAX
  const previousWindow = process.env.RATE_LIMIT_AUTH_WINDOW
  const previousMessage = process.env.RATE_LIMIT_AUTH_MESSAGE

  beforeEach(() => {
    RateLimiterFactory.authRateLimiter = null
    RateLimiterFactory.passwordChangeRateLimiter = null
    process.env.RATE_LIMIT_AUTH_MAX = '3'
    process.env.RATE_LIMIT_AUTH_WINDOW = '60000'
    delete process.env.RATE_LIMIT_AUTH_MESSAGE
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'debug')
  })

  afterEach(() => {
    RateLimiterFactory.authRateLimiter = null
    RateLimiterFactory.passwordChangeRateLimiter = null
    if (previousMax === undefined) delete process.env.RATE_LIMIT_AUTH_MAX
    else process.env.RATE_LIMIT_AUTH_MAX = previousMax
    if (previousWindow === undefined) delete process.env.RATE_LIMIT_AUTH_WINDOW
    else process.env.RATE_LIMIT_AUTH_WINDOW = previousWindow
    if (previousMessage === undefined) delete process.env.RATE_LIMIT_AUTH_MESSAGE
    else process.env.RATE_LIMIT_AUTH_MESSAGE = previousMessage
    sinon.restore()
  })

  it('shares one bucket across rotating client IP headers and returns 429 after max failures', async () => {
    const app = express()
    const limiter = RateLimiterFactory.getAuthRateLimiter()
    app.post('/login', limiter, (req, res) => {
      res.status(401).json({ error: 'Unauthorized' })
    })

    const { server, port } = await listen(app)
    try {
      const statuses = []
      for (let i = 0; i < 4; i++) {
        const result = await postLogin(port, {
          headers: {
            'X-Client-IP': `10.0.0.${i}`,
            'X-Forwarded-For': `203.0.113.${i}`
          }
        })
        statuses.push(result.status)
      }

      expect(statuses).to.deep.equal([401, 401, 401, 429])
    } finally {
      await closeServer(server)
    }
  })

  it('does not consume a slot for successful logins', async () => {
    const app = express()
    const limiter = RateLimiterFactory.getAuthRateLimiter()
    let attempt = 0
    app.post('/login', limiter, (req, res) => {
      attempt += 1
      if (attempt === 1) {
        return res.status(200).json({ ok: true })
      }
      res.status(401).json({ error: 'Unauthorized' })
    })

    const { server, port } = await listen(app)
    try {
      const success = await postLogin(port)
      expect(success.status).to.equal(200)

      const statuses = []
      for (let i = 0; i < 4; i++) {
        const result = await postLogin(port, {
          headers: {
            'X-Client-IP': `10.1.0.${i}`
          }
        })
        statuses.push(result.status)
      }

      expect(statuses).to.deep.equal([401, 401, 401, 429])
    } finally {
      await closeServer(server)
    }
  })

  it('limits password changes per user and ignores client IP headers', async () => {
    const app = passwordChangeApp(RateLimiterFactory.getPasswordChangeRateLimiter())
    const { server, port } = await listen(app)
    try {
      const alice = []
      for (let i = 0; i < 4; i++) {
        const result = await patchPassword(port, {
          userId: 'alice',
          headers: {
            'X-Client-IP': `10.2.0.${i}`,
            'X-Forwarded-For': `198.51.100.${i}`
          }
        })
        alice.push(result.status)
      }
      const bob = await patchPassword(port, { userId: 'bob' })

      expect(alice).to.deep.equal([400, 400, 400, 429])
      expect(bob.status).to.equal(400)
      expect(Logger.warn.calledWithMatch(/User: alice/)).to.equal(true)
    } finally {
      await closeServer(server)
    }
  })

  it('does not consume a password-change slot for a successful update', async () => {
    let attempt = 0
    const app = express()
    const limiter = RateLimiterFactory.getPasswordChangeRateLimiter()
    app.patch(
      '/me/password',
      (req, res, next) => {
        req.user = { id: 'alice' }
        next()
      },
      limiter,
      (req, res) => {
        attempt += 1
        res.status(attempt === 1 ? 200 : 400).send(attempt === 1 ? 'ok' : 'Invalid password')
      }
    )

    const { server, port } = await listen(app)
    try {
      const success = await patchPassword(port, { userId: 'alice' })
      expect(success.status).to.equal(200)

      const statuses = []
      for (let i = 0; i < 4; i++) {
        const result = await patchPassword(port, { userId: 'alice' })
        statuses.push(result.status)
      }
      expect(statuses).to.deep.equal([400, 400, 400, 429])
    } finally {
      await closeServer(server)
    }
  })

  it('can be disabled with RATE_LIMIT_AUTH_MAX=0', async () => {
    RateLimiterFactory.authRateLimiter = null
    process.env.RATE_LIMIT_AUTH_MAX = '0'

    const app = express()
    const limiter = RateLimiterFactory.getAuthRateLimiter()
    app.post('/login', limiter, (req, res) => {
      res.status(401).json({ error: 'Unauthorized' })
    })

    const { server, port } = await listen(app)
    try {
      for (let i = 0; i < 5; i++) {
        const result = await postLogin(port)
        expect(result.status).to.equal(401)
      }
    } finally {
      await closeServer(server)
    }
  })
})
