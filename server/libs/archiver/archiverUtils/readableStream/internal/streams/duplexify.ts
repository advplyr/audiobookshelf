import bufferModule from 'node:buffer'
import { createRequire } from 'node:module'
import type { Duplex as NodeDuplex } from 'node:stream'
import LegacyAbortController from '../../../../../watcher/aborter/controller'
import errors from '../../ours/errors'
import primordials from '../../ours/primordials'
import util from '../../ours/util'
import teardown from './destroy'
import Duplex from './duplex'
import eos from './end-of-stream'
import from from './from'
import utils from './utils'

type DuplexOptions = NonNullable<ConstructorParameters<typeof Duplex>[0]>
type Callback = (error?: Error | null) => unknown
type Endpoint = Parameters<typeof eos>[0] & NonNullable<Parameters<typeof teardown.destroyer>[0]> & {
  readableObjectMode?: boolean
  writableObjectMode?: boolean
  read?: () => unknown
  write?: (chunk: unknown, encoding: BufferEncoding) => boolean
  end?: () => void
}

interface Pair {
  readable?: Endpoint | false
  writable?: Endpoint | false
}

type Then = (this: unknown, resolve: (value: unknown) => void, reject: (error: Error) => void) => unknown
type Signal = { aborted: boolean; reason?: unknown }
type Body = (chunks: AsyncIterable<unknown>, options: { signal: Signal }) => unknown
type Controller = new () => { signal: Signal; abort(): void }
type Probe = Parameters<typeof utils.isReadableNodeStream>[0]

const {
  isReadable,
  isWritable,
  isIterable,
  isNodeStream,
  isReadableNodeStream,
  isWritableNodeStream,
  isDuplexNodeStream
} = utils

const {
  AbortError,
  codes: { ERR_INVALID_ARG_TYPE, ERR_INVALID_RETURN_VALUE }
} = errors
const { destroyer } = teardown
const Readable = createRequire(__filename)('./readable') as { wrap: (stream: Endpoint) => Endpoint }

const Blob = globalThis.Blob || bufferModule.Blob
const isBlob =
  typeof Blob !== 'undefined'
    ? function isBlob(b: unknown): b is InstanceType<typeof Blob> {
      return b instanceof Blob
    }
    : function isBlob(b: unknown): b is InstanceType<typeof Blob> {
      void b
      return false
    }
const legacyController: typeof LegacyAbortController & { AbortController?: Controller } = LegacyAbortController
const AbortController = globalThis.AbortController || legacyController.AbortController

const { FunctionPrototypeCall } = primordials // This is needed for pre node 17.

class Duplexify extends Duplex {
  constructor(options?: DuplexOptions) {
    super(options) // https://github.com/nodejs/node/pull/34385

    if ((options === null || options === undefined ? undefined : options.readable) === false) {
      this._readableState.readable = false
      this._readableState.ended = true
      this._readableState.endEmitted = true
    }

    if ((options === null || options === undefined ? undefined : options.writable) === false) {
      this._writableState.writable = false
      this._writableState.ending = true
      this._writableState.ended = true
      this._writableState.finished = true
    }
  }
}

function duplexify(body: unknown, name?: string): NodeDuplex {
  const stream = body as Endpoint
  if (isDuplexNodeStream(stream)) {
    return body as NodeDuplex
  }

  if (isReadableNodeStream(stream)) {
    return _duplexify({
      readable: stream
    })
  }

  if (isWritableNodeStream(stream)) {
    return _duplexify({
      writable: stream
    })
  }

  if (isNodeStream(body)) {
    return _duplexify({
      writable: false,
      readable: false
    })
  } // TODO: Webstreams
  // if (isReadableStream(body)) {
  //   return _duplexify({ readable: Readable.fromWeb(body) });
  // }
  // TODO: Webstreams
  // if (isWritableStream(body)) {
  //   return _duplexify({ writable: Writable.fromWeb(body) });
  // }

  if (typeof body === 'function') {
    const { value, write, final, destroy } = fromAsyncGen(body as Body)

    if (isIterable(value)) {
      return from(Duplexify, value, {
        // TODO (ronag): highWaterMark?
        objectMode: true,
        write,
        final,
        destroy
      })
    }

    const then = (value as { then?: Then } | null | undefined)?.then

    if (typeof then === 'function') {
      let d: Duplexify | undefined
      const promise = FunctionPrototypeCall(
        then,
        value,
        (val) => {
          if (val != null) {
            throw new ERR_INVALID_RETURN_VALUE!('nully', 'body', val)
          }
        },
        (err) => {
          destroyer(d, err)
        }
      )
      return (d = new Duplexify({
        // TODO (ronag): highWaterMark?
        objectMode: true,
        readable: false,
        write,

        final(cb) {
          final(async () => {
            try {
              await promise
              process.nextTick(cb, null)
            } catch (err) {
              const failure = err as Error
              process.nextTick(cb, failure)
            }
          })
        },

        destroy
      }))
    }

    throw new ERR_INVALID_RETURN_VALUE!('Iterable, AsyncIterable or AsyncFunction', name, value)
  }

  if (isBlob(body)) {
    return duplexify(body.arrayBuffer())
  }

  if (isIterable(body)) {
    return from(Duplexify, body, {
      // TODO (ronag): highWaterMark?
      objectMode: true,
      writable: false
    })
  } // TODO: Webstreams.
  // if (
  //   isReadableStream(body?.readable) &&
  //   isWritableStream(body?.writable)
  // ) {
  //   return Duplexify.fromWeb(body);
  // }

  const pair = body as Pair | null | undefined
  if (
    typeof pair?.writable === 'object' ||
    typeof pair?.readable === 'object'
  ) {
    const readable =
      pair?.readable
        ? isReadableNodeStream(pair.readable)
          ? pair.readable
          : duplexify(pair.readable)
        : undefined
    const writable =
      pair?.writable
        ? isWritableNodeStream(pair.writable)
          ? pair.writable
          : duplexify(pair.writable)
        : undefined
    return _duplexify({
      readable,
      writable
    })
  }

  const then = (body as { then?: Then } | null | undefined)?.then

  if (typeof then === 'function') {
    let d: Duplexify | undefined
    FunctionPrototypeCall(
      then,
      body,
      (val) => {
        if (val != null) {
          d!.push(val)
        }

        d!.push(null)
      },
      (err) => {
        destroyer(d, err)
      }
    )
    return (d = new Duplexify({
      objectMode: true,
      writable: false,

      read() { }
    }))
  }

  throw new ERR_INVALID_ARG_TYPE!(
    name,
    [
      'Blob',
      'ReadableStream',
      'WritableStream',
      'Stream',
      'Iterable',
      'AsyncIterable',
      'Function',
      '{ readable, writable } pair',
      'Promise'
    ],
    body
  )
}

