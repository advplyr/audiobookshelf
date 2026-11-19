//
// Source: https://github.com/jpommerening/node-lazystream
//

import { createRequire } from 'node:module';
import type { PassThrough as PassThroughStream, Readable as ReadableStream, TransformOptions, Writable as WritableStream } from 'node:stream';
import { inherits } from 'node:util';

type Open<Source> = (this: PassThroughStream, options?: TransformOptions) => Source;
type LazyMethod = '_read' | '_write';
type LazyMethods = Partial<Record<LazyMethod, (this: PassThroughStream, ...args: unknown[]) => unknown>>;

interface LazyStreamConstructor<Source> {
  (fn: Open<Source>, options?: TransformOptions): PassThroughStream;
  new (fn: Open<Source>, options?: TransformOptions): PassThroughStream;
}

const PassThrough = createRequire(__filename)('./readable-stream/passthrough') as (this: PassThroughStream, options?: TransformOptions) => void;

// Patch the given method of instance so that the callback
// is executed once, before the actual method is called the
// first time.
function beforeFirstCall(instance: PassThroughStream, method: LazyMethod, callback: (this: PassThroughStream, ...args: unknown[]) => void) {
  const target = instance as LazyMethods;
  target[method] = function (this: PassThroughStream, ...args: unknown[]) {
    delete target[method];
    callback.apply(this, args);
    const original = (this as LazyMethods)[method]!;
    return original.apply(this, args);
  };
}

const readableConstructor: unknown = function Readable(this: PassThroughStream, fn: Open<ReadableStream>, options?: TransformOptions) {
  if (!(this instanceof LazyReadable))
    return new LazyReadable(fn, options);

  PassThrough.call(this, options);

  beforeFirstCall(this, '_read', function () {
    var source = fn.call(this, options);
    var emit = this.emit.bind(this, 'error');
    source.on('error', emit);
    source.pipe(this);
  });

  this.emit('readable');
};

const writableConstructor: unknown = function Writable(this: PassThroughStream, fn: Open<WritableStream>, options?: TransformOptions) {
  if (!(this instanceof LazyWritable))
    return new LazyWritable(fn, options);

  PassThrough.call(this, options);

  beforeFirstCall(this, '_write', function () {
    var destination = fn.call(this, options);
    var emit = this.emit.bind(this, 'error');
    destination.on('error', emit);
    this.pipe(destination);
  });

  this.emit('writable');
};

const LazyReadable = readableConstructor as LazyStreamConstructor<ReadableStream>;
const LazyWritable = writableConstructor as LazyStreamConstructor<WritableStream>;
inherits(LazyReadable, PassThrough);
inherits(LazyWritable, PassThrough);

export = {
  Readable: LazyReadable,
  Writable: LazyWritable
};
