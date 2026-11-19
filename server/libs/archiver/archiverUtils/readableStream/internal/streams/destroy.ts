import type { EventEmitter } from 'node:events'
import errors from '../../ours/errors'
import primordials from '../../ours/primordials'
import utils from './utils'

type StreamProbe = NonNullable<Parameters<typeof utils.isDestroyed>[0]>
type StreamState = NonNullable<StreamProbe['_readableState']> & {
  constructed?: boolean
  closeEmitted?: boolean
  reading?: boolean
  finalCalled?: boolean
  prefinished?: boolean
  ending?: boolean
}
type Failure = Parameters<typeof errors.aggregateTwoErrors>[0]
type Callback = (error?: Failure) => void

interface RequestLike {
  setHeader?: unknown
  abort?: () => unknown
}

type StreamEvents = Pick<EventEmitter, 'emit' | 'once' | 'listenerCount'>

interface LegacyStream extends StreamProbe, StreamEvents, RequestLike {
  [kDestroyed]?: boolean
  destroy?(error?: Failure): unknown
  close?: () => unknown
  req?: (RequestLike & { upgradeOrConnect?: unknown }) | null
  socket?: unknown
}

interface ManagedStream extends LegacyStream {
  _readableState?: StreamState | null
  _writableState?: StreamState | null
  _construct?: (callback: Callback) => void
  _destroy(error: Failure, callback: Callback): void
  destroy(error?: Failure): unknown
}

const {
  aggregateTwoErrors,
  codes: { ERR_MULTIPLE_CALLBACK },
  AbortError
} = errors

const { Symbol } = primordials

const { isDestroyed, isFinished, isServerRequest } = utils
const kDestroyed: unique symbol = utils.kDestroyed as typeof kDestroyed

const kDestroy = Symbol('kDestroy')
const kConstruct = Symbol('kConstruct')

function checkError(err: Failure, w?: StreamState | null, r?: StreamState | null) {
  if (err) {
    // Avoid V8 leak, https://github.com/nodejs/node/pull/34103#issuecomment-652002364
    void err.stack

    if (w && !w.errored) {
      w.errored = err
    }

    if (r && !r.errored) {
      r.errored = err
    }
  }
} // Backwards compat. cb() is undocumented and unused in core but
// unfortunately might be used by modules.

function destroy<Stream extends ManagedStream>(this: Stream, err?: Failure, cb?: Callback): Stream {
  const r = this._readableState
  const w = this._writableState // With duplex streams we use the writable side for state.

  const s = w || r

  if ((w && w.destroyed) || (r && r.destroyed)) {
    if (typeof cb === 'function') {
      cb()
    }

    return this
  } // We set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  checkError(err, w, r)

  if (w) {
    w.destroyed = true
  }

  if (r) {
    r.destroyed = true
  } // If still constructing then defer calling _destroy.

  if (!s!.constructed) {
    this.once(kDestroy, function (this: ManagedStream, er?: Failure) {
      _destroy(this, aggregateTwoErrors(er, err), cb)
    })
  } else {
    _destroy(this, err, cb)
  }

  return this
}

function _destroy(self: ManagedStream, err: Failure, cb?: Callback) {
  let called = false

  function onDestroy(err?: Failure) {
    if (called) {
      return
    }

    called = true
    const r = self._readableState
    const w = self._writableState
    checkError(err, w, r)

    if (w) {
      w.closed = true
    }

    if (r) {
      r.closed = true
    }

    if (typeof cb === 'function') {
      cb(err)
    }

    if (err) {
      process.nextTick(emitErrorCloseNT, self, err)
    } else {
      process.nextTick(emitCloseNT, self)
    }
  }

  try {
    self._destroy(err || null, onDestroy)
  } catch (err) {
    onDestroy(err as Failure)
  }
}

function emitErrorCloseNT(self: ManagedStream, err: Failure) {
  emitErrorNT(self, err)
  emitCloseNT(self)
}

function emitCloseNT(self: ManagedStream) {
  const r = self._readableState
  const w = self._writableState

  if (w) {
    w.closeEmitted = true
  }

  if (r) {
    r.closeEmitted = true
  }

  if ((w && w.emitClose) || (r && r.emitClose)) {
    self.emit('close')
  }
}

function emitErrorNT(self: ManagedStream, err: Failure) {
  const r = self._readableState
  const w = self._writableState

  if ((w && w.errorEmitted) || (r && r.errorEmitted)) {
    return
  }

  if (w) {
    w.errorEmitted = true
  }

  if (r) {
    r.errorEmitted = true
  }

  self.emit('error', err)
}