interface PendingChunk {
  chunk?: unknown
  done: boolean
  cb: Callback
}

function fromAsyncGen(fn: Body) {
  let { promise, resolve }: {
    promise: Promise<PendingChunk> | null
    resolve: ((chunk: PendingChunk) => void) | null
  } = util.createDeferredPromise<PendingChunk>()
  const ac = new AbortController()
  const signal = ac.signal
  const value = fn(
    (async function* () {
      while (true) {
        const _promise = promise
        promise = null
        const { chunk, done, cb } = await _promise
        process.nextTick(cb)
        if (done) return
        if (signal.aborted)
          throw new AbortError(undefined, {
            cause: signal.reason
          })
          ; ({ promise, resolve } = util.createDeferredPromise<PendingChunk>())
        yield chunk
      }
    })(),
    {
      signal
    }
  )
  return {
    value,

    write(this: void, chunk: unknown, encoding: BufferEncoding, cb: Callback) {
      const _resolve = resolve
      resolve = null

      _resolve!({
        chunk,
        done: false,
        cb
      })
    },

    final(this: void, cb: Callback) {
      const _resolve = resolve
      resolve = null

      _resolve!({
        done: true,
        cb
      })
    },

    destroy(this: void, err: Error | null, cb: Callback) {
      ac.abort()
      cb(err)
    }
  }
}

function _duplexify(pair: Pair) {
  const r = pair.readable && typeof pair.readable.read !== 'function' ? Readable.wrap(pair.readable) : pair.readable
  const w = pair.writable
  let readable = !!isReadable(r as Probe)
  let writable = !!isWritable(w as Probe)
  let ondrain: Callback | null | undefined
  let onfinish: Callback | null | undefined
  let onreadable: (() => void) | null | undefined
  let onclose: Callback | null | undefined
  let d: Duplexify

  function onfinished(err?: Error) {
    const cb = onclose
    onclose = null

    if (cb) {
      cb(err)
    } else if (err) {
      d.destroy(err)
    } else if (!readable && !writable) {
      d.destroy()
    }
  } // TODO(ronag): Avoid double buffering.
  // Implement Writable/Readable/Duplex traits.
  // See, https://github.com/nodejs/node/pull/33515.

  d = new Duplexify({
    // TODO (ronag): highWaterMark?
    readableObjectMode: !!(r !== null && r !== undefined && (r as Endpoint).readableObjectMode),
    writableObjectMode: !!(w !== null && w !== undefined && (w as Endpoint).writableObjectMode),
    readable,
    writable
  })

  if (writable) {
    const output = w as Endpoint
    eos(output, (err) => {
      writable = false

      if (err) {
        destroyer(r as Endpoint, err)
      }

      onfinished(err)
    })

    d._write = function (chunk: unknown, encoding, callback) {
      if (output.write!(chunk, encoding)) {
        callback()
      } else {
        ondrain = callback
      }
    }

    d._final = function (callback) {
      output.end!()
      onfinish = callback
    }

    output.on('drain', function () {
      if (ondrain) {
        const cb = ondrain
        ondrain = null
        cb()
      }
    })
    output.on('finish', function () {
      if (onfinish) {
        const cb = onfinish
        onfinish = null
        cb()
      }
    })
  }

  if (readable) {
    const input = r as Endpoint
    eos(input, (err) => {
      readable = false

      if (err) {
        destroyer(input, err)
      }

      onfinished(err)
    })
    input.on('readable', function () {
      if (onreadable) {
        const cb = onreadable
        onreadable = null
        cb()
      }
    })
    input.on('end', function () {
      d.push(null)
    })

    d._read = function () {
      while (true) {
        const buf = input.read!()

        if (buf === null) {
          // This read hook takes no size argument.
          onreadable = (d as unknown as { _read: () => void })._read
          return
        }

        if (!d.push(buf)) {
          return
        }
      }
    }
  }

  d._destroy = function (err, callback) {
    if (!err && onclose !== null) {
      err = new AbortError()
    }

    onreadable = null
    ondrain = null
    onfinish = null

    if (onclose === null) {
      callback(err)
    } else {
      onclose = callback
      destroyer(w as Endpoint, err)
      destroyer(r as Endpoint, err)
    }
  }

  return d
}

export = duplexify
