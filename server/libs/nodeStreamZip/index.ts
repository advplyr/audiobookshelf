/**
 * @license node-stream-zip | (c) 2020 Antelle | https://github.com/antelle/node-stream-zip/blob/master/LICENSE
 * Portions copyright https://github.com/cthackers/adm-zip | https://raw.githubusercontent.com/cthackers/adm-zip/master/LICENSE
 */

import nodeFs from 'node:fs';
import util from 'node:util';
import path from 'node:path';
import events from 'node:events';
import zlib from 'node:zlib';
import stream from 'node:stream';

type FileSystem = Pick<typeof nodeFs, 'open' | 'fstat' | 'read' | 'readSync' | 'close' | 'createWriteStream' | 'mkdir' | 'stat'>;
let fs: FileSystem = nodeFs;

interface ZipConfig {
  file?: string
  fd?: number
  storeEntries?: boolean
  chunkSize?: number
  nameEncoding?: string
  skipEntryNameValidation?: boolean
}

type ArchiveEntries = Record<string, ZipEntry>;
type EntryInput = string | ZipEntry;
type ZipError = Error | null | undefined;
type Completion = (error?: ZipError) => void;
type ReadCallback = (error: ZipError, bytesRead: number) => void;
type ExtractCallback = (error?: ZipError, count?: number) => void;
type OpenEntryCallback = (...result: [error: Error, entry?: ZipEntry] | [error: undefined, entry: ZipEntry]) => void;
type StreamCallback = (...result: [error: Error] | [error: null, data: stream.Readable]) => void;

interface ZipInstance extends Omit<events.EventEmitter, 'emit'> {
  readonly ready: boolean
  comment: string | null
  entriesCount: number
  centralDirectory: CentralDirectoryHeader
  entry(name: string): ZipEntry | undefined
  entries(): ArchiveEntries
  stream(entry: EntryInput, callback: StreamCallback): void
  entryDataSync(entry: EntryInput): Buffer
  openEntry(entry: EntryInput, callback: OpenEntryCallback, sync?: boolean): void
  extract(entry: EntryInput | null | undefined, outPath: string, callback: ExtractCallback): void
  close(callback?: Completion): void
  emit(event: string | symbol, ...args: unknown[]): boolean | undefined
}

interface ZipConstructor {
  new (config: ZipConfig): ZipInstance
  async: typeof StreamZipAsync
  debug?: boolean
  debugLog(...args: unknown[]): void
  setFs(customFs: FileSystem): void
}

interface DirectorySearch {
  win: FileWindowBuffer
  totalReadLength: number
  minPos: number
  lastPos: number
  chunkSize: number
  firstByte: number
  sig: number
  complete(): void
  lastBufferPosition?: number
  lastBytesRead?: number
}

interface EntriesRead {
  win: FileWindowBuffer
  pos: number
  chunkSize: number
  entriesLeft: number
  entry?: ZipEntry | null
  move?: boolean
}

