const { expect } = require('chai')
const express = require('express')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const sinon = require('sinon')

const Logger = require('../../../server/Logger')
const { fileUploadParser, requireUploadPermission, sweepUploadTempFiles } = require('../../../server/utils/fileUploadMiddleware')

function listTmpFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((name) => name.startsWith('tmp-'))
}

function sendMultipart(port, urlPath, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const boundary = '----AbsUploadTestBoundary'
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="f"; filename="probe.txt"',
      'Content-Type: text/plain',
      '',
      'probe',
      `--${boundary}--`,
      ''
    ].join('\r\n')

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(payload),
          ...extraHeaders
        }
      },
      (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode))
      }
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

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

async function waitFor(predicate, timeoutMs = 2000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Timed out waiting for condition')
}

describe('fileUploadMiddleware', () => {
  let metadataDir
  let tmpDir
  let previousMetadataPath

  beforeEach(() => {
    previousMetadataPath = global.MetadataPath
    metadataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abs-upload-meta-'))
    tmpDir = path.join(metadataDir, 'tmp')
    global.MetadataPath = metadataDir
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
  })

  afterEach(() => {
    sinon.restore()
    global.MetadataPath = previousMetadataPath
    fs.rmSync(metadataDir, { recursive: true, force: true })
  })

  describe('requireUploadPermission', () => {
    it('returns 403 when the user cannot upload', () => {
      const req = { user: { canUpload: false, username: 'guest' } }
      const res = { sendStatus: sinon.stub() }
      const next = sinon.stub()

      requireUploadPermission(req, res, next)

      expect(res.sendStatus.calledOnceWithExactly(403)).to.equal(true)
      expect(next.called).to.equal(false)
    })

    it('calls next when the user can upload', () => {
      const req = { user: { canUpload: true, username: 'uploader' } }
      const res = { sendStatus: sinon.stub() }
      const next = sinon.stub()

      requireUploadPermission(req, res, next)

      expect(next.calledOnce).to.equal(true)
      expect(res.sendStatus.called).to.equal(false)
    })
  })

  describe('sweepUploadTempFiles', () => {
    it('removes leftover tmp-* files and leaves other names', async () => {
      fs.mkdirSync(tmpDir, { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'tmp-1-123'), 'stale')
      fs.writeFileSync(path.join(tmpDir, 'tmp-2-456'), 'stale')
      fs.writeFileSync(path.join(tmpDir, 'comic-extract-keep'), 'keep')
      fs.mkdirSync(path.join(tmpDir, 'tmp-not-a-file'))

      await sweepUploadTempFiles()

      expect(fs.existsSync(path.join(tmpDir, 'tmp-1-123'))).to.equal(false)
      expect(fs.existsSync(path.join(tmpDir, 'tmp-2-456'))).to.equal(false)
      expect(fs.existsSync(path.join(tmpDir, 'comic-extract-keep'))).to.equal(true)
      expect(fs.existsSync(path.join(tmpDir, 'tmp-not-a-file'))).to.equal(true)
    })

    it('returns when the temp directory does not exist', async () => {
      await sweepUploadTempFiles()
      expect(fs.existsSync(tmpDir)).to.equal(false)
    })
  })

  describe('upload parser mounting', () => {
    it('does not write tmp-* files for a route without the parser', async () => {
      const app = express()
      app.use((req, res) => res.sendStatus(404))
      const { server, port } = await listen(app)

      try {
        const status = await sendMultipart(port, '/not-a-route')
        expect(status).to.equal(404)
        expect(listTmpFiles(tmpDir)).to.deep.equal([])
      } finally {
        await closeServer(server)
      }
    })

    it('does not write tmp-* files when permission is rejected before parsing', async () => {
      const app = express()
      app.use((req, res, next) => {
        req.user = { canUpload: false, username: 'guest' }
        next()
      })
      app.post('/upload', requireUploadPermission, fileUploadParser, (req, res) => {
        res.sendStatus(200)
      })
      const { server, port } = await listen(app)

      try {
        const status = await sendMultipart(port, '/upload')
        expect(status).to.equal(403)
        expect(listTmpFiles(tmpDir)).to.deep.equal([])
      } finally {
        await closeServer(server)
      }
    })

    it('removes the temp file when the handler rejects without moving it', async () => {
      const app = express()
      app.use((req, res, next) => {
        req.user = { canUpload: true, username: 'uploader' }
        next()
      })
      app.post('/upload', requireUploadPermission, fileUploadParser, (req, res) => {
        res.status(400).send('Invalid request no file or url')
      })
      const { server, port } = await listen(app)

      try {
        const status = await sendMultipart(port, '/upload')
        expect(status).to.equal(400)
        await waitFor(() => listTmpFiles(tmpDir).length === 0)
      } finally {
        await closeServer(server)
      }
    })

    it('keeps a moved file and leaves no tmp-* leftover', async () => {
      const dest = path.join(metadataDir, 'moved.txt')
      const app = express()
      app.use((req, res, next) => {
        req.user = { canUpload: true, username: 'uploader' }
        next()
      })
      app.post('/upload', requireUploadPermission, fileUploadParser, async (req, res) => {
        await req.files.f.mv(dest)
        res.sendStatus(200)
      })
      const { server, port } = await listen(app)

      try {
        const status = await sendMultipart(port, '/upload')
        expect(status).to.equal(200)
        expect(fs.readFileSync(dest, 'utf8')).to.equal('probe')
        await waitFor(() => listTmpFiles(tmpDir).length === 0)
      } finally {
        await closeServer(server)
      }
    })
  })
})
