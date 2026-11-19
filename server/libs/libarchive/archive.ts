/**
 * Modified from https://github.com/nika-begiashvili/libarchivejs
 */

import Path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { ArchiveEntry, ArchiveInput, ArchiveRequest, ArchiveResponse, ExtractedEntry } from './protocol'

interface ArchiveDirectory {
    [name: string]: ArchiveDirectory | ArchiveEntry | CompressedFile | null
}

type WorkerMessage = ArchiveResponse | null | undefined
type Reject = (reason: unknown) => void
type Resolve<Value> = (value: Value | PromiseLike<Value>) => void
type Reply<Value> = (resolve: Resolve<Value>, reject: Reject, msg: ArchiveResponse) => boolean | void

/**
 * Represents compressed file before extraction
 */
class CompressedFile {
    declare _name: string
    declare _size: number
    declare _path: string
    declare _archiveRef: Archive

    constructor(name: string, size: number, path: string, archiveRef: Archive) {
        this._name = name
        this._size = size
        this._path = path
        this._archiveRef = archiveRef
    }

    /**
     * file name
     */
    get name() {
        return this._name
    }
    /**
     * file size
     */
    get size() {
        return this._size
    }

    /**
     * Extract file from archive
     * @returns {Promise<File>} extracted file
     */
    extract() {
        return this._archiveRef.extractSingleFile(this._path)
    }

}

class Archive {
    declare _worker: Worker | null
    declare _callbacks: ((msg: WorkerMessage) => boolean | void)[]
    declare _content: ArchiveDirectory
    declare _processed: number
    declare _file: ArchiveInput

    /**
     * Creates new archive instance from browser native File object
     * @param {Buffer} fileBuffer
     * @param {object} options
     * @returns {Archive}
     */
    static open(fileBuffer: ArchiveInput) {
        const arch = new Archive(fileBuffer, { workerUrl: Path.join(__dirname, 'libarchiveWorker.js') })
        return arch.open()
    }

    /**
     * Create new archive
     * @param {File} file 
     * @param {Object} options 
     */
    constructor(file: ArchiveInput, options: { workerUrl: string }) {
        this._worker = new Worker(options.workerUrl)
        this._worker.on('message', this._workerMsg.bind(this))

        this._callbacks = []
        this._content = {}
        this._processed = 0
        this._file = file
    }

    /**
     * Prepares file for reading
     * @returns {Promise<Archive>} archive instance
     */
    async open() {
        await this._postMessage<void>({ type: 'HELLO' }, (resolve, _reject, msg) => {
            if (msg.type === 'READY') {
                resolve()
            }
        })
        return await this._postMessage<Archive>({ type: 'OPEN', file: this._file }, (resolve, _reject, msg) => {
            if (msg.type === 'OPENED') {
                resolve(this)
            }
        })
    }

    /**
     * Terminate worker to free up memory
     */
    close() {
        void this._worker!.terminate()
        this._worker = null
    }

    /**
     * detect if archive has encrypted data
     * @returns {boolean|null} null if could not be determined
     */
    hasEncryptedData() {
        return this._postMessage<boolean | null>({ type: 'CHECK_ENCRYPTION' },
            (resolve, _reject, msg) => {
                if (msg.type === 'ENCRYPTION_STATUS') {
                    resolve(msg.status)
                }
            }
        )
    }

    /**
     * set password to be used when reading archive
     */
    usePassword(archivePassword: string | null) {
        return this._postMessage<boolean>({ type: 'SET_PASSPHRASE', passphrase: archivePassword },
            (resolve, _reject, msg) => {
                if (msg.type === 'PASSPHRASE_STATUS') {
                    resolve(msg.status)
                }
            }
        )
    }

    /**
     * Returns object containing directory structure and file information 
     * @returns {Promise<object>}
     */
    getFilesObject() {
        if (this._processed > 0) {
            return Promise.resolve().then(() => this._content)
        }
        return this._postMessage<ArchiveDirectory>({ type: 'LIST_FILES' }, (resolve, _reject, msg) => {
            if (msg.type === 'ENTRY') {
                const entry = msg.entry
                const [target, prop] = this._getProp(this._content, entry.path)
                if (entry.type === 'FILE') {
                    target![prop] = new CompressedFile(entry.fileName!, entry.size, entry.path, this)
                }
                return true
            } else if (msg.type === 'END') {
                this._processed = 1
                resolve(this._cloneContent(this._content))
            }
        })
    }

