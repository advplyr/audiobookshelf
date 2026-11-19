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
import { createRequire } from 'node:module'
import type { Readable, Writable } from 'node:stream'
import type composeStream from './internal/streams/compose'
import type abortSignal from './internal/streams/add-abort-signal'
import type teardown from './internal/streams/destroy'
import type Duplex from './internal/streams/duplex'
import type eos from './internal/streams/end-of-stream'
import type legacy from './internal/streams/legacy'
import type PassThrough from './internal/streams/passthrough'
import type pipelineApi from './internal/streams/pipeline'
import type Transform from './internal/streams/transform'
import type streamUtils from './internal/streams/utils'
import type streamPromises from './stream/promises'

type Operator<Result> = (this: Readable, ...args: unknown[]) => Result
type LegacyStream = typeof legacy.Stream
type ComposedStream = LegacyStream & {
  isDisturbed: typeof streamUtils.isDisturbed
  isErrored: typeof streamUtils.isErrored
  isReadable: typeof streamUtils.isReadable
  Readable: typeof Readable
  Writable: typeof Writable
  Duplex: typeof Duplex
  Transform: typeof Transform
  PassThrough: typeof PassThrough
  pipeline: typeof pipelineApi.pipeline
  addAbortSignal: typeof abortSignal.addAbortSignal
  finished: typeof eos
  destroy: typeof teardown.destroyer
  compose: typeof composeStream
  promises: typeof streamPromises
  Stream: ComposedStream
  _isUint8Array: (value: unknown) => value is Uint8Array
  _uint8ArrayToBuffer: (chunk: Uint8Array) => Buffer
}

declare const module: { exports: unknown }

// The stream implementation has circular dependencies. Keep their load order.
const load = createRequire(__filename)
const { ObjectDefineProperty, ObjectKeys, ReflectApply } = load('./ours/primordials') as typeof import('./ours/primordials')

const {
  promisify: { custom: customPromisify }
} = load('./ours/util') as typeof import('./ours/util')

const { streamReturningOperators, promiseReturningOperators } = load('./internal/streams/operators') as {
  streamReturningOperators: Record<string, Operator<Iterable<unknown> | AsyncIterable<unknown>>>
  promiseReturningOperators: Record<string, Operator<unknown>>
}

const {
  codes: { ERR_ILLEGAL_CONSTRUCTOR }
} = load('./ours/errors') as typeof import('./ours/errors') & { codes: { ERR_ILLEGAL_CONSTRUCTOR?: () => Error } }

const compose = load('./internal/streams/compose') as typeof composeStream
const { pipeline } = load('./internal/streams/pipeline') as typeof pipelineApi
const { destroyer } = load('./internal/streams/destroy') as typeof teardown
const finished = load('./internal/streams/end-of-stream') as typeof eos
const promises = load('./stream/promises') as typeof streamPromises
const utils = load('./internal/streams/utils') as typeof streamUtils
const Stream = (module.exports = (load('./internal/streams/legacy') as typeof legacy).Stream) as ComposedStream

Stream.isDisturbed = utils.isDisturbed
Stream.isErrored = utils.isErrored
Stream.isReadable = utils.isReadable
Stream.Readable = load('./internal/streams/readable') as typeof Readable

for (const key of ObjectKeys(streamReturningOperators)) {
  const op = streamReturningOperators[key]

  function fn(this: Readable, ...args: unknown[]) {
    if (new.target) {
      throw ERR_ILLEGAL_CONSTRUCTOR!()
    }

    return Stream.Readable.from(ReflectApply(op, this, args))
  }

  ObjectDefineProperty(fn, 'name', {
    value: op.name
  })
  ObjectDefineProperty(fn, 'length', {
    value: op.length
  })
  ObjectDefineProperty(Stream.Readable.prototype, key, {
    value: fn,
    enumerable: false,
    configurable: true,
    writable: true
  })
}

for (const key of ObjectKeys(promiseReturningOperators)) {
  const op = promiseReturningOperators[key]

  function fn(this: Readable, ...args: unknown[]) {
    if (new.target) {
      throw ERR_ILLEGAL_CONSTRUCTOR!()
    }

    return ReflectApply(op, this, args)
  }

  ObjectDefineProperty(fn, 'name', {
    value: op.name
  })
  ObjectDefineProperty(fn, 'length', {
    value: op.length
  })
  ObjectDefineProperty(Stream.Readable.prototype, key, {
    value: fn,
    enumerable: false,
    configurable: true,
    writable: true
  })
}

Stream.Writable = load('./internal/streams/writable') as typeof Writable
Stream.Duplex = load('./internal/streams/duplex') as typeof Duplex
Stream.Transform = load('./internal/streams/transform') as typeof Transform
Stream.PassThrough = load('./internal/streams/passthrough') as typeof PassThrough
Stream.pipeline = pipeline

const { addAbortSignal } = load('./internal/streams/add-abort-signal') as typeof abortSignal

Stream.addAbortSignal = addAbortSignal
Stream.finished = finished
Stream.destroy = destroyer
Stream.compose = compose
ObjectDefineProperty(Stream, 'promises', {
  configurable: true,
  enumerable: true,

  get() {
    return promises
  }
})
ObjectDefineProperty(pipeline, customPromisify, {
  enumerable: true,

  get() {
    return promises.pipeline
  }
})
ObjectDefineProperty(finished, customPromisify, {
  enumerable: true,

  get() {
    return promises.finished
  }
}) // Backwards-compat with node 0.4.x

Stream.Stream = Stream

Stream._isUint8Array = function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array
}

Stream._uint8ArrayToBuffer = function _uint8ArrayToBuffer(chunk: Uint8Array) {
  return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
}

export = Stream
