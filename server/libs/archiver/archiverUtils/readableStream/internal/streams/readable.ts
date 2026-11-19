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
import type { EventEmitter } from 'node:events'
import type { Readable as NodeReadable } from 'node:stream'
import type { StringDecoder as Decoder } from 'node:string_decoder'
import type errors from '../../ours/errors'
import type BufferListType from './buffer_list'
import type destroy from './destroy'

type ManagedStream = Parameters<typeof destroy.construct>[0]
type Failure = Parameters<typeof errors.aggregateTwoErrors>[0]
type Callback = (error?: Failure) => void
type Signal = Parameters<typeof import('./add-abort-signal').addAbortSignal>[0]
type Debug = (...args: unknown[]) => void

interface Options {
  objectMode?: boolean
  readableObjectMode?: boolean
  highWaterMark?: number
  readableHighWaterMark?: number
  emitClose?: boolean
  autoDestroy?: boolean
  defaultEncoding?: BufferEncoding
  encoding?: BufferEncoding
  signal?: Signal
  read?: (this: ReadableStream, size: number) => void
  destroy?: ManagedStream['_destroy']
  construct?: ManagedStream['_construct']
}

interface Destination extends Pick<EventEmitter, 'on' | 'once' | 'emit' | 'removeListener' | 'listenerCount'> {
  _writableState?: NonNullable<ManagedStream['_writableState']> & { needDrain?: boolean }
  _readableState?: ManagedStream['_readableState']
  writableNeedDrain?: boolean
  write(chunk: unknown): boolean
  end(): unknown
}

interface Source extends NonNullable<Parameters<typeof destroy.destroyer>[0]> {
  on: EventEmitter['on']
  objectMode?: boolean
  readableObjectMode?: boolean
  pause?: () => unknown
  resume?: () => unknown
}

interface State extends NonNullable<ManagedStream['_readableState']> {
  objectMode: boolean
  highWaterMark: number
  buffer: BufferListType<unknown>
  length: number
  pipes: Destination[]
  flowing: boolean | null
  ended: boolean
  endEmitted: boolean
  reading: boolean
  constructed: boolean
  sync: boolean
  needReadable: boolean
  emittedReadable: boolean
  readableListening: boolean
  resumeScheduled: boolean
  [kPaused]: boolean | null
  errorEmitted: boolean
  emitClose: boolean
  autoDestroy: boolean
  destroyed: boolean
  errored: Failure
  closed: boolean
  closeEmitted: boolean
  defaultEncoding: BufferEncoding
  awaitDrainWriters: null | Destination | Set<Destination>
  multiAwaitDrain: boolean
  readingMore: boolean
  dataEmitted: boolean
  decoder: Decoder | null
  encoding: BufferEncoding | null
  readonly pipesCount: number
  paused: boolean
}

interface IteratorOptions {
  destroyOnReturn?: boolean
}

interface ReadableStream extends ManagedStream {
  on: EventEmitter['on']
  readableObjectMode: boolean
  req?: NonNullable<ManagedStream['req']> & NonNullable<Parameters<typeof import('./end-of-stream')>[0]['req']> | null
  _readableState: State
  destroyed: boolean
  allowHalfOpen?: boolean
  _read(size: number): void
  _undestroy(): void
  end(): unknown
  destroy(error?: Failure, callback?: Callback): this
  push(chunk: unknown, encoding?: BufferEncoding | ''): boolean
  unshift(chunk: unknown, encoding?: BufferEncoding | ''): boolean
  isPaused(): boolean
  setEncoding(encoding?: BufferEncoding): this
  read(size?: number): unknown
  pipe<T extends Destination>(dest: T, options?: { end?: boolean }): T
  unpipe(dest?: Destination): this
  addListener: EventEmitter['addListener']
  removeListener: EventEmitter['removeListener']
  off: EventEmitter['off']
  removeAllListeners: EventEmitter['removeAllListeners']
  resume(): this
  pause(): this
  wrap(stream: Source): this
  iterator(options?: IteratorOptions): AsyncGenerator<unknown>
  [Symbol.asyncIterator](): AsyncGenerator<unknown>
  [EventEmitter.captureRejectionSymbol](error: Failure): void
}

interface WebAdapters {
  newStreamReadableFromReadableStream: typeof NodeReadable.fromWeb
  newReadableStreamFromStreamReadable: typeof NodeReadable.toWeb
}

const load = createRequire(__filename)
const {
  ArrayPrototypeIndexOf,
  NumberIsInteger,
  NumberIsNaN,
  NumberParseInt,
  ObjectDefineProperties,
  ObjectKeys,
  ObjectSetPrototypeOf,
  Promise,
  SafeSet,
  SymbolAsyncIterator,
  Symbol
} = load('../../ours/primordials') as typeof import('../../ours/primordials')

const ReadableExport = Readable as unknown as {
  (this: ReadableStream, options?: Options | null): ReadableStream | void
  new (options?: Options | null): ReadableStream
  prototype: ReadableStream
  ReadableState: typeof StateExport
  _fromList: typeof fromList
  from(iterable: unknown, options?: Parameters<typeof from>[2]): NodeReadable
  fromWeb: typeof NodeReadable.fromWeb
  toWeb: typeof NodeReadable.toWeb
  wrap(source: Source, options?: Options): ReadableStream
}
const StateExport = ReadableState as unknown as {
  new (options: Options | null | undefined, stream: ReadableStream, isDuplex?: boolean): State
  prototype: State
}

