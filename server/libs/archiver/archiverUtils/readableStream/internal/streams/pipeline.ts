// Ported from https://github.com/mafintosh/pump with
// permission from the author, Mathias Buus (@mafintosh).
import { createRequire } from 'node:module'
import LegacyAbortController from '../../../../../watcher/aborter/controller'
import errors from '../../ours/errors'
import primordials from '../../ours/primordials'
import util from '../../ours/util'
import validators from '../validators'
import destroyImpl from './destroy'
import Duplex from './duplex'
import eos from './end-of-stream'
import utils from './utils'

type Failure = Parameters<typeof errors.aggregateTwoErrors>[0]
type Finish = (error?: Failure) => void
type PipelineCallback = (error?: Failure, value?: unknown) => void
type AsyncSequence = Iterable<unknown> | AsyncIterable<unknown>
type StreamProbe = Parameters<typeof utils.isReadableNodeStream>[0]
type Signal = Pick<AbortSignal, 'aborted'> & {
  addEventListener(event: 'abort', callback: () => void): void
  removeEventListener(event: 'abort', callback: () => void): void
}

interface PipelineOptions {
  signal?: Signal
  end?: boolean
}

type Endpoint = Parameters<typeof eos>[0] & NonNullable<Parameters<typeof destroyImpl.destroyer>[0]> & NodeJS.WritableStream & {
  pipe(destination: Endpoint, options: { end: boolean }): unknown
  write(chunk: unknown): boolean
  read?(): unknown
  end(): void
  off(event: string, listener: Finish): void
  writableNeedDrain?: boolean
  writableObjectMode?: boolean
}

type Source = (options: { signal: Signal }) => unknown
type Stage = (source: AsyncSequence, options: { signal: Signal }) => unknown
type Then = (this: unknown, resolve: (value: unknown) => void, reject: (error: Error) => void) => unknown

const { ArrayIsArray, Promise, SymbolAsyncIterator } = primordials

const {
  aggregateTwoErrors,
  codes: { ERR_INVALID_ARG_TYPE, ERR_INVALID_RETURN_VALUE, ERR_MISSING_ARGS, ERR_STREAM_DESTROYED },
  AbortError
} = errors

const validateFunction: typeof validators.validateFunction = validators.validateFunction
const { isIterable, isReadable, isReadableNodeStream, isNodeStream } = utils

type ControllerConstructor = new () => { signal: Signal; abort(): void }
const legacyController: typeof LegacyAbortController & { AbortController?: ControllerConstructor } = LegacyAbortController
const AbortController = globalThis.AbortController || legacyController.AbortController
const load = createRequire(__filename)
let PassThrough: typeof import('./passthrough') | undefined
let Readable: { prototype: Record<symbol, (this: unknown) => AsyncIterableIterator<unknown>> } | undefined

function destroyer(stream: Endpoint, reading: boolean, writing: boolean) {
  let finished = false
  stream.on('close', () => {
    finished = true
  })
  const cleanup = eos(
    stream,
    {
      readable: reading,
      writable: writing
    },
    (err) => {
      finished = !err
    }
  )
  return {
    destroy: (err: Failure) => {
      if (finished) return
      finished = true
      destroyImpl.destroyer(stream, err || new ERR_STREAM_DESTROYED!('pipe'))
    },
    cleanup
  }
}

function popCallback(streams: unknown[]) {
  // Streams should never be an empty array. It should always contain at least
  // a single stream. Therefore optimize for the average case instead of
  // checking for length === 0 as well.
  validateFunction(streams[streams.length - 1], 'streams[stream.length - 1]')
  return streams.pop() as PipelineCallback
}

function makeAsyncIterable(val: unknown): AsyncSequence {
  if (isIterable(val)) {
    return val as AsyncSequence
  } else if (isReadableNodeStream(val as StreamProbe)) {
    // Legacy streams are not Iterable.
    return fromReadable(val)
  }

  throw new ERR_INVALID_ARG_TYPE!('val', ['Readable', 'Iterable', 'AsyncIterable'], val)
}

