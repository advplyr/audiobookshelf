/**
 * node-compress-commons
 *
 * Copyright (c) 2014 Chris Talkington, contributors.
 * Licensed under the MIT license.
 * https://github.com/archiverjs/node-compress-commons/blob/master/LICENSE-MIT
 */
import { createRequire } from 'node:module';
import { inherits } from 'node:util';
import type { Transform as NodeTransform, TransformOptions, TransformCallback, Stream } from 'node:stream';
import ArchiveEntry from './archive-entry';
import util from '../util';

type Entry = InstanceType<typeof ArchiveEntry>;
type Chunk = string | Uint8Array;
type WriteOption = BufferEncoding | ((error?: Error | null) => void);
type EntryCallback<Item extends Entry> = (error: Error | null, item?: Item) => void;

interface ArchiveState {
  finish: boolean;
  finished: boolean;
  processing: boolean;
}

interface ArchiveStream<Item extends Entry = Entry> extends Omit<NodeTransform, 'write'> {
  offset: number;
  _archive: ArchiveState;
  _entry?: Item | null;
  _appendBuffer(entry: Item, source: Buffer, callback: EntryCallback<Item>): void;
  _appendStream(entry: Item, source: Stream, callback: EntryCallback<Item>): void;
  _emitErrorCallback(error: Error | null): void;
  _finish(entry?: Item): void;
  _normalizeEntry(entry: Item): void;
  entry(entry: Item, source?: unknown, callback?: EntryCallback<Item>): this | undefined;
  finish(): void;
  getBytesWritten(): number;
  write(chunk: Chunk, callbackOrEncoding?: WriteOption): boolean;
}

interface TransformConstructor {
  (this: ArchiveStream, options?: TransformOptions): void;
  prototype: { write(this: ArchiveStream, chunk: Chunk, callbackOrEncoding?: WriteOption): boolean };
}

const { Transform } = createRequire(__filename)('../../archiverUtils/readableStream') as {
  Transform: TransformConstructor;
};

const constructor: unknown = function createArchiveStream(this: ArchiveStream, options?: TransformOptions) {
  if (!(this instanceof ArchiveOutputStream)) {
    return new ArchiveOutputStream(options);
  }

  Transform.call(this, options);

  this.offset = 0;
  this._archive = {
    finish: false,
    finished: false,
    processing: false
  };
};

const ArchiveOutputStream = constructor as {
  new (options?: TransformOptions): ArchiveStream;
  (options?: TransformOptions): ArchiveStream;
  (this: ArchiveStream, options?: TransformOptions): void;
  prototype: ArchiveStream;
};
inherits(ArchiveOutputStream, Transform);

ArchiveOutputStream.prototype._appendBuffer = function (entry, source, callback) {
  void entry;
  void source;
  void callback;
  // scaffold only
};

ArchiveOutputStream.prototype._appendStream = function (entry, source, callback) {
  void entry;
  void source;
  void callback;
  // scaffold only
};

ArchiveOutputStream.prototype._emitErrorCallback = function (err) {
  if (err) {
    this.emit('error', err);
  }
};

ArchiveOutputStream.prototype._finish = function (entry) {
  void entry;
  // scaffold only
};

ArchiveOutputStream.prototype._normalizeEntry = function (entry) {
  void entry;
  // scaffold only
};

ArchiveOutputStream.prototype._transform = function (chunk: Chunk, _encoding: BufferEncoding, callback: TransformCallback) {
  callback(null, chunk);
};

ArchiveOutputStream.prototype.entry = function (this: ArchiveStream, ae, source, callback) {
  source = source || null;

  if (typeof callback !== 'function') {
    callback = this._emitErrorCallback.bind(this);
  }

  if (!(ae instanceof ArchiveEntry)) {
    callback(new Error('not a valid instance of ArchiveEntry'));
    return;
  }

  if (this._archive.finish || this._archive.finished) {
    callback(new Error('unacceptable entry after finish'));
    return;
  }

  if (this._archive.processing) {
    callback(new Error('already processing an entry'));
    return;
  }

  this._archive.processing = true;
  this._normalizeEntry(ae);
  this._entry = ae;

  source = util.normalizeInputSource(source);

  if (Buffer.isBuffer(source)) {
    this._appendBuffer(ae, source, callback);
  } else if (util.isStream(source)) {
    this._appendStream(ae, source, callback);
  } else {
    this._archive.processing = false;
    callback(new Error('input source must be valid Stream or Buffer instance'));
    return;
  }

  return this;
};

ArchiveOutputStream.prototype.finish = function () {
  if (this._archive.processing) {
    this._archive.finish = true;
    return;
  }

  this._finish();
};

ArchiveOutputStream.prototype.getBytesWritten = function () {
  return this.offset;
};

ArchiveOutputStream.prototype.write = function (chunk, cb) {
  if (chunk) {
    this.offset += chunk.length;
  }

  return Transform.prototype.write.call(this, chunk, cb);
};

declare namespace ArchiveOutputStream {
  export type Instance<Item extends Entry = Entry> = ArchiveStream<Item>;
  export type Callback<Item extends Entry> = EntryCallback<Item>;
}

export = ArchiveOutputStream;