module.exports = ReadableExport
ReadableExport.ReadableState = StateExport

const { EventEmitter: EE } = load('events') as typeof import('node:events')

const { Stream: LegacyStream, prependListener } = load('./legacy') as typeof import('./legacy')
const Stream = LegacyStream as typeof LegacyStream & Pick<typeof import('../../stream'), '_isUint8Array' | '_uint8ArrayToBuffer'>
const initializeStream = Stream as unknown as (this: ReadableStream, options?: Options | null) => void

const { addAbortSignal } = load('./add-abort-signal') as typeof import('./add-abort-signal')

const eos = load('./end-of-stream') as typeof import('./end-of-stream')

const { debuglog } = load('../../ours/util') as { debuglog: (section: string, update: (fn: Debug) => void) => Debug }
let debug = debuglog('stream', (fn) => {
  debug = fn
})

const BufferList = load('./buffer_list') as typeof BufferListType

const destroyImpl = load('./destroy') as typeof destroy

const { getHighWaterMark, getDefaultHighWaterMark } = load('./state') as typeof import('./state')

const {
  aggregateTwoErrors,
  codes: {
    ERR_INVALID_ARG_TYPE,
    ERR_METHOD_NOT_IMPLEMENTED,
    ERR_OUT_OF_RANGE,
    ERR_STREAM_PUSH_AFTER_EOF,
    ERR_STREAM_UNSHIFT_AFTER_END_EVENT
  }
} = load('../../ours/errors') as typeof errors

const { validateObject } = load('../validators') as typeof import('../validators')

const kPaused: unique symbol = Symbol('kPaused') as typeof kPaused

const { StringDecoder } = load('string_decoder') as typeof import('node:string_decoder')

const from = load('./from') as typeof import('./from')

ObjectSetPrototypeOf(ReadableExport.prototype, Stream.prototype)
ObjectSetPrototypeOf(Readable, Stream)

const nop = () => {}

const { errorOrDestroy } = destroyImpl

function ReadableState(this: State, options: Options | null | undefined, stream: ReadableStream, isDuplex?: boolean) {
  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof (load('./duplex') as typeof import('./duplex')) // Object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away.

  this.objectMode = !!(options && options.objectMode)
  if (isDuplex) this.objectMode = this.objectMode || !!(options && options.readableObjectMode) // The point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"

  this.highWaterMark = options
    ? getHighWaterMark(this, options, 'readableHighWaterMark', isDuplex)
    : getDefaultHighWaterMark(false) // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift().

  this.buffer = new BufferList()
  this.length = 0
  this.pipes = []
  this.flowing = null
  this.ended = false
  this.endEmitted = false
  this.reading = false // Stream is still being constructed and cannot be
  // destroyed until construction finished or failed.
  // Async construction is opt in, therefore we start as
  // constructed.

  this.constructed = true // A flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.

  this.sync = true // Whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.

  this.needReadable = false
  this.emittedReadable = false
  this.readableListening = false
  this.resumeScheduled = false
  this[kPaused] = null // True if the error was already emitted and should not be thrown again.

  this.errorEmitted = false // Should close be emitted on destroy. Defaults to true.

  this.emitClose = !options || options.emitClose !== false // Should .destroy() be called after 'end' (and potentially 'finish').

  this.autoDestroy = !options || options.autoDestroy !== false // Has it been destroyed.

  this.destroyed = false // Indicates whether the stream has errored. When true no further
  // _read calls, 'data' or 'readable' events should occur. This is needed
  // since when autoDestroy is disabled we need a way to tell whether the
  // stream has failed.

  this.errored = null // Indicates whether the stream has finished destroying.

  this.closed = false // True if close has been emitted or would have been emitted
  // depending on emitClose.

  this.closeEmitted = false // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.

  this.defaultEncoding = (options && options.defaultEncoding) || 'utf8' // Ref the piped dest which we need a drain event on it
  // type: null | Writable | Set<Writable>.

  this.awaitDrainWriters = null
  this.multiAwaitDrain = false // If true, a maybeReadMore has been scheduled.

  this.readingMore = false
  this.dataEmitted = false
  this.decoder = null
  this.encoding = null

  if (options && options.encoding) {
    this.decoder = new StringDecoder(options.encoding)
    this.encoding = options.encoding
  }
}

function Readable(this: ReadableStream, options?: Options | null): ReadableStream | void {
  if (!(this instanceof Readable)) return new ReadableExport(options) // Checking for a Stream.Duplex instance is faster here instead of inside
  // the ReadableState constructor, at least with V8 6.5.

  const isDuplex = this instanceof (load('./duplex') as typeof import('./duplex'))

  this._readableState = new StateExport(options, this, isDuplex)

  if (options) {
    if (typeof options.read === 'function') this._read = options.read
    if (typeof options.destroy === 'function') this._destroy = options.destroy
    if (typeof options.construct === 'function') this._construct = options.construct
    if (options.signal && !isDuplex) addAbortSignal(options.signal, this)
  }

  initializeStream.call(this, options)
  destroyImpl.construct(this, () => {
    if (this._readableState.needReadable) {
      maybeReadMore(this, this._readableState)
    }
  })
}

