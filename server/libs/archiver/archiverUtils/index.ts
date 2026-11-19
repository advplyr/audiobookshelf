/**
 * archiver-utils
 *
 * Copyright (c) 2015 Chris Talkington.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/archiver-utils/blob/master/LICENSE
 */
import fs from 'graceful-fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Stream } from 'node:stream';
import type { PassThrough as PassThroughStream, Readable } from 'node:stream';
import type { Stats } from 'node:fs';
import normalizePath from '../normalize-path';
import file from './file.js';

const load = createRequire(__filename);
const lazystream = load('./lazystream') as {
  Readable: new (open: () => ReturnType<typeof fs.createReadStream>) => Readable;
};
const { PassThrough } = load('./readableStream') as { PassThrough: new () => PassThroughStream };

type WithDefaults<Input extends object, Defaults extends object> = Omit<Input, keyof Defaults> & {
  [Key in keyof Defaults]: Key extends keyof Input ? Exclude<Input[Key], undefined> | Defaults[Key] : Defaults[Key];
};

interface WalkEntry {
  path: string;
  relative: string;
  stats?: Stats;
}

type Callback<Value> = (error: Error | null, value?: Value) => void;

function collectStream(source: Stream, callback: Callback<Buffer>) {
  var collection: Buffer[] = [];
  var size = 0;

  source.on('error', callback);

  source.on('data', function (chunk: Buffer) {
    collection.push(chunk);
    size += chunk.length;
  });

  source.on('end', function () {
    var buf = Buffer.alloc(size);
    var offset = 0;

    collection.forEach(function (data) {
      data.copy(buf, offset);
      offset += data.length;
    });

    callback(null, buf);
  });
}

function dateify(dateish?: Date | string | null) {
  dateish = dateish || new Date();

  if (dateish instanceof Date) {
    dateish = dateish;
  } else if (typeof dateish === 'string') {
    dateish = new Date(dateish);
  } else {
    dateish = new Date();
  }

  return dateish;
}

// this is slightly different from lodash version
function defaults<Input extends object, Defaults extends object>(object: Input | null | undefined, source: Defaults): WithDefaults<Input, Defaults> {
  const destination = Object(object) as Record<string, unknown>
  const sources = [source]
  const objectProto = Object.prototype as Record<string, unknown>
  sources.forEach((source) => {
    if (source != null) {
      const values = Object(source) as Record<string, unknown>
      for (const key in values) {
        const value = destination[key]
        if (value === undefined ||
          (value == objectProto[key] && !Object.prototype.hasOwnProperty.call(destination, key))) {
          destination[key] = values[key]
        }
      }
    }
  })
  return destination as WithDefaults<Input, Defaults>
}

function isStream(source: unknown): source is Stream {
  return source instanceof Stream;
}

function lazyReadStream(filepath: string) {
  return new lazystream.Readable(function () {
    return fs.createReadStream(filepath);
  });
}

function normalizeInputSource<Source>(source: Source): Source | Buffer | PassThroughStream {
  if (source === null) {
    return Buffer.alloc(0);
  } else if (typeof source === 'string') {
    return Buffer.from(source);
  } else if (utils.isStream(source)) {
    // Always pipe through a PassThrough stream to guarantee pausing the stream if it's already flowing,
    // since it will only be processed in a (distant) future iteration of the event loop, and will lose
    // data if already flowing now.
    return source.pipe(new PassThrough());
  }

  return source;
}

function sanitizePath(filepath: string) {
  return normalizePath(filepath, false).replace(/^\w+:/, '').replace(/^(\.\.\/|\/)+/, '');
}

function trailingSlashIt(str: string) {
  return str.slice(-1) !== '/' ? str + '/' : str;
}

function unixifyPath(filepath: string) {
  return normalizePath(filepath, false).replace(/^\w+:/, '');
}

function walkdir(dirpath: string, callback: Callback<WalkEntry[]>): void;
function walkdir(dirpath: string, base: string, callback: Callback<WalkEntry[]>): void;
function walkdir(dirpath: string, base: string | Callback<WalkEntry[]>, callback?: Callback<WalkEntry[]>): void {
  var results: WalkEntry[] = [];

  if (typeof base === 'function') {
    callback = base;
    base = dirpath;
  }

  const report = callback!;
  const root = base;
  fs.readdir(dirpath, function (err, list) {
    var i = 0;
    var file: string | undefined;
    var filepath: string;

    if (err) {
      return report(err);
    }

    (function next() {
      file = list[i++];

      if (!file) {
        return report(null, results);
      }

      filepath = path.join(dirpath, file);

      fs.stat(filepath, function (err, stats) {
        results.push({
          path: filepath,
          relative: path.relative(root, filepath).replace(/\\/g, '/'),
          stats: stats
        });

        if (stats && stats.isDirectory()) {
          utils.walkdir(filepath, root, function (_err, res) {
            res!.forEach(function (dirEntry) {
              results.push(dirEntry);
            });
            next();
          });
        } else {
          next();
        }
      });
    })();
  });
}

const utils = {
  file,
  collectStream,
  dateify,
  defaults,
  isStream,
  lazyReadStream,
  normalizeInputSource,
  sanitizePath,
  trailingSlashIt,
  unixifyPath,
  walkdir
};

export = utils;
