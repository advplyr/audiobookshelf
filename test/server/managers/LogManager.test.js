const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const Path = require('path')

describe('LogManager', () => {
  let tmp
  let manager

  beforeEach(() => {
    tmp = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-logmanager-'))
    global.MetadataPath = tmp
    global.ServerSettings = { loggerDailyLogsToKeep: 7, loggerScannerLogsToKeep: 2 }
    const LogManager = require('../../../server/managers/LogManager')
    manager = new LogManager()
    fs.mkdirSync(manager.ScanLogPath, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  describe('removeOldScanLogs', () => {
    it('keeps only the newest loggerScannerLogsToKeep scan logs', async () => {
      const now = Date.now() / 1000
      for (let i = 0; i < 5; i++) {
        const p = Path.join(manager.ScanLogPath, `2026-01-01_${i}.txt`)
        fs.writeFileSync(p, 'x')
        fs.utimesSync(p, now - (5 - i) * 60, now - (5 - i) * 60)
      }

      await manager.removeOldScanLogs()

      expect(fs.readdirSync(manager.ScanLogPath).sort()).to.deep.equal(['2026-01-01_3.txt', '2026-01-01_4.txt'])
    })

    it('does nothing when at or below the limit', async () => {
      fs.writeFileSync(Path.join(manager.ScanLogPath, 'a.txt'), 'x')
      await manager.removeOldScanLogs()
      expect(fs.readdirSync(manager.ScanLogPath)).to.have.length(1)
    })
  })
})