ReadableExport.prototype.destroy = destroyImpl.destroy
ReadableExport.prototype._undestroy = destroyImpl.undestroy

ReadableExport.prototype._destroy = function (err: Failure, cb: Callback) {
  cb(err)
}

ReadableExport.prototype[EE.captureRejectionSymbol] = function (err: Failure) {
  this.destroy(err)
} // Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.

ReadableExport.prototype.push = function (chunk: unknown, encoding?: BufferEncoding | '') {
  return readableAddChunk(this, chunk, encoding, false)
} // Unshift should *always* be something directly out of read().

ReadableExport.prototype.unshift = function (chunk: unknown, encoding?: BufferEncoding | '') {
  return readableAddChunk(this, chunk, encoding, true)
}

function readableAddChunk(stream: ReadableStream, chunk: unknown, encoding: BufferEncoding | '' | undefined, addToFront: boolean) {
  debug('readableAddChunk', chunk)
  const state = stream._readableState
  let err: Error | undefined

  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding

      if (state.encoding !== encoding) {
        if (addToFront && state.encoding) {
          // When unshifting, if state.encoding is set, we have to save
          // the string in the BufferList with the state encoding.
          chunk = Buffer.from(chunk, encoding).toString(state.encoding)
        } else {
          chunk = Buffer.from(chunk, encoding)
          encoding = ''
        }
      }
    } else if (chunk instanceof Buffer) {
      encoding = ''
    } else if (Stream._isUint8Array(chunk)) {
      chunk = Stream._uint8ArrayToBuffer(chunk)
      encoding = ''
    } else if (chunk != null) {
      err = new ERR_INVALID_ARG_TYPE!('chunk', ['string', 'Buffer', 'Uint8Array'], chunk)
    }
  }

  if (err) {
    errorOrDestroy(stream, err)
  } else if (chunk === null) {
    state.reading = false
    onEofChunk(stream, state)
  } else if (state.objectMode || (chunk && (chunk as Buffer | string).length > 0)) {
    if (addToFront) {
      if (state.endEmitted) errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT!())
      else if (state.destroyed || state.errored) return false
      else addChunk(stream, state, chunk, true)
    } else if (state.ended) {
      errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF!())
    } else if (state.destroyed || state.errored) {
      return false
    } else {
      state.reading = false

      if (state.decoder && !encoding) {
        const decoded = state.decoder.write(chunk as Buffer)
        if (state.objectMode || decoded.length !== 0) addChunk(stream, state, decoded, false)
        else maybeReadMore(stream, state)
      } else {
        addChunk(stream, state, chunk, false)
      }
    }
  } else if (!addToFront) {
    state.reading = false
    maybeReadMore(stream, state)
  } // We can push more data if we are below the highWaterMark.
  // Also, if we have no data yet, we can stand some more bytes.
  // This is to work around cases where hwm=0, such as the repl.

  return !state.ended && (state.length < state.highWaterMark || state.length === 0)
}

function addChunk(stream: ReadableStream, state: State, chunk: unknown, addToFront: boolean) {
  if (state.flowing && state.length === 0 && !state.sync && stream.listenerCount('data') > 0) {
    // Use the guard to avoid creating `Set()` repeatedly
    // when we have multiple pipes.
    if (state.multiAwaitDrain) {
      (state.awaitDrainWriters as Set<Destination>).clear()
    } else {
      state.awaitDrainWriters = null
    }

    state.dataEmitted = true
    stream.emit('data', chunk)
  } else {
    // Update the buffer info.
    state.length += state.objectMode ? 1 : (chunk as Buffer | string).length
    if (addToFront) state.buffer.unshift(chunk)
    else state.buffer.push(chunk)
    if (state.needReadable) emitReadable(stream)
  }

  maybeReadMore(stream, state)
}

ReadableExport.prototype.isPaused = function () {
  const state = this._readableState
  return state[kPaused] === true || state.flowing === false
} // Backwards compatibility.

ReadableExport.prototype.setEncoding = function (enc?: BufferEncoding) {
  const decoder = new StringDecoder(enc)
  this._readableState.decoder = decoder // If setEncoding(null), decoder.encoding equals utf8.

  this._readableState.encoding = (this._readableState.decoder as Decoder & { encoding: BufferEncoding }).encoding
  const buffer = this._readableState.buffer // Iterate over current buffer to convert already stored Buffers:

  let content = ''

  for (const data of buffer as BufferListType<unknown> & Iterable<unknown>) {
    content += decoder.write(data as Buffer)
  }

  buffer.clear()
  if (content !== '') buffer.push(content)
  this._readableState.length = content.length
  return this
} // Don't raise the hwm > 1GB.

const MAX_HWM = 0x40000000

function computeNewHighWaterMark(n: number) {
  if (n > MAX_HWM) {
    throw new ERR_OUT_OF_RANGE!('size', '<= 1GiB', n)
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts.
    n--
    n |= n >>> 1
    n |= n >>> 2
    n |= n >>> 4
    n |= n >>> 8
    n |= n >>> 16
    n++
  }

  return n
} // This function is designed to be inlinable, so please take care when making
// changes to the function body.

