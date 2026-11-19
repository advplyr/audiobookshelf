/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-compress-commons/blob/master/LICENSE-MIT
 */
import { createRequire } from 'node:module';
import { Stream } from 'node:stream';
import type { PassThrough as PassThroughStream } from 'node:stream';

const { PassThrough } = createRequire(__filename)('../../archiverUtils/readableStream') as {
  PassThrough: new () => PassThroughStream;
};

type LegacyStream = Stream & { _readableState?: unknown };

const util = {
  isStream(source: unknown): source is LegacyStream {
    return source instanceof Stream;
  },

  normalizeInputSource<Source>(source: Source): Source | Buffer | PassThroughStream {
    if (source === null) {
      return Buffer.alloc(0);
    } else if (typeof source === 'string') {
      return Buffer.from(source);
    } else if (util.isStream(source) && !source._readableState) {
      var normalized = new PassThrough();
      source.pipe(normalized);

      return normalized;
    }

    return source;
  }
};

export = util;
