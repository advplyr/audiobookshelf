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
    req = { user: { username: 'testUser' }, url: '/test-url' }
    res = { send: sinon.spy() }
    next = sinon.spy()
  })

  describe('middleware', () => {
    it('should send cached data if available', () => {
      // Arrange
      const cachedData = { data: 'cached data' }
      cache.get.returns(cachedData)
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      manager = new ApiCacheManager(cache)

      // Act
      manager.middleware(req, res, next)

      // Assert
      expect(cache.get.calledOnce).to.be.true
      expect(cache.get.calledWith(key)).to.be.true
      expect(res.send.calledOnce).to.be.true
      expect(res.send.calledWith(cachedData)).to.be.true
      expect(res.originalSend).to.be.undefined
      expect(next.called).to.be.false
      expect(cache.set.called).to.be.false
    })

    it('should cache and send response if data is not cached', () => {
      // Arrange
      cache.get.returns(null)
      const responseData = { data: 'response data' }
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      manager = new ApiCacheManager(cache)

      // Act
      manager.middleware(req, res, next)
      res.send(responseData)

      // Assert
      expect(cache.get.calledOnce).to.be.true
      expect(cache.get.calledWith(key)).to.be.true
      expect(next.calledOnce).to.be.true
      expect(cache.set.calledOnce).to.be.true
      expect(cache.set.calledWith(key, responseData)).to.be.true
      expect(res.originalSend.calledOnce).to.be.true
      expect(res.originalSend.calledWith(responseData)).to.be.true
    })

    it('should cache personalized response with 30 minutes TTL', () => {
      // Arrange
      cache.get.returns(null)
      const responseData = { data: 'personalized data' }
      req.url = '/libraries/id/personalized'
      const key = JSON.stringify({ user: req.user.username, url: req.url })
      const ttlOptions = { ttl: 30 * 60 * 1000 }
      manager = new ApiCacheManager(cache, ttlOptions)

      // Act
      manager.middleware(req, res, next)
      res.send(responseData)

      // Assert
      expect(cache.get.calledOnce).to.be.true
      expect(cache.get.calledWith(key)).to.be.true
      expect(next.calledOnce).to.be.true
      expect(cache.set.calledOnce).to.be.true
      expect(cache.set.calledWith(key, responseData, ttlOptions)).to.be.true
      expect(res.originalSend.calledOnce).to.be.true
      expect(res.originalSend.calledWith(responseData)).to.be.true
    })
  })
})