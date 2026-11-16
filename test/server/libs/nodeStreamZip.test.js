const { expect } = require('chai')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const StreamZip = require('../../../server/libs/nodeStreamZip')

function crc32(buf) {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return ~crc >>> 0
}

/**
 * Build a zip holding a single deflated entry
 *
 * @param {string} name
 * @param {Buffer} data
 * @returns {Buffer}
 */
function buildZip(name, data) {
  const fileName = Buffer.from(name)
  const compressed = zlib.deflateRawSync(data)
  const crc = crc32(data)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0, 6) // flags
  local.writeUInt16LE(8, 8) // deflated
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(fileName.length, 26)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4) // version made by
  central.writeUInt16LE(20, 6) // version needed
  central.writeUInt16LE(0, 8) // flags
  central.writeUInt16LE(8, 10) // deflated
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(fileName.length, 28)
  central.writeUInt32LE(0, 42) // local header offset

  const centralOffset = local.length + fileName.length + compressed.length
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + fileName.length, 12)
  end.writeUInt32LE(centralOffset, 16)

  return Buffer.concat([local, fileName, compressed, central, fileName, end])
}

describe('nodeStreamZip', () => {
  const entryName = 'OEBPS/cover.png'
  let dir
  let zipPath
  let data

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abs-streamzip-'))
    zipPath = path.join(dir, 'book.epub')
    data = crypto.randomBytes(512 * 1024)
    fs.writeFileSync(zipPath, buildZip(entryName, data))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  describe('extract', () => {
    it('extracts a deflated entry', async () => {
      const outPath = path.join(dir, 'cover.png')
      const zip = new StreamZip.async({ file: zipPath })
      await zip.extract(entryName, outPath)
      await zip.close()

      expect(fs.readFileSync(outPath).equals(data)).to.be.true
    })

    it('does not leave the entry stream reading after the output file fails to open', async () => {
      // Mocha turns uncaught exceptions into failures of whatever test is running, so swap its listeners out
      const mochaListeners = process.listeners('uncaughtException')
      process.removeAllListeners('uncaughtException')
      const uncaught = []
      const onUncaught = (err) => uncaught.push(err)
      process.on('uncaughtException', onUncaught)

      try {
        const zip = new StreamZip.async({ file: zipPath })
        let extractError = null
        await zip.extract(entryName, path.join(dir, 'missing', 'cover.png')).catch((err) => {
          extractError = err
        })
        await zip.close()
        await new Promise((resolve) => setTimeout(resolve, 200))

        expect(extractError).to.be.an('error')
        expect(extractError.code).to.equal('ENOENT')
        expect(uncaught).to.deep.equal([])
      } finally {
        process.removeListener('uncaughtException', onUncaught)
        mochaListeners.forEach((listener) => process.on('uncaughtException', listener))
      }
    })
  })
})