function howMuchToRead(n: number, state: State) {
  if (n <= 0 || (state.length === 0 && state.ended)) return 0
  if (state.objectMode) return 1

  if (NumberIsNaN(n)) {
    // Only flow one buffer at a time.
    if (state.flowing && state.length) return (state.buffer.first() as Buffer | string).length
    return state.length
  }

  if (n <= state.length) return n
  return state.ended ? state.length : 0
} // You can override either this method, or the async _read(n) below.

ReadableExport.prototype.read = function (n?: number) {
  debug('read', n) // Same as parseInt(undefined, 10), however V8 7.3 performance regressed
  // in this scenario, so we are doing it manually.

  if (n === undefined) {
    n = NaN
  } else if (!NumberIsInteger(n)) {
    n = NumberParseInt(n as unknown as string, 10)
  }

  const state = this._readableState
  const nOrig = n // If we're asking for more than the current hwm, then raise the hwm.

  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n)
  if (n !== 0) state.emittedReadable = false // If we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.

  if (
    n === 0 &&
    state.needReadable &&
    ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)
  ) {
    debug('read: emitReadable', state.length, state.ended)
    if (state.length === 0 && state.ended) endReadable(this)
    else emitReadable(this)
    return null
  }

  n = howMuchToRead(n, state) // If we've ended, and we're now clear, then finish it up.

  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this)
    return null
  } // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.
  // if we need a readable event, then we need to do some reading.

  let doRead = state.needReadable
  debug('need readable', doRead) // If we currently have less than the highWaterMark, then also read some.

  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true
    debug('length less than watermark', doRead)
  } // However, if we've ended, then there's no point, if we're already
  // reading, then it's unnecessary, if we're constructing we have to wait,
  // and if we're destroyed or errored, then it's not allowed,

  if (state.ended || state.reading || state.destroyed || state.errored || !state.constructed) {
    doRead = false
    debug('reading, ended or constructing', doRead)
  } else if (doRead) {
    debug('do read')
    state.reading = true
    state.sync = true // If the length is currently zero, then we *need* a readable event.

    if (state.length === 0) state.needReadable = true // Call internal read method

    try {
      this._read(state.highWaterMark)
    } catch (err) {
      errorOrDestroy(this, err as Failure)
    }

    state.sync = false // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.

    if (!state.reading) n = howMuchToRead(nOrig, state)
  }

  let ret: unknown
  if (n > 0) ret = fromList(n, state)
  else ret = null

  if (ret === null) {
    state.needReadable = state.length <= state.highWaterMark
    n = 0
  } else {
    state.length -= n

    if (state.multiAwaitDrain) {
      (state.awaitDrainWriters as Set<Destination>).clear()
    } else {
      state.awaitDrainWriters = null
    }
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true // If we tried to read() past the EOF, then emit end on the next tick.

    if (nOrig !== n && state.ended) endReadable(this)
  }

  if (ret !== null && !state.errorEmitted && !state.closeEmitted) {
    state.dataEmitted = true
    this.emit('data', ret)
  }

  return ret
}

function onEofChunk(stream: ReadableStream, state: State) {
  debug('onEofChunk')
  if (state.ended) return

  if (state.decoder) {
    const chunk = state.decoder.end()

    if (chunk && chunk.length) {
      state.buffer.push(chunk)
      state.length += state.objectMode ? 1 : chunk.length
    }
  }

  state.ended = true

  if (state.sync) {
    // If we are sync, wait until next tick to emit the data.
    // Otherwise we risk emitting data in the flow()
    // the readable code triggers during a read() call.
    emitReadable(stream)
  } else {
    // Emit 'readable' now to make sure it gets picked up.
    state.needReadable = false
    state.emittedReadable = true // We have to emit readable now that we are EOF. Modules
    // in the ecosystem (e.g. dicer) rely on this event being sync.

    emitReadable_(stream)
  }
} // Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.

function emitReadable(stream: ReadableStream) {
  const state = stream._readableState
  debug('emitReadable', state.needReadable, state.emittedReadable)
  state.needReadable = false

  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing)
    state.emittedReadable = true
    process.nextTick(emitReadable_, stream)
  }
}

function emitReadable_(stream: ReadableStream) {
  const state = stream._readableState
  debug('emitReadable_', state.destroyed, state.length, state.ended)

  if (!state.destroyed && !state.errored && (state.length || state.ended)) {
    stream.emit('readable')
    state.emittedReadable = false
  } // The stream needs another readable event if:
  // 1. It is not flowing, as the flow mechanism will take
  //    care of it.
  // 2. It is not ended.
  // 3. It is below the highWaterMark, so we can schedule
  //    another readable later.

  state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark
  flow(stream)
} // At this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.

function maybeReadMore(stream: ReadableStream, state: State) {
  if (!state.readingMore && state.constructed) {
    state.readingMore = true
    process.nextTick(maybeReadMore_, stream, state)
  }
}

