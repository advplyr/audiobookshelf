/**
 * Modified from https://github.com/nika-begiashvili/libarchivejs
 */

const Path = require('path')
const libarchive = require('./wasm-libarchive')

const TYPE_MAP = {
  32768: 'FILE',
  16384: 'DIR',
  40960: 'SYMBOLIC_LINK',
  49152: 'SOCKET',
  8192: 'CHARACTER_DEVICE',
  24576: 'BLOCK_DEVICE',
  4096: 'NAMED_PIPE',
}

class ArchiveReader {
  /**
   * archive reader
   * @param {WasmModule} wasmModule emscripten module 
   */
  constructor(wasmModule) {
    this._wasmModule = wasmModule
    this._runCode = wasmModule.runCode
    this._file = null
    this._passphrase = null
  }

  /**
   * open archive, needs to closed manually
   * @param {File} file 
   */
  open(file) {
    if (this._file !== null) {
      console.warn('Closing previous file')
      this.close()
    }
    const { promise, resolve, reject } = this._promiseHandles()
    this._file = file
    this._loadFile(file, resolve, reject)
    return promise
  }

  /**
   * close archive
   */
  close() {
    this._runCode.closeArchive(this._archive)
    this._wasmModule._free(this._filePtr)
    this._file = null
    this._filePtr = null
    this._archive = null
  }

  /**
   * detect if archive has encrypted data
   * @returns {boolean|null} null if could not be determined
   */
  hasEncryptedData() {
    this._archive = this._runCode.openArchive(this._filePtr, this._fileLength, this._passphrase)
    this._runCode.getNextEntry(this._archive)
    const status = this._runCode.hasEncryptedEntries(this._archive)
    if (status === 0) {
      return false
    } else if (status > 0) {
      return true
    } else {
      return null
    }
  }

  /**
   * set passphrase to be used with archive
   * @param {*} passphrase 
   */
  setPassphrase(passphrase) {
    this._passphrase = passphrase
  }

  /**
   * get archive entries
   * @param {boolean} skipExtraction
   * @param {string} except don't skip this entry
   */
  *entries(skipExtraction = false, except = null) {
    this._archive = this._runCode.openArchive(this._filePtr, this._fileLength, this._passphrase)
    let entry
    while (true) {
      entry = this._runCode.getNextEntry(this._archive)
      if (entry === 0) break

      const entryData = {
        size: this._runCode.getEntrySize(entry),
        path: this._runCode.getEntryName(entry),
        type: TYPE_MAP[this._runCode.getEntryType(entry)],
        ref: entry,
      }

      if (entryData.type === 'FILE') {
        let fileName = entryData.path.split('/')
        entryData.fileName = fileName[fileName.length - 1]
      }

      if (skipExtraction && except !== entryData.path) {
        this._runCode.skipEntry(this._archive)
      } else {
        const ptr = this._runCode.getFileData(this._archive, entryData.size)
        if (ptr < 0) {
          throw new Error(this._runCode.getError(this._archive))
        }
        entryData.fileData = this._wasmModule.HEAP8.slice(ptr, ptr + entryData.size)
        this._wasmModule._free(ptr)
      }
      yield entryData
    }
  }

  _loadFile(fileBuffer, resolve, reject) {
    try {
      const array = new Uint8Array(fileBuffer)
      this._fileLength = array.length
      this._filePtr = this._runCode.malloc(this._fileLength)
      this._wasmModule.HEAP8.set(array, this._filePtr)
      resolve()
    } catch (error) {
      reject(error)
    }
  }

  _promiseHandles() {
    let resolve = null, reject = null
    const promise = new Promise((_resolve, _reject) => {
      resolve = _resolve
      reject = _reject
    })
    return { promise, resolve, reject }
  }

}

class WasmModule {
  constructor() {
    this.preRun = []
    this.postRun = []
    this.totalDependencies = 0
  }

  print(...text) {
    console.log(text)
  }

  printErr(...text) {
    console.error(text)
  }

