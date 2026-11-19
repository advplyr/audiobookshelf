import { createRequire } from 'node:module';
import Stream from 'node:stream';

type StreamTypes = Pick<typeof Stream, 'Readable' | 'Writable' | 'Duplex' | 'Transform' | 'PassThrough' | 'Stream'>;
type ReadableExport = typeof Stream.Readable & StreamTypes;

declare const module: { exports: unknown };
declare let exports: typeof Stream.Readable & Partial<StreamTypes>;

const load = createRequire(__filename);
if (process.env.READABLE_STREAM === 'disable' && Stream) {
  module.exports = Stream;
  exports = module.exports = Stream.Readable;
  exports.Readable = Stream.Readable;
  exports.Writable = Stream.Writable;
  exports.Duplex = Stream.Duplex;
  exports.Transform = Stream.Transform;
  exports.PassThrough = Stream.PassThrough;
  exports.Stream = Stream;
} else {
  exports = module.exports = load('./lib/_stream_readable.js') as typeof Stream.Readable;
  exports.Stream = Stream || exports;
  exports.Readable = exports;
  exports.Writable = load('./lib/_stream_writable.js') as typeof Stream.Writable;
  exports.Duplex = load('./lib/_stream_duplex.js') as typeof Stream.Duplex;
  exports.Transform = load('./lib/_stream_transform.js') as typeof Stream.Transform;
  exports.PassThrough = load('./lib/_stream_passthrough.js') as typeof Stream.PassThrough;
}

export = module.exports as ReadableExport;