function maybeReadMore_(stream: ReadableStream, state: State) {
  // Attempt to read more data if we should.
  //
  // The conditions for reading more data are (one of):
  // - Not enough data buffered (state.length < state.highWaterMark). The loop
  //   is responsible for filling the buffer with enough data if such data
  //   is available. If highWaterMark is 0 and we are not in the flowing mode
  //   we should _not_ attempt to buffer any extra data. We'll get more data
  //   when the stream consumer calls read() instead.
  // - No data in the buffer, and the stream is in flowing mode. In this mode
  //   the loop below is responsible for ensuring read() is called. Failing to
  //   call read here would abort the flow and there's no other mechanism for
  //   continuing the flow if the stream consumer has just subscribed to the
  //   'data' event.
  //
  // In addition to the above conditions to keep reading data, the following
  // conditions prevent the data from being read:
  // - The stream has ended (state.ended).
  // - There is already a pending 'read' operation (state.reading). This is a
  //   case where the stream has called the implementation defined _read()
  //   method, but they are processing the call asynchronously and have _not_
  //   called push() with new data. In this case we skip performing more
  //   read()s. The execution ends in this method again after the _read() ends
  //   up calling push() with more data.
  while (
    !state.reading &&
    !state.ended &&
    (state.length < state.highWaterMark || (state.flowing && state.length === 0))
  ) {
    const len = state.length
    debug('maybeReadMore read 0')
    stream.read(0)
    if (len === state.length)
      // Didn't get any data, stop spinning.
      break
  }

  state.readingMore = false
} // Abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.

ReadableExport.prototype._read = function (n: number) {
  void n
  throw new ERR_METHOD_NOT_IMPLEMENTED!('_read()')
}

ReadableExport.prototype.pipe = function <T extends Destination>(this: ReadableStream, dest: T, pipeOpts?: { end?: boolean }) {
  const state = this._readableState

  if (state.pipes.length === 1) {
    if (!state.multiAwaitDrain) {
      state.multiAwaitDrain = true
      state.awaitDrainWriters = new SafeSet(state.awaitDrainWriters ? [state.awaitDrainWriters as Destination] : [])
    }
  }

  state.pipes.push(dest)
  debug('pipe count=%d opts=%j', state.pipes.length, pipeOpts)
  const stdio: { stdout: unknown; stderr: unknown } = process
  const doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== stdio.stdout && dest !== stdio.stderr
  const unpipe = () => {
    debug('unpipe')
    this.unpipe(dest)
  }
  const onunpipe = (readable: ReadableStream, unpipeInfo?: { hasUnpiped: boolean }) => {
    debug('onunpipe')

    if (readable === this) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true
        cleanup()
      }
    }
  }

  function onend() {
    debug('onend')
    dest.end()
  }

  const cleanup = () => {
    debug('cleanup') // Cleanup event handlers once the pipe is broken.

    dest.removeListener('close', onclose)
    dest.removeListener('finish', onfinish)

    if (ondrain) {
      dest.removeListener('drain', ondrain)
    }

    dest.removeListener('error', onerror)
    dest.removeListener('unpipe', onunpipe)
    this.removeListener('end', onend)
    this.removeListener('end', unpipe)
    this.removeListener('data', ondata)
    cleanedUp = true // If the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.

    if (ondrain && state.awaitDrainWriters && (!dest._writableState || dest._writableState.needDrain)) ondrain()
  }

  const pause = () => {
    // If the user unpiped during `dest.write()`, it is possible
    // to get stuck in a permanently paused state if that write
    // also returned false.
    // => Check whether `dest` is still a piping destination.
    if (!cleanedUp) {
      if (state.pipes.length === 1 && state.pipes[0] === dest) {
        debug('false write response, pause', 0)
        state.awaitDrainWriters = dest
        state.multiAwaitDrain = false
      } else if (state.pipes.length > 1 && state.pipes.includes(dest)) {
        const writers = state.awaitDrainWriters as Set<Destination>
        debug('false write response, pause', writers.size)
        writers.add(dest)
      }

      this.pause()
    }

    if (!ondrain) {
      // When the dest drains, it reduces the awaitDrain counter
      // on the source.  This would be more elegant with a .once()
      // handler in flow(), but adding and removing repeatedly is
      // too slow.
      ondrain = pipeOnDrain(this, dest)
      dest.on('drain', ondrain)
    }
  }

  const ondata = (chunk: unknown) => {
    debug('ondata')
    const ret = dest.write(chunk)
    debug('dest.write', ret)

    if (ret === false) {
      pause()
    }
  } // If the dest has an error, then stop piping into it.
  // However, don't suppress the throwing behavior for this.

  function onerror(er: unknown) {
    debug('onerror', er)
    unpipe()
    dest.removeListener('error', onerror)

    if (dest.listenerCount('error') === 0) {
      const s = dest._writableState || dest._readableState

      if (s && !s.errorEmitted) {
        // User incorrectly emitted 'error' directly on the stream.
        errorOrDestroy(dest as unknown as ManagedStream, er as Failure)
      } else {
        dest.emit('error', er)
      }
    }
  } // Make sure our error handler is attached before userland ones.

  const endFn = doEnd ? onend : unpipe
  if (state.endEmitted) process.nextTick(endFn)
  else this.once('end', endFn)
  dest.on('unpipe', onunpipe)

  let ondrain: (() => void) | undefined
  let cleanedUp = false

  this.on('data', ondata)

  prependListener(dest, 'error', onerror) // Both close and finish should trigger unpipe, but only once.

  function onclose() {
    dest.removeListener('finish', onfinish)
    unpipe()
  }

  dest.once('close', onclose)

  function onfinish() {
    debug('onfinish')
    dest.removeListener('close', onclose)
    unpipe()
  }

  dest.once('finish', onfinish) // Tell the dest that it's being piped to.

  dest.emit('pipe', this) // Start the flow if it hasn't been started already.

  if (dest.writableNeedDrain === true) {
    if (state.flowing) {
      pause()
    }
  } else if (!state.flowing) {
    debug('pipe resume')
    this.resume()
  }

  return dest
}

