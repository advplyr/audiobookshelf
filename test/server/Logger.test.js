const { expect } = require('chai')
const sinon = require('sinon')
const Logger = require('../../server/Logger') // Adjust the path as needed
const { LogLevel } = require('../../server/utils/constants')
const date = require('../../server/libs/dateAndTime')
const util = require('util')

describe('Logger', function () {
  let consoleTraceStub
  let consoleDebugStub
  let consoleInfoStub
  let consoleWarnStub
  let consoleErrorStub
  let consoleLogStub

  beforeEach(function () {
    // Stub the date format function to return a consistent timestamp
    sinon.stub(date, 'format').returns('2024-09-10 12:34:56.789')
    // Stub the source getter to return a consistent source
    sinon.stub(Logger, 'source').get(() => 'some/source.js')
    // Stub the console methods used in Logger
    consoleTraceStub = sinon.stub(console, 'trace')
    consoleDebugStub = sinon.stub(console, 'debug')
    consoleInfoStub = sinon.stub(console, 'info')
    consoleWarnStub = sinon.stub(console, 'warn')
    consoleErrorStub = sinon.stub(console, 'error')
    consoleLogStub = sinon.stub(console, 'log')
    // Initialize the Logger's logManager as a mock object
    Logger.logManager = {
      logToFile: sinon.stub().resolves()
    }
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('logging methods', function () {
    it('should have a method for each log level defined in the static block', function () {
      const loggerMethods = Object.keys(LogLevel).map((key) => key.toLowerCase())

      loggerMethods.forEach((method) => {
        expect(Logger).to.have.property(method).that.is.a('function')
      })
    })

    it('should call console.trace for trace logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.trace('Test message')

      // Assert
      expect(consoleTraceStub.calledOnce).to.be.true
    })

    it('should call console.debug for debug logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.debug('Test message')

      // Assert
      expect(consoleDebugStub.calledOnce).to.be.true
    })

    it('should call console.info for info logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.info('Test message')

      // Assert
      expect(consoleInfoStub.calledOnce).to.be.true
    })

    it('should call console.warn for warn logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.warn('Test message')

      // Assert
      expect(consoleWarnStub.calledOnce).to.be.true
    })

    it('should call console.error for error logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.error('Test message')

      // Assert
      expect(consoleErrorStub.calledOnce).to.be.true
    })

    it('should call console.error for fatal logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.fatal('Test message')

      // Assert
      expect(consoleErrorStub.calledOnce).to.be.true
    })

    it('should call console.log for note logging', function () {
      // Arrange
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.note('Test message')

      // Assert
      expect(consoleLogStub.calledOnce).to.be.true
    })
  })

  describe('#log', function () {
    it('should log to console and file if level is high enough', async function () {
      // Arrange
      const logArgs = ['Test message']
      Logger.logLevel = LogLevel.TRACE

      // Act
      Logger.debug(...logArgs)

      expect(consoleDebugStub.calledOnce).to.be.true
      expect(consoleDebugStub.calledWithExactly('[2024-09-10 12:34:56.789] DEBUG:', ...logArgs)).to.be.true
      expect(Logger.logManager.logToFile.calledOnce).to.be.true
      expect(
        Logger.logManager.logToFile.calledWithExactly({
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Test message',
          levelName: 'DEBUG',
          level: LogLevel.DEBUG
        })
      ).to.be.true
    })

    it('should not log if log level is too low', function () {
      // Arrange
      const logArgs = ['This log should not appear']
      // Set log level to ERROR, so DEBUG log should be ignored
      Logger.logLevel = LogLevel.ERROR

      // Act
      Logger.debug(...logArgs)

      // Verify console.debug is not called
      expect(consoleDebugStub.called).to.be.false
      expect(Logger.logManager.logToFile.called).to.be.false
    })

    it('should emit log to all connected sockets with appropriate log level', async function () {
      // Arrange
      const socket1 = { id: '1', emit: sinon.spy() }
      const socket2 = { id: '2', emit: sinon.spy() }
      Logger.addSocketListener(socket1, LogLevel.DEBUG)
      Logger.addSocketListener(socket2, LogLevel.ERROR)
      const logArgs = ['Socket test']
      Logger.logLevel = LogLevel.TRACE

      // Act
      await Logger.debug(...logArgs)

      // socket1 should receive the log, but not socket2
      expect(socket1.emit.calledOnce).to.be.true
      expect(
        socket1.emit.calledWithExactly('log', {
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Socket test',
          levelName: 'DEBUG',
          level: LogLevel.DEBUG
        })
      ).to.be.true

      expect(socket2.emit.called).to.be.false
    })

    it('should log fatal messages to console and file regardless of log level', async function () {
      // Arrange
      const logArgs = ['Fatal error']
      // Set log level to NOTE + 1, so nothing should be logged
      Logger.logLevel = LogLevel.NOTE + 1

      // Act
      await Logger.fatal(...logArgs)

      // Assert
      expect(consoleErrorStub.calledOnce).to.be.true
      expect(consoleErrorStub.calledWithExactly('[2024-09-10 12:34:56.789] FATAL:', ...logArgs)).to.be.true
      expect(Logger.logManager.logToFile.calledOnce).to.be.true
      expect(
        Logger.logManager.logToFile.calledWithExactly({
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Fatal error',
          levelName: 'FATAL',
          level: LogLevel.FATAL
        })
      ).to.be.true
    })

    it('should log note messages to console and file regardless of log level', async function () {
      // Arrange
      const logArgs = ['Note message']
      // Set log level to NOTE + 1, so nothing should be logged
      Logger.logLevel = LogLevel.NOTE + 1

      // Act
      await Logger.note(...logArgs)

      // Assert
      expect(consoleLogStub.calledOnce).to.be.true
      expect(consoleLogStub.calledWithExactly('[2024-09-10 12:34:56.789] NOTE:', ...logArgs)).to.be.true
      expect(Logger.logManager.logToFile.calledOnce).to.be.true
      expect(
        Logger.logManager.logToFile.calledWithExactly({
          timestamp: '2024-09-10 12:34:56.789',
          source: 'some/source.js',
          message: 'Note message',
          levelName: 'NOTE',
          level: LogLevel.NOTE
        })
      ).to.be.true
    })

    it('should log util.inspect(arg) for non-string objects', async function () {
      // Arrange
      const obj = { key: 'value' }
      const logArgs = ['Logging object:', obj]
      Logger.logLevel = LogLevel.TRACE

      // Act
      await Logger.debug(...logArgs)

      // Assert
      expect(consoleDebugStub.calledOnce).to.be.true
      expect(consoleDebugStub.calledWithExactly('[2024-09-10 12:34:56.789] DEBUG:', 'Logging object:', obj)).to.be.true
      expect(Logger.logManager.logToFile.calledOnce).to.be.true
      expect(Logger.logManager.logToFile.firstCall.args[0].message).to.equal('Logging object: ' + util.inspect(obj))
    })
  })

  describe('socket listeners', function () {
    it('should add and remove socket listeners', function () {
      // Arrange
      const socket1 = { id: '1', emit: sinon.spy() }
      const socket2 = { id: '2', emit: sinon.spy() }

      // Act
      Logger.addSocketListener(socket1, LogLevel.DEBUG)
      Logger.addSocketListener(socket2, LogLevel.ERROR)
      Logger.removeSocketListener('1')

      // Assert
      expect(Logger.socketListeners).to.have.lengthOf(1)
      expect(Logger.socketListeners[0].id).to.equal('2')
    })
  })

  describe('setLogLevel', function () {
    it('should change the log level and log the new level', function () {
      // Arrange
      const debugSpy = sinon.spy(Logger, 'debug')

      // Act
      Logger.setLogLevel(LogLevel.WARN)

      // Assert
      expect(Logger.logLevel).to.equal(LogLevel.WARN)
      expect(debugSpy.calledOnce).to.be.true
      expect(debugSpy.calledWithExactly('Set Log Level to WARN')).to.be.true
    })
  })
})