    getFilesArray() {
        return this.getFilesObject().then((obj) => {
            return this._objectToArray(obj)
        })
    }

    extractSingleFile(target: string) {
        // Prevent extraction if worker already terminated
        if (this._worker === null) {
            throw new Error("Archive already closed")
        }

        return this._postMessage<ExtractedEntry>({ type: 'EXTRACT_SINGLE_FILE', target: target },
            (resolve, _reject, msg) => {
                if (msg.type === 'FILE') {
                    resolve(msg.entry)
                }
            }
        )
    }

    /**
     * Returns object containing directory structure and extracted File objects 
     * @param {Function} extractCallback
     * 
     */
    extractFiles(extractCallback?: (result: { file: ArchiveEntry; path: string }) => void) {
        if (this._processed > 1) {
            return Promise.resolve().then(() => this._content)
        }
        return this._postMessage<ArchiveDirectory>({ type: 'EXTRACT_FILES' }, (resolve, _reject, msg) => {
            if (msg.type === 'ENTRY') {
                const [target, prop] = this._getProp(this._content, msg.entry.path)
                if (msg.entry.type === 'FILE') {
                    target![prop] = msg.entry
                    if (extractCallback !== undefined) {
                        setTimeout(extractCallback.bind(null, {
                            file: target![prop],
                            path: msg.entry.path,
                        }))
                    }
                }
                return true
            } else if (msg.type === 'END') {
                this._processed = 2
                void this._worker!.terminate()
                resolve(this._cloneContent(this._content))
            }
        })
    }

    _cloneContent(obj: ArchiveDirectory): ArchiveDirectory
    _cloneContent(obj: unknown): unknown
    _cloneContent(obj: unknown): unknown {
        if (obj instanceof CompressedFile || obj === null) return obj
        const o: Record<string, unknown> = {}
        const source = obj as Record<string, unknown>
        for (const prop of Object.keys(source)) {
            o[prop] = this._cloneContent(source[prop])
        }
        return o
    }

    _objectToArray(obj: ArchiveDirectory, path = '') {
        const files: { file: CompressedFile | string; path: string }[] = []
        for (const key of Object.keys(obj)) {
            const child = obj[key]
            if (child instanceof CompressedFile || child === null) {
                files.push({
                    file: child || key,
                    path: path
                })
            } else {
                files.push(...this._objectToArray(child as ArchiveDirectory, `${path}${key}/`))
            }
        }
        return files
    }

    _getProp(obj: ArchiveDirectory, path: string): [ArchiveDirectory | null, string] {
        const parts = path.split('/')
        if (parts[parts.length - 1] === '') parts.pop()
        let cur = obj, prev = null
        for (const part of parts) {
            cur[part] = cur[part] || {}
            prev = cur
            cur = cur[part] as ArchiveDirectory
        }
        return [prev, parts[parts.length - 1]]
    }

    _postMessage<Value>(msg: ArchiveRequest, callback: Reply<Value>) {
        this._worker!.postMessage(msg)
        return new Promise<Value>((resolve, reject) => {
            this._callbacks.push(this._msgHandler.bind(this, callback as Reply<unknown>, resolve as Resolve<unknown>, reject))
        })
    }

    _msgHandler<Value>(callback: Reply<Value>, resolve: Resolve<Value>, reject: Reject, msg: WorkerMessage) {
        if (!msg) {
            reject('invalid msg')
            return
        }
        if (msg.type === 'BUSY') {
            reject('worker is busy')
        } else if (msg.type === 'ERROR') {
            reject(msg.error)
        } else {
            return callback(resolve, reject, msg)
        }
    }

    _workerMsg(msg: WorkerMessage) {
        const callback = this._callbacks[this._callbacks.length - 1]
        const next = callback(msg)
        if (!next) {
            this._callbacks.pop()
        }
    }

}
export = Archive