function pipeOnDrain(src: ReadableStream, dest: Destination) {
  return function pipeOnDrainFunctionResult() {
    const state = src._readableState // `ondrain` will call directly,
    // `this` maybe not a reference to dest,
    // so we use the real dest here.

    if (state.awaitDrainWriters === dest) {
      debug('pipeOnDrain', 1)
      state.awaitDrainWriters = null
    } else if (state.multiAwaitDrain) {
      const writers = state.awaitDrainWriters as Set<Destination>
      debug('pipeOnDrain', writers.size)
      writers.delete(dest)
    }

    if ((!state.awaitDrainWriters || (state.awaitDrainWriters as { size?: number }).size === 0) && src.listenerCount('data')) {
      src.resume()
    }
  }
}

ReadableExport.prototype.unpipe = function (dest?: Destination) {
  const state = this._readableState
  const unpipeInfo = {
    hasUnpiped: false
  } // If we're not piping anywhere, then do nothing.

  if (state.pipes.length === 0) return this

  if (!dest) {
    // remove all.
    const dests = state.pipes
    state.pipes = []
    this.pause()

    for (let i = 0; i < dests.length; i++)
      dests[i].emit('unpipe', this, {
        hasUnpiped: false
      })

    return this
  } // Try to find the right one.

  const index = ArrayPrototypeIndexOf(state.pipes, dest)
  if (index === -1) return this
  state.pipes.splice(index, 1)
  if (state.pipes.length === 0) this.pause()
  dest.emit('unpipe', this, unpipeInfo)
  return this
} // Set up data events if they are asked for
// Ensure readable listeners eventually get something.

ReadableExport.prototype.on = function (ev, fn) {
  const res = Stream.prototype.on.call(this, ev, fn)
  const state = this._readableState

  if (ev === 'data') {
    // Update readableListening so that resume() may be a no-op
    // a few lines down. This is needed to support once('readable').
    state.readableListening = this.listenerCount('readable') > 0 // Try start flowing on next tick if stream isn't explicitly paused.

    if (state.flowing !== false) this.resume()
  } else if (ev === 'readable') {
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true
      state.flowing = false
      state.emittedReadable = false
      debug('on readable', state.length, state.reading)

      if (state.length) {
        emitReadable(this)
      } else if (!state.reading) {
        process.nextTick(nReadingNextTick, this)
      }
    }
  }

  return res
}

ReadableExport.prototype.addListener = ReadableExport.prototype.on

ReadableExport.prototype.removeListener = function (ev, fn) {
  const res = Stream.prototype.removeListener.call(this, ev, fn)

  if (ev === 'readable') {
    // We need to check if there is someone still listening to
    // readable and reset the state. However this needs to happen
    // after readable has been emitted but before I/O (nextTick) to
    // support once('readable', fn) cycles. This means that calling
    // resume within the same tick will have no
    // effect.
    process.nextTick(updateReadableListening, this)
  }

  return res
}

ReadableExport.prototype.off = ReadableExport.prototype.removeListener

ReadableExport.prototype.removeAllListeners = function (ev) {
  const res = Stream.prototype.removeAllListeners.apply(this, arguments as unknown as [event?: string | symbol])

  if (ev === 'readable' || ev === undefined) {
    // We need to check if there is someone still listening to
    // readable and reset the state. However this needs to happen
    // after readable has been emitted but before I/O (nextTick) to
    // support once('readable', fn) cycles. This means that calling
    // resume within the same tick will have no
    // effect.
    process.nextTick(updateReadableListening, this)
  }

  return res
}

function updateReadableListening(self: ReadableStream) {
  const state = self._readableState
  state.readableListening = self.listenerCount('readable') > 0

  if (state.resumeScheduled && state[kPaused] === false) {
    // Flowing needs to be set to true now, otherwise
    // the upcoming resume will not flow.
    state.flowing = true // Crude way to check if we should resume.
  } else if (self.listenerCount('data') > 0) {
    self.resume()
  } else if (!state.readableListening) {
    state.flowing = null
  }
}

function nReadingNextTick(self: ReadableStream) {
  debug('readable nexttick read 0')
  self.read(0)
} // pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.

ReadableExport.prototype.resume = function () {
  const state = this._readableState

  if (!state.flowing) {
    debug('resume') // We flow only if there is no one listening
    // for readable, but we still have to call
    // resume().

    state.flowing = !state.readableListening
    resume(this, state)
  }

  state[kPaused] = false
  return this
}

function resume(stream: ReadableStream, state: State) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true
    process.nextTick(resume_, stream, state)
  }
}