const consts = {
  /* The local file header */
  LOCHDR: 30, // LOC header size
  LOCSIG: 0x04034b50, // "PK\003\004"
  LOCVER: 4, // version needed to extract
  LOCFLG: 6, // general purpose bit flag
  LOCHOW: 8, // compression method
  LOCTIM: 10, // modification time (2 bytes time, 2 bytes date)
  LOCCRC: 14, // uncompressed file crc-32 value
  LOCSIZ: 18, // compressed size
  LOCLEN: 22, // uncompressed size
  LOCNAM: 26, // filename length
  LOCEXT: 28, // extra field length

  /* The Data descriptor */
  EXTSIG: 0x08074b50, // "PK\007\008"
  EXTHDR: 16, // EXT header size
  EXTCRC: 4, // uncompressed file crc-32 value
  EXTSIZ: 8, // compressed size
  EXTLEN: 12, // uncompressed size

  /* The central directory file header */
  CENHDR: 46, // CEN header size
  CENSIG: 0x02014b50, // "PK\001\002"
  CENVEM: 4, // version made by
  CENVER: 6, // version needed to extract
  CENFLG: 8, // encrypt, decrypt flags
  CENHOW: 10, // compression method
  CENTIM: 12, // modification time (2 bytes time, 2 bytes date)
  CENCRC: 16, // uncompressed file crc-32 value
  CENSIZ: 20, // compressed size
  CENLEN: 24, // uncompressed size
  CENNAM: 28, // filename length
  CENEXT: 30, // extra field length
  CENCOM: 32, // file comment length
  CENDSK: 34, // volume number start
  CENATT: 36, // internal file attributes
  CENATX: 38, // external file attributes (host system dependent)
  CENOFF: 42, // LOC header offset

  /* The entries in the end of central directory */
  ENDHDR: 22, // END header size
  ENDSIG: 0x06054b50, // "PK\005\006"
  ENDSIGFIRST: 0x50,
  ENDSUB: 8, // number of entries on this disk
  ENDTOT: 10, // total number of entries
  ENDSIZ: 12, // central directory size in bytes
  ENDOFF: 16, // offset of first CEN header
  ENDCOM: 20, // zip file comment length
  MAXFILECOMMENT: 0xffff,

  /* The entries in the end of ZIP64 central directory locator */
  ENDL64HDR: 20, // ZIP64 end of central directory locator header size
  ENDL64SIG: 0x07064b50, // ZIP64 end of central directory locator signature
  ENDL64SIGFIRST: 0x50,
  ENDL64OFS: 8, // ZIP64 end of central directory offset

  /* The entries in the end of ZIP64 central directory */
  END64HDR: 56, // ZIP64 end of central directory header size
  END64SIG: 0x06064b50, // ZIP64 end of central directory signature
  END64SIGFIRST: 0x50,
  END64SUB: 24, // number of entries on this disk
  END64TOT: 32, // total number of entries
  END64SIZ: 40,
  END64OFF: 48,

  /* Compression methods */
  STORED: 0, // no compression
  SHRUNK: 1, // shrunk
  REDUCED1: 2, // reduced with compression factor 1
  REDUCED2: 3, // reduced with compression factor 2
  REDUCED3: 4, // reduced with compression factor 3
  REDUCED4: 5, // reduced with compression factor 4
  IMPLODED: 6, // imploded
  // 7 reserved
  DEFLATED: 8, // deflated
  ENHANCED_DEFLATED: 9, // deflate64
  PKWARE: 10, // PKWare DCL imploded
  // 11 reserved
  BZIP2: 12, //  compressed using BZIP2
  // 13 reserved
  LZMA: 14, // LZMA
  // 15-17 reserved
  IBM_TERSE: 18, // compressed using IBM TERSE
  IBM_LZ77: 19, //IBM LZ77 z

  /* General purpose bit flag */
  FLG_ENC: 0, // encrypted file
  FLG_COMP1: 1, // compression option
  FLG_COMP2: 2, // compression option
  FLG_DESC: 4, // data descriptor
  FLG_ENH: 8, // enhanced deflation
  FLG_STR: 16, // strong encryption
  FLG_LNG: 1024, // language encoding
  FLG_MSK: 4096, // mask header values
  FLG_ENTRY_ENC: 1,

  /* 4.5 Extensible data fields */
  EF_ID: 0,
  EF_SIZE: 2,

  /* Header IDs */
  ID_ZIP64: 0x0001,
  ID_AVINFO: 0x0007,
  ID_PFS: 0x0008,
  ID_OS2: 0x0009,
  ID_NTFS: 0x000a,
  ID_OPENVMS: 0x000c,
  ID_UNIX: 0x000d,
  ID_FORK: 0x000e,
  ID_PATCH: 0x000f,
  ID_X509_PKCS7: 0x0014,
  ID_X509_CERTID_F: 0x0015,
  ID_X509_CERTID_C: 0x0016,
  ID_STRONGENC: 0x0017,
  ID_RECORD_MGT: 0x0018,
  ID_X509_PKCS7_RL: 0x0019,
  ID_IBM1: 0x0065,
  ID_IBM2: 0x0066,
  ID_POSZIP: 0x4690,

  EF_ZIP64_OR_32: 0xffffffff,
  EF_ZIP64_OR_16: 0xffff,
};

