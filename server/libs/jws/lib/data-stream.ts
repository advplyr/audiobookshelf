import Stream from 'node:stream';
import { inherits } from 'node:util';
import { Buffer as SafeBuffer } from 'safe-buffer';

const Buffer = SafeBuffer as unknown as typeof globalThis.Buffer;

interface DataStream extends Stream {
  buffer: unknown;
  writable: boolean;
  readable: boolean;
  write(data: unknown): void;
  end(data?: unknown): void;
}

function DataStream(this: DataStream, data?: unknown) {
  this.buffer = null;
  this.writable = true;
  this.readable = true;

  // No input
  if (!data) {
    this.buffer = Buffer.alloc(0);
    return this;
  }

  // Stream
  const source = data as { pipe?: (target: DataStream) => unknown; length?: unknown };
  if (typeof source.pipe === 'function') {
    this.buffer = Buffer.alloc(0);
    source.pipe(this);
    return this;
  }

  // Buffer or String
  // or Object (assumedly a passworded key)
  if (source.length || typeof data === 'object') {
    this.buffer = data;
    this.writable = false;
    process.nextTick(() => {
      this.emit('end', data);
      this.readable = false;
      this.emit('close');
    });
    return this;
  }

  throw new TypeError('Unexpected data type (' + typeof data + ')');
}
inherits(DataStream, Stream);

const DataStreamConstructor = DataStream as unknown as {
  new (data?: unknown): DataStream;
  prototype: DataStream;
};

DataStreamConstructor.prototype.write = function write(data) {
  this.buffer = Buffer.concat([this.buffer as Buffer, Buffer.from(data as string | Buffer)]);
  this.emit('data', data);
};

DataStreamConstructor.prototype.end = function end(data) {
  if (data)
    this.write(data);
  this.emit('end', data);
  this.emit('close');
  this.writable = false;
  this.readable = false;
};

export = DataStreamConstructor;