function resume_(stream: ReadableStream, state: State) {
  debug('resume', state.reading)

  if (!state.reading) {
    stream.read(0)
  }

  state.resumeScheduled = false
  stream.emit('resume')
  flow(stream)
  if (state.flowing && !state.reading) stream.read(0)
}

ReadableExport.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing)

  if (this._readableState.flowing !== false) {
    debug('pause')
    this._readableState.flowing = false
    this.emit('pause')
  }

  this._readableState[kPaused] = true
  return this
}

function flow(stream: ReadableStream) {
  const state = stream._readableState
  debug('flow', state.flowing)

  while (state.flowing && stream.read() !== null);
} // Wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.

ReadableExport.prototype.wrap = function (stream: Source) {
  let paused = false // TODO (ronag): Should this.destroy(err) emit
  // 'error' on the wrapped stream? Would require
  // a static factory method, e.g. Readable.wrap(stream).

  stream.on('data', (chunk) => {
    if (!this.push(chunk) && stream.pause) {
      paused = true
      stream.pause()
    }
  })
  stream.on('end', () => {
    this.push(null)
  })
  stream.on('error', (err) => {
    errorOrDestroy(this, err as Failure)
  })
  stream.on('close', () => {
    this.destroy()
  })
  stream.on('destroy', () => {
    this.destroy()
  })

  this._read = () => {
    if (paused && stream.resume) {
      paused = false
      stream.resume()
    }
  } // Proxy all the other methods. Important when wrapping filters and duplexes.

  const sourceProperties = stream as unknown as Record<string, unknown>
  const wrappedProperties = this as unknown as Record<string, unknown>
  const streamKeys = ObjectKeys(stream)

  for (let j = 1; j < streamKeys.length; j++) {
    const i = streamKeys[j]

    if (wrappedProperties[i] === undefined && typeof sourceProperties[i] === 'function') {
      wrappedProperties[i] = (sourceProperties[i] as (...args: unknown[]) => unknown).bind(stream)
    }
  }

  return this
}

ReadableExport.prototype[SymbolAsyncIterator as typeof globalThis.Symbol.asyncIterator] = function () {
  return streamToAsyncIterator(this)
}

ReadableExport.prototype.iterator = function (options) {
  if (options !== undefined) {
    validateObject(options, 'options')
  }

  return streamToAsyncIterator(this, options)
}

function streamToAsyncIterator(stream: ReadableStream, options?: IteratorOptions) {
  if (typeof stream.read !== 'function') {
    stream = ReadableExport.wrap(stream, {
      objectMode: true
    })
  }

  const iter: AsyncGenerator<unknown> & { stream?: ReadableStream } = createAsyncIterator(stream, options)
  iter.stream = stream
  return iter
}

async function* createAsyncIterator(stream: ReadableStream, options?: IteratorOptions) {
  let callback: () => void = nop

  function next(this: unknown, resolve: () => void) {
    if (this === stream) {
      callback()
      callback = nop
    } else {
      callback = resolve
    }
  }

  stream.on('readable', next)
  let error: Failure
  const cleanup = eos(
    stream,
    {
      writable: false
    },
    (err) => {
      error = err ? aggregateTwoErrors(error, err) : null
      callback()
      callback = nop
    }
  )

  try {
    while (true) {
      const chunk = stream.destroyed ? null : stream.read()

      if (chunk !== null) {
        yield chunk
      } else if (error) {
        throw error as Error
      } else if (error === null) {
        return
      } else {
        await new Promise<void>(next)
      }
    }
  } catch (err) {
    error = aggregateTwoErrors(error, err as Failure)
    throw error as Error
  } finally {
    if (
      (error || (options === null || options === undefined ? undefined : options.destroyOnReturn) !== false) &&
      (error === undefined || stream._readableState.autoDestroy)
    ) {
      destroyImpl.destroyer(stream, null)
    } else {
      stream.off('readable', next)
      cleanup()
    }
  }
} // Making it explicit these properties are not enumerable
// because otherwise some prototype manipulation in
// userland will fail.