function initializeZip(that: ZipInstance, config: ZipConfig) {
  let fd: number | null;
  let fileSize: number;
  let chunkSize: number;
  let directorySearch: DirectorySearch | undefined;
  let entryRead: EntriesRead;
  let centralDirectory: CentralDirectoryHeader;
  let closed: boolean | undefined;
  const ready = false,
    entries: ArchiveEntries | null = config.storeEntries !== false ? {} : null,
    fileName = config.file,
    textDecoder = config.nameEncoding ? new TextDecoder(config.nameEncoding) : null;

  open();

  function open() {
    if (config.fd) {
      fd = config.fd;
      readFile();
    } else {
      fs.open(fileName!, 'r', (err, f) => {
        if (err) {
          return that.emit('error', err);
        }
        fd = f;
        readFile();
      });
    }
  }

  function readFile() {
    fs.fstat(fd!, (err, stat) => {
      if (err) {
        return that.emit('error', err);
      }
      fileSize = stat.size;
      chunkSize = config.chunkSize || Math.round(fileSize / 1000);
      chunkSize = Math.max(
        Math.min(chunkSize, Math.min(128 * 1024, fileSize)),
        Math.min(1024, fileSize)
      );
      readCentralDirectory();
    });
  }

  function readUntilFoundCallback(err: unknown, bytesRead: number) {
    if (err || !bytesRead) {
      return that.emit('error', err || new Error('Archive read error'));
    }
    const op = directorySearch!;
    let pos = op.lastPos;
    let bufferPosition = pos - op.win.position;
    const buffer = op.win.buffer;
    const minPos = op.minPos;
    while (--pos >= minPos && --bufferPosition >= 0) {
      if (buffer.length - bufferPosition >= 4 && buffer[bufferPosition] === op.firstByte) {
        // quick check first signature byte
        if (buffer.readUInt32LE(bufferPosition) === op.sig) {
          op.lastBufferPosition = bufferPosition;
          op.lastBytesRead = bytesRead;
          op.complete();
          return;
        }
      }
    }
    if (pos === minPos) {
      return that.emit('error', new Error('Bad archive'));
    }
    op.lastPos = pos + 1;
    op.chunkSize *= 2;
    if (pos <= minPos) {
      return that.emit('error', new Error('Bad archive'));
    }
    const expandLength = Math.min(op.chunkSize, pos - minPos);
    op.win.expandLeft(expandLength, readUntilFoundCallback);
  }

  function readCentralDirectory() {
    const totalReadLength = Math.min(consts.ENDHDR + consts.MAXFILECOMMENT, fileSize);
    const op = directorySearch = {
      win: new FileWindowBuffer(fd!),
      totalReadLength,
      minPos: fileSize - totalReadLength,
      lastPos: fileSize,
      chunkSize: Math.min(1024, chunkSize),
      firstByte: consts.ENDSIGFIRST,
      sig: consts.ENDSIG,
      complete: readCentralDirectoryComplete,
    };
    op.win.read(fileSize - op.chunkSize, op.chunkSize, readUntilFoundCallback);
  }

  function readCentralDirectoryComplete() {
    const op = directorySearch!;
    const buffer = op.win.buffer;
    const pos = op.lastBufferPosition!;
    try {
      centralDirectory = new CentralDirectoryHeader();
      centralDirectory.read(buffer.slice(pos, pos + consts.ENDHDR));
      centralDirectory.headerOffset = op.win.position + pos;
      if (centralDirectory.commentLength) {
        that.comment = buffer
          .slice(
            pos + consts.ENDHDR,
            pos + consts.ENDHDR + centralDirectory.commentLength
          )
          .toString();
      } else {
        that.comment = null;
      }
      that.entriesCount = centralDirectory.volumeEntries;
      that.centralDirectory = centralDirectory;
      if (
        (centralDirectory.volumeEntries === consts.EF_ZIP64_OR_16 &&
          centralDirectory.totalEntries === consts.EF_ZIP64_OR_16) ||
        centralDirectory.size === consts.EF_ZIP64_OR_32 ||
        centralDirectory.offset === consts.EF_ZIP64_OR_32
      ) {
        readZip64CentralDirectoryLocator();
      } else {
        directorySearch = undefined;
        readEntries();
      }
    } catch (err) {
      that.emit('error', err);
    }
  }

  function readZip64CentralDirectoryLocator() {
    const op = directorySearch!;
    const length = consts.ENDL64HDR;
    if (op.lastBufferPosition! > length) {
      op.lastBufferPosition = op.lastBufferPosition! - length;
      readZip64CentralDirectoryLocatorComplete();
    } else {
      const search = directorySearch = {
        win: op.win,
        totalReadLength: length,
        minPos: op.win.position - length,
        lastPos: op.win.position,
        chunkSize: op.chunkSize,
        firstByte: consts.ENDL64SIGFIRST,
        sig: consts.ENDL64SIG,
        complete: readZip64CentralDirectoryLocatorComplete,
      };
      search.win.read(search.lastPos - search.chunkSize, search.chunkSize, readUntilFoundCallback);
    }
  }

  function readZip64CentralDirectoryLocatorComplete() {
    const op = directorySearch!;
    const buffer = op.win.buffer;
    const locHeader = new CentralDirectoryLoc64Header();
    locHeader.read(
      buffer.slice(op.lastBufferPosition, op.lastBufferPosition! + consts.ENDL64HDR)
    );
    const readLength = fileSize - locHeader.headerOffset;
    const search = directorySearch = {
      win: op.win,
      totalReadLength: readLength,
      minPos: locHeader.headerOffset,
      lastPos: op.lastPos,
      chunkSize: op.chunkSize,
      firstByte: consts.END64SIGFIRST,
      sig: consts.END64SIG,
      complete: readZip64CentralDirectoryComplete,
    };
    search.win.read(fileSize - search.chunkSize, search.chunkSize, readUntilFoundCallback);
  }

  function readZip64CentralDirectoryComplete() {
    const op = directorySearch!;
    const buffer = op.win.buffer;
    const zip64cd = new CentralDirectoryZip64Header();
    zip64cd.read(buffer.slice(op.lastBufferPosition, op.lastBufferPosition! + consts.END64HDR));
    that.centralDirectory.volumeEntries = zip64cd.volumeEntries;
    that.centralDirectory.totalEntries = zip64cd.totalEntries;
    that.centralDirectory.size = zip64cd.size;
    that.centralDirectory.offset = zip64cd.offset;
    that.entriesCount = zip64cd.volumeEntries;
    directorySearch = undefined;
    readEntries();
  }

  function readEntries() {
    const op = entryRead = {
      win: new FileWindowBuffer(fd!),
      pos: centralDirectory.offset,
      chunkSize,
      entriesLeft: centralDirectory.volumeEntries,
    };
    op.win.read(op.pos, Math.min(chunkSize, fileSize - op.pos), readEntriesCallback);
  }

  function readEntriesCallback(err: unknown, bytesRead: number) {
    if (err || !bytesRead) {
      return that.emit('error', err || new Error('Entries read error'));
    }
    const op = entryRead;
    let bufferPos = op.pos - op.win.position;
    let entry = op.entry;
    const buffer = op.win.buffer;
    const bufferLength = buffer.length;
    try {
      while (op.entriesLeft > 0) {
        if (!entry) {
          entry = new ZipEntry();
          entry.readHeader(buffer, bufferPos);
          entry.headerOffset = op.win.position + bufferPos;
          op.entry = entry;
          op.pos += consts.CENHDR;
          bufferPos += consts.CENHDR;
        }
        const entryHeaderSize = entry.fnameLen + entry.extraLen + entry.comLen;
        const advanceBytes = entryHeaderSize + (op.entriesLeft > 1 ? consts.CENHDR : 0);
        if (bufferLength - bufferPos < advanceBytes) {
          op.win.moveRight(chunkSize, readEntriesCallback, bufferPos);
          op.move = true;
          return;
        }
        entry.read(buffer, bufferPos, textDecoder);
        if (!config.skipEntryNameValidation) {
          entry.validateName();
        }
        if (entries) {
          entries[entry.name] = entry;
        }
        that.emit('entry', entry);
        op.entry = entry = null;
        op.entriesLeft--;
        op.pos += entryHeaderSize;
        bufferPos += entryHeaderSize;
      }
      that.emit('ready');
    } catch (err) {
      that.emit('error', err);
    }
  }

  function checkEntriesExist() {
    if (!entries) {
      throw new Error('storeEntries disabled');
    }
    return entries;
  }

  Object.defineProperty(that, 'ready', {
    get() {
      return ready;
    },
  });

  that.entry = function (name) {
    return checkEntriesExist()[name];
  };

  that.entries = function () {
    return checkEntriesExist();
  };

  that.stream = function (entry, callback) {
    return this.openEntry(
      entry,
      (...[err, entry]) => {
        if (err !== undefined) {
          return callback(err);
        }
        const offset = dataOffset(entry);
        let entryStream: stream.Readable = new EntryDataReaderStream(fd!, offset, entry.compressedSize);
        if (entry.method === consts.STORED) {
          // nothing to do
        } else if (entry.method === consts.DEFLATED) {
          entryStream = entryStream.pipe(zlib.createInflateRaw());
        } else {
          return callback(new Error('Unknown compression method: ' + entry.method));
        }
        if (canVerifyCrc(entry)) {
          entryStream = entryStream.pipe(
            new EntryVerifyStream(entryStream, entry.crc, entry.size)
          );
        }
        callback(null, entryStream);
      },
      false
    );
  };

  function throwIfError(error: ZipError) {
    if (error) throw error;
  }

  that.entryDataSync = function (entry) {
    const read = { error: null as ZipError };
    let openedEntry: ZipEntry | undefined;
    that.openEntry(
      entry,
      (...[e, en]) => {
        read.error = e;
        openedEntry = en;
      },
      true
    );
    throwIfError(read.error);
    const zipEntry = openedEntry!; // openEntry calls back inline in synchronous mode.
    let data: Buffer = Buffer.alloc(zipEntry.compressedSize);
    new FsRead(fd!, data, 0, zipEntry.compressedSize, dataOffset(zipEntry), (e) => {
      read.error = e;
    }).read(true);
    throwIfError(read.error);
    if (zipEntry.method === consts.STORED) {
      // nothing to do
    } else if (zipEntry.method === consts.DEFLATED || zipEntry.method === consts.ENHANCED_DEFLATED) {
      data = zlib.inflateRawSync(data);
    } else {
      throw new Error('Unknown compression method: ' + zipEntry.method);
    }
    if (data.length !== zipEntry.size) {
      throw new Error('Invalid size');
    }
    if (canVerifyCrc(zipEntry)) {
      const verify = new CrcVerify(zipEntry.crc, zipEntry.size);
      verify.data(data);
    }
    return data;
  };

  that.openEntry = function (entry, callback, sync) {
    if (typeof entry === 'string') {
      const found = checkEntriesExist()[entry];
      if (!found) {
        return callback(new Error('Entry not found'));
      }
      entry = found;
    }
    if (!entry.isFile) {
      return callback(new Error('Entry is not file'));
    }
    if (!fd) {
      return callback(new Error('Archive closed'));
    }
    const buffer = Buffer.alloc(consts.LOCHDR);
    new FsRead(fd, buffer, 0, buffer.length, entry.offset, (err) => {
      if (err) {
        return callback(err);
      }
      let readEx: Error | undefined;
      try {
        entry.readDataHeader(buffer);
        if (entry.encrypted) {
          readEx = new Error('Entry encrypted');
        }
      } catch (ex) {
        readEx = ex as Error;
      }
      if (readEx) {
        callback(readEx, entry);
      } else {
        callback(undefined, entry);
      }
    }).read(sync);
  };

  function dataOffset(entry: ZipEntry) {
    return entry.offset + consts.LOCHDR + entry.fnameLen + entry.extraLen;
  }

  function canVerifyCrc(entry: ZipEntry) {
    // if bit 3 (0x08) of the general-purpose flags field is set, then the CRC-32 and file sizes are not known when the header is written
    return (entry.flags & 0x8) !== 0x8;
  }

  function extract(entry: EntryInput, outPath: string, callback: Completion) {
    that.stream(entry, (...[err, stm]) => {
      if (err !== null) {
        callback(err);
      } else {
        let fsStm: nodeFs.WriteStream | undefined;
        let errThrown: Error | undefined;
        stm.on('error', (err) => {
          errThrown = err;
          if (fsStm) {
            stm.unpipe(fsStm);
            fsStm.close(() => {
              callback(err);
            });
          }
        });
        fs.open(outPath, 'w', (err, fdFile) => {
          if (err) {
            return callback(err);
          }
          if (errThrown) {
            fs.close(fd!, () => {
              callback(errThrown);
            });
            return;
          }
          fsStm = fs.createWriteStream(outPath, { fd: fdFile });
          fsStm.on('finish', () => {
            that.emit('extract', entry, outPath);
            if (!errThrown) {
              callback();
            }
          });
          stm.pipe(fsStm);
        });
      }
    });
  }

  function createDirectories(baseDir: string, dirs: string[][], callback: Completion) {
    if (!dirs.length) {
      return callback();
    }
    const dir = path.join(baseDir, path.join(...dirs.shift()!));
    fs.mkdir(dir, { recursive: true }, (err) => {
      if (err && err.code !== 'EEXIST') {
        return callback(err);
      }
      createDirectories(baseDir, dirs, callback);
    });
  }

  function extractFiles(baseDir: string, baseRelPath: string, files: ZipEntry[], callback: ExtractCallback, extractedCount: number) {
    if (!files.length) {
      return callback(null, extractedCount);
    }
    const file = files.shift()!;
    const targetPath = path.join(baseDir, file.name.replace(baseRelPath, ''));
    extract(file, targetPath, (err) => {
      if (err) {
        return callback(err, extractedCount);
      }
      extractFiles(baseDir, baseRelPath, files, callback, extractedCount + 1);
    });
  }

  that.extract = function (entry, outPath, callback) {
    // For a ZipEntry object, the original code uses its string coercion in directory lookups.
    let entryName = (entry || '') as string;
    if (typeof entry === 'string') {
      entry = this.entry(entry);
      if (entry) {
        entryName = entry.name;
      } else {
        if (entryName.length && entryName[entryName.length - 1] !== '/') {
          entryName += '/';
        }
      }
    }
    if (!entry || entry.isDirectory) {
      const files: ZipEntry[] = [],
        dirs: string[][] = [],
        allDirs: Record<string, boolean> = {};
      for (const e in entries) {
        if (
          Object.prototype.hasOwnProperty.call(entries, e) &&
          e.lastIndexOf(entryName, 0) === 0
        ) {
          let relPath = e.replace(entryName, '');
          const childEntry = entries[e];
          if (childEntry.isFile) {
            files.push(childEntry);
            relPath = path.dirname(relPath);
          }
          if (relPath && !allDirs[relPath] && relPath !== '.') {
            allDirs[relPath] = true;
            let parts = relPath.split('/').filter((f) => {
              return f;
            });
            if (parts.length) {
              dirs.push(parts);
            }
            while (parts.length > 1) {
              parts = parts.slice(0, parts.length - 1);
              const partsPath = parts.join('/');
              if (allDirs[partsPath] || partsPath === '.') {
                break;
              }
              allDirs[partsPath] = true;
              dirs.push(parts);
            }
          }
        }
      }
      dirs.sort((x, y) => {
        return x.length - y.length;
      });
      if (dirs.length) {
        createDirectories(outPath, dirs, (err) => {
          if (err) {
            callback(err);
          } else {
            extractFiles(outPath, entryName, files, callback, 0);
          }
        });
      } else {
        extractFiles(outPath, entryName, files, callback, 0);
      }
    } else {
      const file = entry;
      fs.stat(outPath, (err, stat) => {
        if (stat && stat.isDirectory()) {
          extract(file, path.join(outPath, path.basename(file.name)), callback);
        } else {
          extract(file, outPath, callback);
        }
      });
    }
  };

  that.close = function (callback) {
    if (closed || !fd) {
      closed = true;
      if (callback) {
        callback();
      }
    } else {
      closed = true;
      fs.close(fd, (err) => {
        fd = null;
        if (callback) {
          callback(err);
        }
      });
    }
  };

  const originalEmit = Reflect.get(events.EventEmitter.prototype, 'emit') as events.EventEmitter['emit'];
  that.emit = function (event, ...args) {
    if (!closed) {
      return originalEmit.call(this, event, ...args);
    }
  };
}