async function* fromReadable(val: unknown) {
  if (!Readable) {
    Readable = load('./readable') as NonNullable<typeof Readable>
  }

  yield* Readable.prototype[SymbolAsyncIterator].call(val)
}

async function pump(iterable: AsyncSequence, writable: Endpoint, finish: Finish, { end }: { end: boolean }) {
  let error: Failure
  let onresolve: (() => void) | null = null

  const resume = (err?: Failure) => {
    if (err) {
      error = err
    }

    if (onresolve) {
      const callback = onresolve
      onresolve = null
      callback()
    }
  }

  const wait = () =>
    new Promise<void>((resolve, reject) => {
      if (error) {
        reject(error)
      } else {
        onresolve = () => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
      }
    })

  writable.on('drain', resume)
  const cleanup = eos(
    writable,
    {
      readable: false
    },
    resume
  )

  try {
    if (writable.writableNeedDrain) {
      await wait()
    }

    for await (const chunk of iterable) {
      if (!writable.write(chunk)) {
        await wait()
      }
    }

    if (end) {
      writable.end()
    }

    await wait()
    finish()
  } catch (err) {
    const failure = err as Failure
    finish(error !== failure ? aggregateTwoErrors(error, failure) : failure)
  } finally {
    cleanup()
    writable.off('drain', resume)
  }
}

function pipeline(...streams: unknown[]) {
  return pipelineImpl(streams, util.once(popCallback(streams)))
}

function pipelineImpl(streams: unknown[], callback: PipelineCallback, opts?: PipelineOptions | null) {
  if (streams.length === 1 && ArrayIsArray(streams[0])) {
    streams = streams[0]
  }

  if (streams.length < 2) {
    throw new ERR_MISSING_ARGS!('streams')
  }

  const ac = new AbortController()
  const signal = ac.signal
  const outerSignal = opts === null || opts === undefined ? undefined : opts.signal // Need to cleanup event listeners if last stream is readable
  // https://github.com/nodejs/node/issues/35452

  const lastStreamCleanup: (() => void)[] = []
  validators.validateAbortSignal(outerSignal, 'options.signal')

  function abort() {
    finishImpl(new AbortError())
  }

  outerSignal?.addEventListener('abort', abort)
  let error: Failure
  let value: unknown
  const destroys: ((error: Failure) => void)[] = []
  let finishCount = 0

  function finish(err?: Failure) {
    finishImpl(err, --finishCount === 0)
  }

  function finishImpl(err?: Failure, final?: boolean) {
    if (err && (!error || error.code === 'ERR_STREAM_PREMATURE_CLOSE')) {
      error = err
    }

    if (!error && !final) {
      return
    }

    while (destroys.length) {
      destroys.shift()!(error)
    }

    outerSignal?.removeEventListener('abort', abort)
    ac.abort()

    if (final) {
      if (!error) {
        lastStreamCleanup.forEach((fn) => fn())
      }

      process.nextTick(callback, error, value)
    }
  }

  let ret: unknown

  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i]
    const endpoint = stream as Endpoint
    const reading = i < streams.length - 1
    const writing = i > 0
    const end = reading || (opts === null || opts === undefined ? undefined : opts.end) !== false
    const isLastStream = i === streams.length - 1

    if (isNodeStream(stream)) {
      if (end) {
        const { destroy, cleanup } = destroyer(endpoint, reading, writing)
        destroys.push(destroy)

        if (isReadable(endpoint) && isLastStream) {
          lastStreamCleanup.push(cleanup)
        }
      } // Catch stream errors that occur after pipe/pump has completed.

      function onError(err: Failure) {
        if (err && err.name !== 'AbortError' && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          finish(err)
        }
      }

      endpoint.on('error', onError)

      if (isReadable(endpoint) && isLastStream) {
        lastStreamCleanup.push(() => {
          endpoint.removeListener('error', onError)
        })
      }
    }

    if (i === 0) {
      if (typeof stream === 'function') {
        ret = (stream as Source)({
          signal
        })

        if (!isIterable(ret)) {
          throw new ERR_INVALID_RETURN_VALUE!('Iterable, AsyncIterable or Stream', 'source', ret)
        }
      } else if (isIterable(stream) || isReadableNodeStream(endpoint)) {
        ret = stream
      } else {
        ret = Duplex.from(stream)
      }
    } else if (typeof stream === 'function') {
      const source = makeAsyncIterable(ret)
      ret = (stream as Stage)(source, {
        signal
      })

      if (reading) {
        if (!isIterable(ret, true)) {
          throw new ERR_INVALID_RETURN_VALUE!('AsyncIterable', `transform[${i - 1}]`, ret)
        }
      } else {
        if (!PassThrough) {
          PassThrough = load('./passthrough') as typeof import('./passthrough')
        } // If the last argument to pipeline is not a stream
        // we must create a proxy stream so that pipeline(...)
        // always returns a stream which can be further
        // composed through `.pipe(stream)`.

        const pt = new PassThrough({
          objectMode: true
        }) // Handle Promises/A+ spec, `then` could be a getter that throws on
        // second use.

        const then = (ret as { then?: Then } | null | undefined)?.then

        if (typeof then === 'function') {
          finishCount++
          then.call(
            ret,
            (val) => {
              value = val

              if (val != null) {
                pt.write(val)
              }

              if (end) {
                pt.end()
              }

              process.nextTick(finish)
            },
            (err) => {
              pt.destroy(err)
              process.nextTick(finish, err)
            }
          )
        } else if (isIterable(ret, true)) {
          finishCount++
          void pump(ret as AsyncSequence, pt, finish, {
            end
          })
        } else {
          throw new ERR_INVALID_RETURN_VALUE!('AsyncIterable or Promise', 'destination', ret)
        }

        ret = pt
        const { destroy, cleanup } = destroyer(pt, false, true)
        destroys.push(destroy)

        if (isLastStream) {
          lastStreamCleanup.push(cleanup)
        }
      }
    } else if (isNodeStream(stream)) {
      if (isReadableNodeStream(ret as StreamProbe)) {
        finishCount += 2
        const cleanup = pipe(ret as Endpoint, endpoint, finish, {
          end
        })

        if (isReadable(endpoint) && isLastStream) {
          lastStreamCleanup.push(cleanup)
        }
      } else if (isIterable(ret)) {
        finishCount++
        void pump(ret as AsyncSequence, endpoint, finish, {
          end
        })
      } else {
        throw new ERR_INVALID_ARG_TYPE!('val', ['Readable', 'Iterable', 'AsyncIterable'], ret)
      }

      ret = stream
    } else {
      ret = Duplex.from(stream)
    }
  }

  if (
    (signal !== null && signal !== undefined && signal.aborted) ||
    (outerSignal !== null && outerSignal !== undefined && outerSignal.aborted)
  ) {
    process.nextTick(abort)
  }

  return ret as Endpoint
}

