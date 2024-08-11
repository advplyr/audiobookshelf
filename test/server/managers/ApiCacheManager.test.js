// Import dependencies and modules for testing
const { expect } = require('chai')
const sinon = require('sinon')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')

describe('ApiCacheManager', () => {
  let cache
  let req
  let res
  let next
  let manager

  beforeEach(() => {
    cache = { get: sinon.stub(), set: sinon.spy() }
    req = { user: { username: 'testUser' }, url: '/test-url', query: {} }
    res = { send: sinon.spy(), getHeaders: sinon.stub(), statusCode: 200, status: sinon.spy(), set: sinon.spy() }
    next = sinon.spy()
  })

  describe('middleware', () => {
    it('should send cached data if available', () => {
      // Arrange
      const cachedData = { body: 'cached data', headers: { 'content-type': 'application/json' }, statusCode: 200 }
      cache.get.returns(cachedData)
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      manager = new ApiCacheManager(cache)

      // Act
      manager.middleware(req, res, next)

      // Assert
      expect(cache.get.calledOnce).to.be.true
      expect(cache.get.calledWith(key)).to.be.true
      expect(res.set.calledOnce).to.be.true
      expect(res.set.calledWith(cachedData.headers)).to.be.true
      expect(res.status.calledOnce).to.be.true
      expect(res.status.calledWith(cachedData.statusCode)).to.be.true
      expect(res.send.calledOnce).to.be.true
      expect(res.send.calledWith(cachedData.body)).to.be.true
      expect(res.originalSend).to.be.undefined
      expect(next.called).to.be.false
      expect(cache.set.called).to.be.false
    })

    it('should cache and send response if data is not cached', () => {
      // Arrange
      cache.get.returns(null)
      const headers = { 'content-type': 'application/json' }
      res.getHeaders.returns(headers)
      const body = 'response data'
      const statusCode = 200
      const responseData = { body, headers, statusCode }
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      manager = new ApiCacheManager(cache)

      // Act
      manager.middleware(req, res, next)
      res.send(body)

      // Assert
      expect(cache.get.calledOnce).to.be.true
      expect(cache.get.calledWith(key)).to.be.true
      expect(next.calledOnce).to.be.true
      expect(cache.set.calledOnce).to.be.true
      expect(cache.set.calledWith(key, responseData)).to.be.true
      expect(res.originalSend.calledOnce).to.be.true
      expect(res.originalSend.calledWith(body)).to.be.true
    })

    it('should cache personalized response with 30 minutes TTL', () => {
      // Arrange
      cache.get.returns(null)
      const headers = { 'content-type': 'application/json' }
      res.getHeaders.returns(headers)
      const body = 'personalized data'
      const statusCode = 200
      const responseData = { body, headers, statusCode }
      req.url = '/libraries/id/personalized'
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      const ttlOptions = { ttl: 30 * 60 * 1000 }
      manager = new ApiCacheManager(cache, ttlOptions)

      // Act
      manager.middleware(req, res, next)
      res.send(body)

      // Assert
      expect(cache.get.calledOnce).to.be.true
      expect(cache.get.calledWith(key)).to.be.true
      expect(next.calledOnce).to.be.true
      expect(cache.set.calledOnce).to.be.true
      expect(cache.set.calledWith(key, responseData, ttlOptions)).to.be.true
      expect(res.originalSend.calledOnce).to.be.true
      expect(res.originalSend.calledWith(body)).to.be.true
    })
  })
})
