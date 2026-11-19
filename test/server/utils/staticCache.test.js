const { expect } = require('chai')
const express = require('express')
const http = require('http')
const fs = require('fs')
const os = require('os')
const Path = require('path')

const { setStaticHeaders } = require('../../../server/utils/staticCache')

describe('staticCache', function () {
  let distPath
  let server
  let port

  before(async function () {
    distPath = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-static-'))
    fs.mkdirSync(Path.join(distPath, '_nuxt'))
    fs.writeFileSync(Path.join(distPath, 'index.html'), '<html></html>')
    fs.writeFileSync(Path.join(distPath, '_nuxt', '0201292.js'), '//')
    fs.writeFileSync(Path.join(distPath, '_nuxt', 'LICENSES'), 'x')
    const app = express()
    app.use(express.static(distPath, { setHeaders: setStaticHeaders(distPath) }))
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = server.address().port
  })

  after(function () {
    server.close()
    fs.rmSync(distPath, { recursive: true, force: true })
  })

  function cacheControl(path) {
    return new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path }, (res) => {
        res.resume()
        resolve(res.headers['cache-control'])
      }).on('error', reject)
    })
  }

  it('marks hashed _nuxt files immutable', async function () {
    expect(await cacheControl('/_nuxt/0201292.js')).to.equal('public, max-age=31536000, immutable')
  })

  it('leaves index.html and unhashed _nuxt files on the default headers', async function () {
    expect(await cacheControl('/index.html')).to.equal('public, max-age=0')
    expect(await cacheControl('/_nuxt/LICENSES')).to.equal('public, max-age=0')
  })
})
