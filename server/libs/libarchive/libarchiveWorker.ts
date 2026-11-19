/**
 * Modified from https://github.com/nika-begiashvili/libarchivejs
 */

import { parentPort } from 'node:worker_threads'
import type { ArchiveRequest, ArchiveResponse } from './protocol'
import archiveModule from './wasm-module'

const { getArchiveReader } = archiveModule
const port = parentPort!
const postMessage = (message: ArchiveResponse) => port.postMessage(message)

let reader: Parameters<Parameters<typeof getArchiveReader>[0]>[0] | null = null
let busy = false

getArchiveReader((_reader) => {
  reader = _reader
  busy = false
  postMessage({ type: 'READY' })
})

const onMessage: (msg: ArchiveRequest) => unknown = async (msg) => {
  if (busy) {
    postMessage({ type: 'BUSY' })
    return
  }

  busy = true
  try {
    switch (msg.type) {
      case 'HELLO': // module will respond READY when it's ready
        break
      case 'OPEN':
        await reader!.open(msg.file)
        postMessage({ type: 'OPENED' })
        break
      case 'LIST_FILES':
      case 'EXTRACT_FILES':
        for (const entry of reader!.entries(msg.type === 'LIST_FILES')) {
          postMessage({ type: 'ENTRY', entry })
        }
        postMessage({ type: 'END' })
        break
      case 'EXTRACT_SINGLE_FILE':
        for (const entry of reader!.entries(true, msg.target)) {
          if (entry.fileData) {
            postMessage({ type: 'FILE', entry })
          }
        }
        break
      case 'CHECK_ENCRYPTION':
        postMessage({ type: 'ENCRYPTION_STATUS', status: reader!.hasEncryptedData() })
        break
      case 'SET_PASSPHRASE':
        reader!.setPassphrase(msg.passphrase)
        postMessage({ type: 'PASSPHRASE_STATUS', status: true })
        break
      default:
        throw new Error('Invalid Command')
    }
  } catch (reason) {
    const err = reason as Error
    postMessage({
      type: 'ERROR',
      error: {
        message: err.message,
        name: err.name,
        stack: err.stack
      }
    })
  } finally {
    busy = false
  }
}

port.on('message', onMessage)