function undestroy(this: ManagedStream) {
  const r = this._readableState
  const w = this._writableState

  if (r) {
    r.constructed = true
    r.closed = false
    r.closeEmitted = false
    r.destroyed = false
    r.errored = null
    r.errorEmitted = false
    r.reading = false
    r.ended = r.readable === false
    r.endEmitted = r.readable === false
  }

  if (w) {
    w.constructed = true
    w.destroyed = false
    w.closed = false
    w.closeEmitted = false
    w.errored = null
    w.errorEmitted = false
    w.finalCalled = false
    w.prefinished = false
    w.ended = w.writable === false
    w.ending = w.writable === false
    w.finished = w.writable === false
  }
}

function errorOrDestroy(this: unknown, stream: ManagedStream, err: Failure, sync?: boolean) {
  // We have tests that rely on errors being emitted
  // in the same tick, so changing this is semver major.
  // For now when you opt-in to autoDestroy we allow
  // the error to be emitted nextTick. In a future
  // semver major update we should change the default to this.
  const r = stream._readableState
  const w = stream._writableState

  if ((w && w.destroyed) || (r && r.destroyed)) {
    return this
  }

  if ((r && r.autoDestroy) || (w && w.autoDestroy)) stream.destroy(err)
  else if (err) {
    // Avoid V8 leak, https://github.com/nodejs/node/pull/34103#issuecomment-652002364
    void err.stack

    if (w && !w.errored) {
      w.errored = err
    }

    if (r && !r.errored) {
      r.errored = err
    }

    if (sync) {
      process.nextTick(emitErrorNT, stream, err)
    } else {
      emitErrorNT(stream, err)
    }
  }
}

function construct(stream: ManagedStream, cb: () => void) {
  if (typeof stream._construct !== 'function') {
    return
  }

  const r = stream._readableState
  const w = stream._writableState

  if (r) {
    r.constructed = false
  }

  if (w) {
    w.constructed = false
  }

  stream.once(kConstruct, cb)

  if (stream.listenerCount(kConstruct) > 1) {
    // Duplex
    return
  }

  process.nextTick(constructNT, stream)
}

function constructNT(stream: ManagedStream) {
  let called = false

  function onConstruct(err?: Failure) {
    if (called) {
      errorOrDestroy(stream, err !== null && err !== undefined ? err : new ERR_MULTIPLE_CALLBACK!())
      return
    }

    called = true
    const r = stream._readableState
    const w = stream._writableState
    const s = w || r

    if (r) {
      r.constructed = true
    }

    if (w) {
      w.constructed = true
    }

    if (s!.destroyed) {
      stream.emit(kDestroy, err)
    } else if (err) {
      errorOrDestroy(stream, err, true)
    } else {
      process.nextTick(emitConstructNT, stream)
    }
  }

  try {
    stream._construct!(onConstruct)
  } catch (err) {
    onConstruct(err as Failure)
  }
}

function emitConstructNT(stream: ManagedStream) {
  stream.emit(kConstruct)
}

function isRequest(stream: RequestLike | null | undefined): stream is RequestLike & { abort: () => unknown } {
  return !!(stream && stream.setHeader && typeof stream.abort === 'function')
}

function emitCloseLegacy(stream: LegacyStream) {
  stream.emit('close')
}

function emitErrorCloseLegacy(stream: LegacyStream, err?: Failure) {
  stream.emit('error', err)
  process.nextTick(emitCloseLegacy, stream)
} // Normalize destroy for legacy.

function destroyer(stream: LegacyStream | null | undefined, err?: Failure) {
  if (!stream || isDestroyed(stream)) {
    return
  }

  if (!err && !isFinished(stream)) {
    err = new AbortError()
  } // TODO: Remove isRequest branches.

  if (isServerRequest(stream)) {
    stream.socket = null
    stream.destroy!(err)
  } else if (isRequest(stream)) {
    stream.abort()
  } else if (isRequest(stream.req)) {
    stream.req.abort()
  } else if (typeof stream.destroy === 'function') {
    stream.destroy(err)
  } else if (typeof stream.close === 'function') {
    // TODO: Don't lose err?
    stream.close()
  } else if (err) {
    process.nextTick(emitErrorCloseLegacy, stream)
  } else {
    process.nextTick(emitCloseLegacy, stream)
  }

  if (!stream.destroyed) {
    stream[kDestroyed] = true
  }
}

export = {
  construct,
  destroyer,
  destroy,
  undestroy,
  errorOrDestroy
}
