/**
 * node-crc32-stream
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-crc32-stream/blob/master/LICENSE-MIT
 */

import { DeflateRaw } from 'node:zlib';
import type { ZlibOptions } from 'node:zlib';
import type { TransformCallback } from 'node:stream';

import crc32 from '../crc32';

class DeflateCRC32Stream extends DeflateRaw {
  declare checksum: number | Buffer;
  declare rawSize: number;
  declare compressedSize: number;

  constructor(options?: ZlibOptions) {
    super(options);

    this.checksum = Buffer.allocUnsafe(4);
    this.checksum.writeInt32BE(0, 0);

    this.rawSize = 0;
    this.compressedSize = 0;
  }

  override push(chunk: Buffer | Uint8Array | string | null, encoding?: BufferEncoding) {
    if (chunk) {
      this.compressedSize += chunk.length;
    }

    return super.push(chunk, encoding);
  }

  override _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
    if (chunk) {
      this.checksum = crc32.buf(chunk, this.checksum) >>> 0;
      this.rawSize += chunk.length;
    }

    super._transform(chunk, encoding, callback)
  }

  digest(): Buffer;
  digest(encoding: BufferEncoding): string;
  digest(encoding?: BufferEncoding): Buffer | string {
    const checksum = Buffer.allocUnsafe(4);
    checksum.writeUInt32BE(Number(this.checksum) >>> 0, 0);
    return encoding ? checksum.toString(encoding) : checksum;
  }

  hex() {
    return this.digest('hex').toUpperCase();
  }

  size(compressed = false) {
    if (compressed) {
      return this.compressedSize;
    } else {
      return this.rawSize;
    }
  }
}

export = DeflateCRC32Stream;
