/**
 * node-crc32-stream
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-crc32-stream/blob/master/LICENSE-MIT
 */

import { createRequire } from 'node:module';
import type { Transform as NodeTransform, TransformCallback, TransformOptions } from 'node:stream';

const load = createRequire(__filename);
const { Transform } = load('../archiverUtils/readableStream') as { Transform: typeof NodeTransform };
const crc32 = load('../crc32') as { buf(chunk: Buffer, seed: number | Buffer): number };

class CRC32Stream extends Transform {
  declare checksum: number | Buffer;
  declare rawSize: number;

  constructor(options?: TransformOptions) {
    super(options);
    this.checksum = Buffer.allocUnsafe(4);
    this.checksum.writeInt32BE(0, 0);

    this.rawSize = 0;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    if (chunk) {
      this.checksum = crc32.buf(chunk, this.checksum) >>> 0;
      this.rawSize += chunk.length;
    }

    callback(null, chunk);
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

  size() {
    return this.rawSize;
  }
}

export = CRC32Stream;
