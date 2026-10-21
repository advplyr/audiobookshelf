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

  it('copies in chunks when synchronous copyFile is denied', () => {
    sinon.stub(fs, 'copyFileSync').throws(Object.assign(new Error('copyfile denied'), { code: 'EPERM' }))

    fsExtra.copySync(source, dest)

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

  it('moves across devices when synchronous copyFile is denied', () => {
    sinon.stub(fs, 'renameSync').throws(Object.assign(new Error('cross-device link'), { code: 'EXDEV' }))
    sinon.stub(fs, 'copyFileSync').throws(Object.assign(new Error('copyfile denied'), { code: 'EPERM' }))

    fsExtra.moveSync(source, dest)

    expect(fs.existsSync(source)).to.be.false
    expect(fs.readFileSync(dest).equals(contents)).to.be.true
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