// The prototype and static members are attached below, matching the CommonJS constructor.
const StreamZip = function StreamZip(this: ZipInstance, config: ZipConfig) {
  initializeZip(this, config);
} as unknown as ZipConstructor;

StreamZip.setFs = function (customFs) {
  fs = customFs;
};

StreamZip.debugLog = (...args) => {
  if (StreamZip.debug) {
    console.log(...args);
  }
};

util.inherits(StreamZip, events.EventEmitter);

const propZip = Symbol('zip');

class StreamZipAsync extends events.EventEmitter {
  declare [propZip]: Promise<ZipInstance>;

  constructor(config: ZipConfig) {
    super();

    const zip = new StreamZip(config);

    zip.on('entry', (entry) => this.emit('entry', entry));
    zip.on('extract', (entry, outPath) => this.emit('extract', entry, outPath));

    this[propZip] = new Promise((resolve, reject) => {
      zip.on('ready', () => {
        zip.removeListener('error', reject);
        resolve(zip);
      });
      zip.on('error', reject);
    });
  }

  get entriesCount() {
    return this[propZip].then((zip) => zip.entriesCount);
  }

  get comment() {
    return this[propZip].then((zip) => zip.comment);
  }

  async entry(name: string) {
    const zip = await this[propZip];
    return zip.entry(name);
  }

