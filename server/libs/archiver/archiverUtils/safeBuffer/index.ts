/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
import buffer from 'node:buffer'

type BufferModule = typeof buffer & { SlowBuffer(size: number): Buffer }
type LegacyBuffer = Partial<BufferModule['Buffer']> & {
  (arg: unknown, encodingOrOffset?: string | number, length?: number): Buffer
  prototype: Buffer
}
const Buffer = buffer.Buffer as unknown as LegacyBuffer
const fallback: Partial<BufferModule> = {}
let bufferExports: typeof buffer

// alternative to using Object.keys for old browsers
function copyProps(src: object, dst: object) {
  const source = src as Record<string, unknown>
  const destination = dst as Record<string, unknown>
  for (var key in source) {
    destination[key] = source[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  bufferExports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, fallback)
  fallback.Buffer = SafeBuffer as unknown as BufferModule['Buffer']
  bufferExports = fallback as BufferModule
}

function SafeBuffer(arg: unknown, encodingOrOffset?: string | number, length?: number) {
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.prototype = Object.create(Buffer.prototype) as Buffer

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg: unknown, encodingOrOffset?: string | number, length?: number) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size: unknown, fill?: string | number | Uint8Array, encoding?: BufferEncoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size: unknown) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size: unknown) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return (buffer as BufferModule).SlowBuffer(size)
}

export = bufferExports
