import { createRequire } from 'node:module';

type Equal = (this: Buffer, other: unknown) => boolean;
type BufferPrototype = Buffer & { equal?: Equal };

const { Buffer, SlowBuffer } = createRequire(__filename)('buffer') as {
  Buffer: typeof globalThis.Buffer & { prototype: BufferPrototype };
  SlowBuffer: { prototype: BufferPrototype };
};

function bufferEq(a: unknown, b: unknown) {

  // shortcutting on type is necessary for correctness
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    return false;
  }

  // buffer sizes should be well-known information, so despite this
  // shortcutting, it doesn't leak any information about the *contents* of the
  // buffers.
  if (a.length !== b.length) {
    return false;
  }

  var c = 0;
  for (var i = 0; i < a.length; i++) {
    /*jshint bitwise:false */
    c |= a[i] ^ b[i]; // XOR
  }
  return c === 0;
}

bufferEq.install = function () {
  Buffer.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {
    return bufferEq(this, that);
  };
};

var origBufEqual = Buffer.prototype.equal;
var origSlowBufEqual = SlowBuffer.prototype.equal;
bufferEq.restore = function () {
  Buffer.prototype.equal = origBufEqual;
  SlowBuffer.prototype.equal = origSlowBufEqual;
};

export = bufferEq;