  initFunctions() {
    this.runCode = {
      // const char * get_version()
      getVersion: this.cwrap('get_version', 'string', []),
      // void * archive_open( const void * buffer, size_t buffer_size)
      // retuns archive pointer
      openArchive: this.cwrap('archive_open', 'number', ['number', 'number', 'string']),
      // void * get_entry(void * archive)
      // return archive entry pointer
      getNextEntry: this.cwrap('get_next_entry', 'number', ['number']),
      // void * get_filedata( void * archive, size_t bufferSize )
      getFileData: this.cwrap('get_filedata', 'number', ['number', 'number']),
      // int archive_read_data_skip(struct archive *_a)
      skipEntry: this.cwrap('archive_read_data_skip', 'number', ['number']),
      // void archive_close( void * archive )
      closeArchive: this.cwrap('archive_close', null, ['number']),
      // la_int64_t archive_entry_size( struct archive_entry * )
      getEntrySize: this.cwrap('archive_entry_size', 'number', ['number']),
      // const char * archive_entry_pathname( struct archive_entry * )
      getEntryName: this.cwrap('archive_entry_pathname', 'string', ['number']),
      // __LA_MODE_T archive_entry_filetype( struct archive_entry * )
      /*
      #define AE_IFMT		((__LA_MODE_T)0170000)
      #define AE_IFREG	((__LA_MODE_T)0100000) // Regular file
      #define AE_IFLNK	((__LA_MODE_T)0120000) // Sybolic link
      #define AE_IFSOCK	((__LA_MODE_T)0140000) // Socket
      #define AE_IFCHR	((__LA_MODE_T)0020000) // Character device
      #define AE_IFBLK	((__LA_MODE_T)0060000) // Block device
      #define AE_IFDIR	((__LA_MODE_T)0040000) // Directory
      #define AE_IFIFO	((__LA_MODE_T)0010000) // Named pipe
      */
      getEntryType: this.cwrap('archive_entry_filetype', 'number', ['number']),
      // const char * archive_error_string(struct archive *); 
      getError: this.cwrap('archive_error_string', 'string', ['number']),

      /*
      * Returns 1 if the archive contains at least one encrypted entry.
      * If the archive format not support encryption at all
      * ARCHIVE_READ_FORMAT_ENCRYPTION_UNSUPPORTED is returned.
      * If for any other reason (e.g. not enough data read so far)
      * we cannot say whether there are encrypted entries, then
      * ARCHIVE_READ_FORMAT_ENCRYPTION_DONT_KNOW is returned.
      * In general, this function will return values below zero when the
      * reader is uncertain or totally incapable of encryption support.
      * When this function returns 0 you can be sure that the reader
      * supports encryption detection but no encrypted entries have
      * been found yet.
      *
      * NOTE: If the metadata/header of an archive is also encrypted, you
      * cannot rely on the number of encrypted entries. That is why this
      * function does not return the number of encrypted entries but#
      * just shows that there are some.
      */
      // __LA_DECL int	archive_read_has_encrypted_entries(struct archive *);
      entryIsEncrypted: this.cwrap('archive_entry_is_encrypted', 'number', ['number']),
      hasEncryptedEntries: this.cwrap('archive_read_has_encrypted_entries', 'number', ['number']),
      // __LA_DECL int archive_read_add_passphrase(struct archive *, const char *);
      addPassphrase: this.cwrap('archive_read_add_passphrase', 'number', ['number', 'string']),
      //this.stringToUTF(str), //
      string: (str) => this.allocate(this.intArrayFromString(str), 'i8', 0),
      malloc: this.cwrap('malloc', 'number', ['number']),
      free: this.cwrap('free', null, ['number']),
    }
  }

  monitorRunDependencies() { }

  locateFile(path /* ,prefix */) {
    const wasmFilepath = Path.join(__dirname, `../../../client/dist/libarchive/wasm-gen/${path}`)
    return wasmFilepath
  }
}

module.exports.getArchiveReader = (cb) => {
  libarchive(new WasmModule()).then((module) => {
    module.initFunctions()
    cb(new ArchiveReader(module))
  })
}