  async entries() {
    const zip = await this[propZip];
    return zip.entries();
  }

  async stream(entry: EntryInput) {
    const zip = await this[propZip];
    return new Promise<stream.Readable>((resolve, reject) => {
      zip.stream(entry, (...[err, stm]) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve(stm);
        }
      });
    });
  }

  async entryData(entry: EntryInput) {
    const stm = await this.stream(entry);
    return new Promise<Buffer>((resolve, reject) => {
      const data: Buffer[] = [];
      stm.on('data', (chunk: Buffer) => data.push(chunk));
      stm.on('end', () => {
        resolve(Buffer.concat(data));
      });
      stm.on('error', (err) => {
        stm.removeAllListeners('end');
        reject(err);
      });
    });
  }

  async extract(entry: EntryInput | null | undefined, outPath: string) {
    const zip = await this[propZip];
    return new Promise<number | undefined>((resolve, reject) => {
      zip.extract(entry, outPath, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  async close() {
    const zip = await this[propZip];
    return new Promise<void>((resolve, reject) => {
      zip.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

StreamZip.async = StreamZipAsync;

class CentralDirectoryHeader {
  declare volumeEntries: number;
  declare totalEntries: number;
  declare size: number;
  declare offset: number;
  declare commentLength: number;
  declare headerOffset: number;

  read(data: Buffer) {
    if (data.length !== consts.ENDHDR || data.readUInt32LE(0) !== consts.ENDSIG) {
      throw new Error('Invalid central directory');
    }
    // number of entries on this volume
    this.volumeEntries = data.readUInt16LE(consts.ENDSUB);
    // total number of entries
    this.totalEntries = data.readUInt16LE(consts.ENDTOT);
    // central directory size in bytes
    this.size = data.readUInt32LE(consts.ENDSIZ);
    // offset of first CEN header
    this.offset = data.readUInt32LE(consts.ENDOFF);
    // zip file comment length
    this.commentLength = data.readUInt16LE(consts.ENDCOM);
  }
}

class CentralDirectoryLoc64Header {
  declare headerOffset: number;

  read(data: Buffer) {
    if (data.length !== consts.ENDL64HDR || data.readUInt32LE(0) !== consts.ENDL64SIG) {
      throw new Error('Invalid zip64 central directory locator');
    }
    // ZIP64 EOCD header offset
    this.headerOffset = readUInt64LE(data, consts.ENDSUB);
  }
}

class CentralDirectoryZip64Header {
  declare volumeEntries: number;
  declare totalEntries: number;
  declare size: number;
  declare offset: number;

  read(data: Buffer) {
    if (data.length !== consts.END64HDR || data.readUInt32LE(0) !== consts.END64SIG) {
      throw new Error('Invalid central directory');
    }
    // number of entries on this volume
    this.volumeEntries = readUInt64LE(data, consts.END64SUB);
    // total number of entries
    this.totalEntries = readUInt64LE(data, consts.END64TOT);
    // central directory size in bytes
    this.size = readUInt64LE(data, consts.END64SIZ);
    // offset of first CEN header
    this.offset = readUInt64LE(data, consts.END64OFF);
  }
}

class ZipEntry {
  declare verMade: number;
  declare version: number;
  declare flags: number;
  declare method: number;
  declare time: number;
  declare crc: number;
  declare compressedSize: number;
  declare size: number;
  declare fnameLen: number;
  declare extraLen: number;
  declare comLen: number;
  declare diskStart: number;
  declare inattr: number;
  declare attr: number;
  declare offset: number;
  declare headerOffset: number;
  declare name: string;
  declare isDirectory: boolean;
  declare comment: string|null;

  readHeader(data: Buffer, offset: number) {
    // data should be 46 bytes and start with "PK 01 02"
    if (data.length < offset + consts.CENHDR || data.readUInt32LE(offset) !== consts.CENSIG) {
      throw new Error('Invalid entry header');
    }
    // version made by
    this.verMade = data.readUInt16LE(offset + consts.CENVEM);
    // version needed to extract
    this.version = data.readUInt16LE(offset + consts.CENVER);
    // encrypt, decrypt flags
    this.flags = data.readUInt16LE(offset + consts.CENFLG);
    // compression method
    this.method = data.readUInt16LE(offset + consts.CENHOW);
    // modification time (2 bytes time, 2 bytes date)
    const timebytes = data.readUInt16LE(offset + consts.CENTIM);
    const datebytes = data.readUInt16LE(offset + consts.CENTIM + 2);
    this.time = parseZipTime(timebytes, datebytes);

    // uncompressed file crc-32 value
    this.crc = data.readUInt32LE(offset + consts.CENCRC);
    // compressed size
    this.compressedSize = data.readUInt32LE(offset + consts.CENSIZ);
    // uncompressed size
    this.size = data.readUInt32LE(offset + consts.CENLEN);
    // filename length
    this.fnameLen = data.readUInt16LE(offset + consts.CENNAM);
    // extra field length
    this.extraLen = data.readUInt16LE(offset + consts.CENEXT);
    // file comment length
    this.comLen = data.readUInt16LE(offset + consts.CENCOM);
    // volume number start
    this.diskStart = data.readUInt16LE(offset + consts.CENDSK);
    // internal file attributes
    this.inattr = data.readUInt16LE(offset + consts.CENATT);
    // external file attributes
    this.attr = data.readUInt32LE(offset + consts.CENATX);
    // LOC header offset
    this.offset = data.readUInt32LE(offset + consts.CENOFF);
  }

  readDataHeader(data: Buffer) {
    // 30 bytes and should start with "PK\003\004"
    if (data.readUInt32LE(0) !== consts.LOCSIG) {
      throw new Error('Invalid local header');
    }
    // version needed to extract
    this.version = data.readUInt16LE(consts.LOCVER);
    // general purpose bit flag
    this.flags = data.readUInt16LE(consts.LOCFLG);
    // compression method
    this.method = data.readUInt16LE(consts.LOCHOW);
    // modification time (2 bytes time ; 2 bytes date)
    const timebytes = data.readUInt16LE(consts.LOCTIM);
    const datebytes = data.readUInt16LE(consts.LOCTIM + 2);
    this.time = parseZipTime(timebytes, datebytes);

    // uncompressed file crc-32 value
    this.crc = data.readUInt32LE(consts.LOCCRC) || this.crc;
    // compressed size
    const compressedSize = data.readUInt32LE(consts.LOCSIZ);
    if (compressedSize && compressedSize !== consts.EF_ZIP64_OR_32) {
      this.compressedSize = compressedSize;
    }
    // uncompressed size
    const size = data.readUInt32LE(consts.LOCLEN);
    if (size && size !== consts.EF_ZIP64_OR_32) {
      this.size = size;
    }
    // filename length
    this.fnameLen = data.readUInt16LE(consts.LOCNAM);
    // extra field length
    this.extraLen = data.readUInt16LE(consts.LOCEXT);
  }

  read(data: Buffer, offset: number, textDecoder: TextDecoder | null) {
    const nameData = data.slice(offset, (offset += this.fnameLen));
    this.name = textDecoder
      ? textDecoder.decode(new Uint8Array(nameData))
      : nameData.toString('utf8');
    const lastChar = data[offset - 1];
    this.isDirectory = lastChar === 47 || lastChar === 92;

    if (this.extraLen) {
      this.readExtra(data, offset);
      offset += this.extraLen;
    }
    this.comment = this.comLen ? data.slice(offset, offset + this.comLen).toString() : null;
  }

  validateName() {
    if (/\\|^\w+:|^\/|(^|\/)\.\.(\/|$)/.test(this.name)) {
      throw new Error('Malicious entry: ' + this.name);
    }
  }

  readExtra(data: Buffer, offset: number) {
    let signature, size;
    const maxPos = offset + this.extraLen;
    while (offset < maxPos) {
      signature = data.readUInt16LE(offset);
      offset += 2;
      size = data.readUInt16LE(offset);
      offset += 2;
      if (consts.ID_ZIP64 === signature) {
        this.parseZip64Extra(data, offset, size);
      }
      offset += size;
    }
  }

  parseZip64Extra(data: Buffer, offset: number, length: number) {
    if (length >= 8 && this.size === consts.EF_ZIP64_OR_32) {
      this.size = readUInt64LE(data, offset);
      offset += 8;
      length -= 8;
    }
    if (length >= 8 && this.compressedSize === consts.EF_ZIP64_OR_32) {
      this.compressedSize = readUInt64LE(data, offset);
      offset += 8;
      length -= 8;
    }
    if (length >= 8 && this.offset === consts.EF_ZIP64_OR_32) {
      this.offset = readUInt64LE(data, offset);
      offset += 8;
      length -= 8;
    }
    if (length >= 4 && this.diskStart === consts.EF_ZIP64_OR_16) {
      this.diskStart = data.readUInt32LE(offset);
      // offset += 4; length -= 4;
    }
  }

  get encrypted() {
    return (this.flags & consts.FLG_ENTRY_ENC) === consts.FLG_ENTRY_ENC;
  }

  get isFile() {
    return !this.isDirectory;
  }
}

class FsRead {
  declare fd: number;
  declare buffer: Buffer;
  declare offset: number;
  declare length: number;
  declare position: number;
  declare callback: ReadCallback;
  declare bytesRead: number;
  declare waiting: boolean;

  constructor(fd: number, buffer: Buffer, offset: number, length: number, position: number, callback: ReadCallback) {
    this.fd = fd;
    this.buffer = buffer;
    this.offset = offset;
    this.length = length;
    this.position = position;
    this.callback = callback;
    this.bytesRead = 0;
    this.waiting = false;
  }

  read(sync?: boolean) {
    StreamZip.debugLog('read', this.position, this.bytesRead, this.length, this.offset);
    this.waiting = true;
    let err;
    if (sync) {
      let bytesRead = 0;
      try {
        bytesRead = fs.readSync(
          this.fd,
          this.buffer,
          this.offset + this.bytesRead,
          this.length - this.bytesRead,
          this.position + this.bytesRead
        );
      } catch (e) {
        err = e as Error;
      }
      this.readCallback(sync, err, err ? bytesRead : null);
    } else {
      fs.read(
        this.fd,
        this.buffer,
        this.offset + this.bytesRead,
        this.length - this.bytesRead,
        this.position + this.bytesRead,
        this.readCallback.bind(this, sync)
      );
    }
  }

  readCallback(sync: boolean | undefined, err: ZipError, bytesRead: number | null) {
    if (typeof bytesRead === 'number') {
      this.bytesRead += bytesRead;
    }
    if (err || !bytesRead || this.bytesRead === this.length) {
      this.waiting = false;
      return this.callback(err, this.bytesRead);
    } else {
      this.read(sync);
    }
  }
}

class FileWindowBuffer {
  declare position: number;
  declare buffer: Buffer;
  declare fd: number;
  declare fsOp: FsRead|null|void;

  constructor(fd: number) {
    this.position = 0;
    this.buffer = Buffer.alloc(0);
    this.fd = fd;
    this.fsOp = null;
  }

  checkOp() {
    if (this.fsOp && this.fsOp.waiting) {
      throw new Error('Operation in progress');
    }
  }

  read(pos: number, length: number, callback: ReadCallback) {
    this.checkOp();
    if (this.buffer.length < length) {
      this.buffer = Buffer.alloc(length);
    }
    this.position = pos;
    this.fsOp = new FsRead(this.fd, this.buffer, 0, length, this.position, callback).read();
  }

  expandLeft(length: number, callback: ReadCallback) {
    this.checkOp();
    this.buffer = Buffer.concat([Buffer.alloc(length), this.buffer]);
    this.position -= length;
    if (this.position < 0) {
      this.position = 0;
    }
    this.fsOp = new FsRead(this.fd, this.buffer, 0, length, this.position, callback).read();
  }

  expandRight(length: number, callback: ReadCallback) {
    this.checkOp();
    const offset = this.buffer.length;
    this.buffer = Buffer.concat([this.buffer, Buffer.alloc(length)]);
    this.fsOp = new FsRead(
      this.fd,
      this.buffer,
      offset,
      length,
      this.position + offset,
      callback
    ).read();
  }

  moveRight(length: number, callback: ReadCallback, shift?: number) {
    this.checkOp();
    if (shift) {
      this.buffer.copy(this.buffer, 0, shift);
    } else {
      shift = 0;
    }
    this.position += shift;
    this.fsOp = new FsRead(
      this.fd,
      this.buffer,
      this.buffer.length - shift,
      shift,
      this.position + this.buffer.length - shift,
      callback
    ).read();
  }
}

class EntryDataReaderStream extends stream.Readable {
  declare fd: number;
  declare offset: number;
  declare length: number;
  declare pos: number;

  constructor(fd: number, offset: number, length: number) {
    super();
    this.fd = fd;
    this.offset = offset;
    this.length = length;
    this.pos = 0;
  }

  _read(n: number) {
    const buffer = Buffer.alloc(Math.min(n, this.length - this.pos));
    if (buffer.length) {
      fs.read(this.fd, buffer, 0, buffer.length, this.offset + this.pos, (err, bytesRead, data) => this.readCallback(err, bytesRead, data));
    } else {
      this.push(null);
    }
  }

  readCallback(err: ZipError, bytesRead: number, buffer: Buffer) {
    this.pos += bytesRead;
    if (err) {
      this.emit('error', err);
      this.push(null);
    } else if (!bytesRead) {
      this.push(null);
    } else {
      if (bytesRead !== buffer.length) {
        buffer = buffer.slice(0, bytesRead);
      }
      this.push(buffer);
    }
  }
}

class EntryVerifyStream extends stream.Transform {
  declare verify: CrcVerify;

  constructor(baseStm: stream.Readable, crc: number, size: number) {
    super();
    this.verify = new CrcVerify(crc, size);
    baseStm.on('error', (e) => {
      this.emit('error', e);
    });
  }

  _transform(data: Buffer, encoding: BufferEncoding, callback: stream.TransformCallback) {
    let err;
    try {
      this.verify.data(data);
    } catch (e) {
      err = e;
    }
    callback(err as Error | undefined, data);
  }
}

class CrcVerify {
  declare crc: number;
  declare size: number;
  declare state: {crc:number;size:number};
  declare static crcTable: number[] | undefined;

  constructor(crc: number, size: number) {
    this.crc = crc;
    this.size = size;
    this.state = {
      crc: ~0,
      size: 0,
    };
  }

  data(data: Buffer) {
    const crcTable = CrcVerify.getCrcTable();
    let crc = this.state.crc;
    let off = 0;
    let len = data.length;
    while (--len >= 0) {
      crc = crcTable[(crc ^ data[off++]) & 0xff] ^ (crc >>> 8);
    }
    this.state.crc = crc;
    this.state.size += data.length;
    if (this.state.size >= this.size) {
      const buf = Buffer.alloc(4);
      buf.writeInt32LE(~this.state.crc & 0xffffffff, 0);
      crc = buf.readUInt32LE(0);
      if (crc !== this.crc) {
        throw new Error('Invalid CRC');
      }
      if (this.state.size !== this.size) {
        throw new Error('Invalid size');
      }
    }
  }

  static getCrcTable() {
    let crcTable = CrcVerify.crcTable;
    if (!crcTable) {
      CrcVerify.crcTable = crcTable = [];
      const b = Buffer.alloc(4);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 8; --k >= 0;) {
          if ((c & 1) !== 0) {
            c = 0xedb88320 ^ (c >>> 1);
          } else {
            c = c >>> 1;
          }
        }
        if (c < 0) {
          b.writeInt32LE(c, 0);
          c = b.readUInt32LE(0);
        }
        crcTable[n] = c;
      }
    }
    return crcTable;
  }
}

function parseZipTime(timebytes: number, datebytes: number) {
  const timebits = toBits(timebytes, 16);
  const datebits = toBits(datebytes, 16);

  const mt = {
    h: parseInt(timebits.slice(0, 5).join(''), 2),
    m: parseInt(timebits.slice(5, 11).join(''), 2),
    s: parseInt(timebits.slice(11, 16).join(''), 2) * 2,
    Y: parseInt(datebits.slice(0, 7).join(''), 2) + 1980,
    M: parseInt(datebits.slice(7, 11).join(''), 2),
    D: parseInt(datebits.slice(11, 16).join(''), 2),
  };
  const dt_str = [mt.Y, mt.M, mt.D].join('-') + ' ' + [mt.h, mt.m, mt.s].join(':') + ' GMT+0';
  return new Date(dt_str).getTime();
}

function toBits(dec: number, size: number) {
  let b = (dec >>> 0).toString(2);
  while (b.length < size) {
    b = '0' + b;
  }
  return b.split('');
}

function readUInt64LE(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset + 4) * 0x0000000100000000 + buffer.readUInt32LE(offset);
}

export = StreamZip;