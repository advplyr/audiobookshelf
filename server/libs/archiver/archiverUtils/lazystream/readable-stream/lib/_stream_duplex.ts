// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

import { createRequire } from 'node:module';
import type { Duplex as NodeDuplex, DuplexOptions as NodeDuplexOptions } from 'node:stream';
import { inherits } from 'node:util';

interface DuplexOptions extends NodeDuplexOptions {
  readable?: boolean;
  writable?: boolean;
}

interface DuplexStream extends NodeDuplex {
  writable: boolean;
  _readableState: { destroyed: boolean };
  _writableState: { highWaterMark: number; ended: boolean; destroyed: boolean };
}

interface StreamConstructor {
  (this: DuplexStream, options?: DuplexOptions): void;
  prototype: Record<string, unknown>;
}

/*<replacement>*/

// var pna = require('process-nextick-args');
var pna = process
/*</replacement>*/

/*<replacement>*/
var objectKeys = Object.keys || function (obj: object) {
  var keys: string[] = [];
  for (var key in obj) {
    keys.push(key);
  } return keys;
};
/*</replacement>*/

const load = createRequire(__filename);
var Readable = load('./_stream_readable') as StreamConstructor;
var Writable = load('./_stream_writable') as StreamConstructor;

const Duplex = function (this: DuplexStream, options?: DuplexOptions) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
} as unknown as {
  (options?: DuplexOptions): DuplexStream;
  new (options?: DuplexOptions): DuplexStream;
  prototype: DuplexStream & Record<string, unknown>;
};

inherits(Duplex, Readable);

{
  // avoid scope creep, the keys array can then be collected
  var keys = objectKeys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
}

Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function (this: DuplexStream) {
    return this._writableState.highWaterMark;
  }
});

// the no-half-open enforcer
function onend(this: DuplexStream) {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  pna.nextTick(onEndNT, this);
}

function onEndNT(self: DuplexStream) {
  self.end();
}

Object.defineProperty(Duplex.prototype, 'destroyed', {
  get: function (this: DuplexStream) {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function (this: DuplexStream, value: boolean) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

Duplex.prototype._destroy = function (err, cb) {
  this.push(null);
  this.end();

  pna.nextTick(cb, err);
};

export = Duplex;