function pipe(src: Endpoint, dst: Endpoint, finish: Finish, { end }: { end: boolean }) {
  src.pipe(dst, {
    end
  })

  if (end) {
    // Compat. Before node v10.12.0 stdio used to throw an error so
    // pipe() did/does not end() stdio destinations.
    // Now they allow it but "secretly" don't close the underlying fd.
    src.once('end', () => dst.end())
  } else {
    finish()
  }

  eos(
    src,
    {
      readable: true,
      writable: false
    },
    (err) => {
      const rState = src._readableState

      if (
        err &&
        (err as NodeJS.ErrnoException).code === 'ERR_STREAM_PREMATURE_CLOSE' &&
        rState &&
        rState.ended &&
        !rState.errored &&
        !rState.errorEmitted
      ) {
        // Some readable streams will emit 'close' before 'end'. However, since
        // this is on the readable side 'end' should still be emitted if the
        // stream has been ended and no error emitted. This should be allowed in
        // favor of backwards compatibility. Since the stream is piped to a
        // destination this should not result in any observable difference.
        // We don't need to check if this is a writable premature close since
        // eos will only fail with premature close on the reading side for
        // duplex streams.
        src.once('end', finish).once('error', finish)
      } else {
        finish(err)
      }
    }
  )
  return eos(
    dst,
    {
      readable: false,
      writable: true
    },
    finish
  )
}

export = {
  pipelineImpl,
  pipeline
}
