const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const hash = require('crypto').createHash('md5')

/**
 * Generate MD5 hash from file content by sampling multiple chunks
 * See: https://github.com/koreader/koreader/blob/master/frontend/util.lua#L1102
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} MD5 hash of file content
 */
function generateFileHash(filepath) {
  if (!filepath) return null

  try {
    const fd = fs.openSync(filepath, 'r')
    const step = 1024
    const size = 1024
    const hash = crypto.createHash('md5')

    try {
      for (let i = -1; i <= 10; i++) {
        const position = step << (2 * i)
        const buffer = Buffer.alloc(size)

        try {
          const bytesRead = fs.readSync(fd, buffer, 0, size, position)
          if (bytesRead > 0) {
            hash.update(buffer.subarray(0, bytesRead))
          } else {
            break
          }
        } catch (err) {
          break
        }
      }

      return hash.digest('hex')
    } finally {
      fs.closeSync(fd)
    }
  } catch (err) {
    return null
  }
}

/**
 * Generate MD5 hash from filename
 * @param {string} filename - The filename (without path)
 * @returns {string} MD5 hash of filename
 */
function generateFilenameHash(filename) {
  return crypto.createHash('md5').update(filename).digest('hex')
}

/**
 * Generate both file content and filename hashes for a book
 * @param {string} ebookFilePath - Path to the ebook file
 * @returns {Promise<{fileHash: string, filenameHash: string}>}
 */
async function generateBookHashes(ebookFilePath) {
  const filename = path.basename(ebookFilePath)

  const [fileHash, filenameHash] = await Promise.all([generateFileHash(ebookFilePath), Promise.resolve(generateFilenameHash(filename))])

  return {
    fileHash,
    filenameHash
  }
}

module.exports = {
  generateFileHash,
  generateFilenameHash,
  generateBookHashes
}
