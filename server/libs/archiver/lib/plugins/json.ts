/**
 * JSON Format Plugin
 *
 * @module plugins/json
 * @license [MIT]{@link https://github.com/archiverjs/node-archiver/blob/master/LICENSE}
 * @copyright (c) 2012-2014 Chris Talkington, contributors.
 */
import { createRequire } from 'node:module';
import { inherits } from 'node:util';
import type { Stream, Transform as NodeTransform, TransformCallback, TransformOptions } from 'node:stream';
import crc32 from '../../buffer-crc32';
import util from '../../archiverUtils';

type EntryData = Record<string, unknown> & {
  sourceType?: 'buffer' | 'stream';
  size?: number;
  crc32?: number;
};

type EntryCallback = (error: Error | null, data?: EntryData) => void;

interface JsonArchive extends NodeTransform {
  options: TransformOptions;
  supports: { directory: boolean; symlink: boolean };
  files: EntryData[];
  _writeStringified(): void;
  append(source: Buffer | Stream, data: EntryData, callback: EntryCallback): void;
  finalize(): void;
}

const { Transform } = createRequire(__filename)('../../archiverUtils/readableStream') as {
  Transform: (this: JsonArchive, options?: TransformOptions) => void;
};

/**
 * @constructor
 * @param {(JsonOptions|TransformOptions)} options
 */
const constructor: unknown = function Json(this: JsonArchive, options?: TransformOptions) {
  if (!(this instanceof JsonPlugin)) {
    return new JsonPlugin(options);
  }

  options = this.options = util.defaults(options, {});

  Transform.call(this, options);

  this.supports = {
    directory: true,
    symlink: true
  };

  this.files = [];
};

const JsonPlugin = constructor as {
  (options?: TransformOptions): JsonArchive;
  new (options?: TransformOptions): JsonArchive;
  prototype: JsonArchive;
};
inherits(JsonPlugin, Transform);

/**
 * [_transform description]
 *
 * @private
 * @param  {Buffer}   chunk
 * @param  {String}   encoding
 * @param  {Function} callback
 * @return void
 */
JsonPlugin.prototype._transform = function (chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
  callback(null, chunk);
};

/**
 * [_writeStringified description]
 *
 * @private
 * @return void
 */
JsonPlugin.prototype._writeStringified = function () {
  var fileString = JSON.stringify(this.files);
  this.write(fileString);
};

/**
 * [append description]
 *
 * @param  {(Buffer|Stream)}   source
 * @param  {EntryData}   data
 * @param  {Function} callback
 * @return void
 */
JsonPlugin.prototype.append = function (source, data, callback) {
  data.crc32 = 0;

  const onend = (err: Error | null, sourceBuffer?: Buffer) => {
    if (err) {
      callback(err);
      return;
    }

    const contents = sourceBuffer!;
    data.size = contents.length || 0;
    data.crc32 = crc32.unsigned(contents);

    this.files.push(data);

    callback(null, data);
  };

  if (data.sourceType === 'buffer') {
    onend(null, source as Buffer);
  } else if (data.sourceType === 'stream') {
    util.collectStream(source as Stream, onend);
  }
};

/**
 * [finalize description]
 *
 * @return void
 */
JsonPlugin.prototype.finalize = function () {
  this._writeStringified();
  this.end();
};

export = JsonPlugin;

/**
 * @typedef {Object} JsonOptions
 * @global
 */
