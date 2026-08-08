const Path = require('path')
const { pipeline } = require('stream/promises')

const fs = require('../libs/fsExtra')

const ID_PATTERN = /^[a-f0-9]{8,64}$/

class ResumableUploadManager {
  constructor() {
    this.locks = new Map()
  }

  getRootDirectory() {
    return Path.join(global.MetadataPath, 'tmp', 'resumable')
  }

  validateId(id) {
    return typeof id === 'string' && ID_PATTERN.test(id)
  }

  getSessionDirectory(userId, uploadId) {
    return Path.join(this.getRootDirectory(), String(userId), uploadId)
  }

  getSessionPath(userId, uploadId) {
    return Path.join(this.getSessionDirectory(userId, uploadId), 'session.json')
  }

  getPartPath(userId, uploadId, fileId) {
    return Path.join(this.getSessionDirectory(userId, uploadId), `${fileId}.part`)
  }

  async readSession(userId, uploadId) {
    if (!this.validateId(uploadId)) return null
    try {
      return JSON.parse(await fs.readFile(this.getSessionPath(userId, uploadId), 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }

  async createSession(userId, uploadId, session) {
    const directory = this.getSessionDirectory(userId, uploadId)
    await fs.ensureDir(directory)
    await fs.writeFile(this.getSessionPath(userId, uploadId), JSON.stringify(session, null, 2))
  }

  async getOffsets(userId, uploadId, files) {
    return Promise.all(files.map(async (file) => {
      try {
        const stat = await fs.stat(this.getPartPath(userId, uploadId, file.id))
        return Math.min(stat.size, file.size)
      } catch (error) {
        if (error.code === 'ENOENT') return 0
        throw error
      }
    }))
  }

  async withLock(key, operation) {
    const previous = this.locks.get(key) || Promise.resolve()
    const current = previous.catch(() => {}).then(operation)
    this.locks.set(key, current)
    try {
      return await current
    } finally {
      if (this.locks.get(key) === current) this.locks.delete(key)
    }
  }

  async appendChunk(userId, uploadId, file, offset, request) {
    const lockKey = `${userId}:${uploadId}:${file.id}`
    return this.withLock(lockKey, () => this._appendChunk(userId, uploadId, file, offset, request))
  }

  async _appendChunk(userId, uploadId, file, offset, request) {
    const partPath = this.getPartPath(userId, uploadId, file.id)
    await fs.ensureFile(partPath)
    const stat = await fs.stat(partPath)
    if (stat.size !== offset) {
      const error = new Error('Upload offset does not match server offset')
      error.code = 'OFFSET_MISMATCH'
      error.offset = stat.size
      throw error
    }

    const contentLength = Number(request.headers['content-length'])
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || offset + contentLength > file.size) {
      const error = new Error('Invalid chunk size')
      error.code = 'INVALID_CHUNK'
      throw error
    }

    const output = fs.createWriteStream(partPath, { flags: 'r+', start: offset })
    await pipeline(request, output)
    const completedSize = (await fs.stat(partPath)).size
    if (completedSize !== offset + contentLength) {
      const error = new Error('Uploaded chunk size does not match Content-Length')
      error.code = 'INVALID_CHUNK'
      throw error
    }
    return completedSize
  }

  async removeSession(userId, uploadId) {
    await fs.remove(this.getSessionDirectory(userId, uploadId))
  }
}

module.exports = new ResumableUploadManager()