ObjectDefineProperties(ReadableExport.prototype, {
  readable: {
    get(this: ReadableStream) {
      const r = this._readableState // r.readable === false means that this is part of a Duplex stream
      // where the readable side was disabled upon construction.
      // Compat. The user might manually disable readable side through
      // deprecated setter.

      return !!r && r.readable !== false && !r.destroyed && !r.errorEmitted && !r.endEmitted
    },

    set(this: ReadableStream, val: unknown) {
      // Backwards compat.
      if (this._readableState) {
        this._readableState.readable = !!val
      }
    }
  },
  readableDidRead: {
    enumerable: false,
    get: function (this: ReadableStream) {
      return this._readableState.dataEmitted
    }
  },
  readableAborted: {
    enumerable: false,
    get: function (this: ReadableStream) {
      return !!(
        this._readableState.readable !== false &&
        (this._readableState.destroyed || this._readableState.errored) &&
        !this._readableState.endEmitted
      )
    }
  },
  readableHighWaterMark: {
    enumerable: false,
    get: function (this: ReadableStream) {
      return this._readableState.highWaterMark
    }
  },
  readableBuffer: {
    enumerable: false,
    get: function (this: ReadableStream) {
      return this._readableState && this._readableState.buffer
    }
  },
  readableFlowing: {
    enumerable: false,
    get: function (this: ReadableStream) {
      return this._readableState.flowing
    },
    set: function (this: ReadableStream, state: boolean | null) {
      if (this._readableState) {
        this._readableState.flowing = state
      }
    }
  },
  readableLength: {
    enumerable: false,

    get(this: ReadableStream) {
      return this._readableState.length
    }
  },
  readableObjectMode: {
    enumerable: false,

    get(this: ReadableStream) {
      return this._readableState ? this._readableState.objectMode : false
    }
  },
  readableEncoding: {
    enumerable: false,

    get(this: ReadableStream) {
      return this._readableState ? this._readableState.encoding : null
    }
  },
  errored: {
    enumerable: false,

    get(this: ReadableStream) {
      return this._readableState ? this._readableState.errored : null
    }
  },
  closed: {
    get(this: ReadableStream) {
      return this._readableState ? this._readableState.closed : false
    }
  },
  destroyed: {
    enumerable: false,

    get(this: ReadableStream) {
      return this._readableState ? this._readableState.destroyed : false
    },

    set(this: ReadableStream, value: boolean) {
      // We ignore the value if the stream
      // has not been initialized yet.
      if (!this._readableState) {
        return
      } // Backward compatibility, the user is explicitly
      // managing destroyed.

      this._readableState.destroyed = value
    }
  },
  readableEnded: {
    enumerable: false,

    get(this: ReadableStream) {
      return this._readableState ? this._readableState.endEmitted : false
    }
  }
})
ObjectDefineProperties(StateExport.prototype, {
  // Legacy getter for `pipesCount`.
  pipesCount: {
    get(this: State) {
      return this.pipes.length
    }
  },
  // Legacy property for `paused`.
  paused: {
    get(this: State) {
      return this[kPaused] !== false
    },

    set(this: State, value: unknown) {
      this[kPaused] = !!value
    }
  }
}) // Exposed for testing purposes only.

ReadableExport._fromList = fromList // Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.

function fromList(n: number, state: State) {
  // nothing buffered.
  if (state.length === 0) return null
  let ret: unknown
  if (state.objectMode) ret = state.buffer.shift()
  else if (!n || n >= state.length) {
    // Read it all, truncate the list.
    if (state.decoder) ret = state.buffer.join('')
    else if (state.buffer.length === 1) ret = state.buffer.first()
    else ret = (state.buffer as BufferListType<Buffer>).concat(state.length)
    state.buffer.clear()
  } else {
    // read part of list.
    ret = (state.buffer as BufferListType<Buffer | string>).consume(n, state.decoder as unknown as boolean)
  }
  return ret
}

function endReadable(stream: ReadableStream) {
  const state = stream._readableState
  debug('endReadable', state.endEmitted)

  if (!state.endEmitted) {
    state.ended = true
    process.nextTick(endReadableNT, state, stream)
  }
}

function endReadableNT(state: State, stream: ReadableStream) {
  debug('endReadableNT', state.endEmitted, state.length) // Check that we didn't get one last unshift.

  if (!state.errored && !state.closeEmitted && !state.endEmitted && state.length === 0) {
    state.endEmitted = true
    stream.emit('end')

    if (stream.writable && stream.allowHalfOpen === false) {
      process.nextTick(endWritableNT, stream)
    } else if (state.autoDestroy) {
      // In case of duplex streams we need a way to detect
      // if the writable side is ready for autoDestroy as well.
      const wState = stream._writableState
      const autoDestroy =
        !wState ||
        (wState.autoDestroy && // We don't expect the writable to ever 'finish'
          // if writable is explicitly set to false.
          (wState.finished || wState.writable === false))

      if (autoDestroy) {
        stream.destroy()
      }
    }
  }
}

function endWritableNT(stream: ReadableStream) {
  const writable = stream.writable && !stream.writableEnded && !stream.destroyed

  if (writable) {
    stream.end()
  }
}

ReadableExport.from = function (iterable, opts) {
  return from(ReadableExport as unknown as new (options: NonNullable<Parameters<typeof from>[2]>) => NodeReadable, iterable, opts)
}

let webStreamsAdapters: Partial<WebAdapters> | undefined // Lazy to avoid circular references

function lazyWebStreams() {
  if (webStreamsAdapters === undefined) webStreamsAdapters = {}
  return webStreamsAdapters
}

ReadableExport.fromWeb = function (readableStream, options) {
  return lazyWebStreams().newStreamReadableFromReadableStream!(readableStream, options)
}

ReadableExport.toWeb = function (streamReadable) {
  return lazyWebStreams().newReadableStreamFromStreamReadable!(streamReadable)
}

ReadableExport.wrap = function (src, options) {
  let _ref: boolean | undefined, _src$readableObjectMo: boolean | undefined

  return new ReadableExport({
    objectMode:
      (_ref =
        (_src$readableObjectMo = src.readableObjectMode) !== null && _src$readableObjectMo !== undefined
          ? _src$readableObjectMo
          : src.objectMode) !== null && _ref !== undefined
        ? _ref
        : true,
    ...options,

    destroy(err, callback) {
      destroyImpl.destroyer(src, err)
      callback(err)
    }
  }).wrap(src)
}

export = ReadableExport
