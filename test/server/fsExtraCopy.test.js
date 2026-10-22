const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('graceful-fs')
const os = require('os')
const path = require('path')
const fsExtra = require('../../server/libs/fsExtra')

describe('fsExtra copy fallback', () => {
  let dir
  let source
  let dest
  let contents

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abs-copy-'))
    source = path.join(dir, 'source')
    dest = path.join(dir, 'dest')
    contents = Buffer.alloc(2 * 1024 * 1024 + 17, 0x61)
    fs.writeFileSync(source, contents)
  })

  afterEach(() => {
    sinon.restore()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('copies through streams when asynchronous copyFile is denied', async () => {
    sinon.stub(fs, 'copyFile').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('copyfile denied'), { code: 'EPERM' }))
    })

    await fsExtra.copy(source, dest)

    expect(fs.readFileSync(dest).equals(contents)).to.be.true
  })

  it('moves across devices when asynchronous copyFile is denied', async () => {
    sinon.stub(fs, 'rename').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('cross-device link'), { code: 'EXDEV' }))
    })
    sinon.stub(fs, 'copyFile').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('copyfile denied'), { code: 'EPERM' }))
    })

    await fsExtra.move(source, dest)

    expect(fs.existsSync(source)).to.be.false
    expect(fs.readFileSync(dest).equals(contents)).to.be.true
  })

  it('moves over an existing file when asynchronous rename and copyFile are denied', async () => {
    fs.writeFileSync(dest, 'old database')
    sinon.stub(fs, 'rename').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('rename denied'), { code: 'EPERM' }))
    })
    sinon.stub(fs, 'copyFile').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('copyfile denied'), { code: 'EPERM' }))
    })

    await fsExtra.move(source, dest, { overwrite: true })

    expect(fs.existsSync(source)).to.be.false
    expect(fs.readFileSync(dest).equals(contents)).to.be.true
  })

  it('keeps the source when a move cannot copy it', async () => {
    sinon.stub(fs, 'rename').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('rename denied'), { code: 'EPERM' }))
    })
    sinon.stub(fs, 'copyFile').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('read failed'), { code: 'EIO' }))
    })

    try {
      await fsExtra.move(source, dest)
      expect.fail('Expected move to fail')
    } catch (error) {
      expect(error.code).to.equal('EIO')
    }
    expect(fs.readFileSync(source).equals(contents)).to.be.true
  })

  it('propagates unrelated copy errors', async () => {
    sinon.stub(fs, 'copyFile').callsFake((src, target, callback) => {
      callback(Object.assign(new Error('file missing'), { code: 'ENOENT' }))
    })

    try {
      await fsExtra.copy(source, dest)
      expect.fail('Expected copy to fail')
    } catch (error) {
      expect(error.code).to.equal('ENOENT')
    }
    expect(fs.existsSync(dest)).to.be.false
  })
})
