/**
 * Modified from https://github.com/nika-begiashvili/libarchivejs
 */

const { parentPort } = require('worker_threads')
const { getArchiveReader } = require('./wasm-module')

let reader = null
let busy = false

getArchiveReader((_reader) => {
  reader = _reader
  busy = false
  parentPort.postMessage({ type: 'READY' })
})

parentPort.on('message', async msg => {
  if (busy) {
    parentPort.postMessage({ type: 'BUSY' })
    return
  }

  let skipExtraction = false
  busy = true
  try {
    switch (msg.type) {
      case 'HELLO': // module will respond READY when it's ready
        break
      case 'OPEN':
        await reader.open(msg.file)
        parentPort.postMessage({ type: 'OPENED' })
        break
      case 'LIST_FILES':
        skipExtraction = true
      // eslint-disable-next-line no-fallthrough
      case 'EXTRACT_FILES':
        for (const entry of reader.entries(skipExtraction)) {
          parentPort.postMessage({ type: 'ENTRY', entry })
        }
        parentPort.postMessage({ type: 'END' })
        break
      case 'EXTRACT_SINGLE_FILE':
        for (const entry of reader.entries(true, msg.target)) {
          if (entry.fileData) {
            parentPort.postMessage({ type: 'FILE', entry })
          }
        }
        break
      case 'CHECK_ENCRYPTION':
        parentPort.postMessage({ type: 'ENCRYPTION_STATUS', status: reader.hasEncryptedData() })
        break
      case 'SET_PASSPHRASE':
        reader.setPassphrase(msg.passphrase)
        parentPort.postMessage({ type: 'PASSPHRASE_STATUS', status: true })
        break
      default:
        throw new Error('Invalid Command')
    }
  } catch (err) {
    parentPort.postMessage({
      type: 'ERROR',
      error: {
        message: err.message,
        name: err.name,
        stack: err.stack
      }
    })
  } finally {
    // eslint-disable-next-line require-atomic-updates
    busy = false
  }
})
