import { createRequire } from 'node:module'
import type { DuplexOptions, Readable as NodeReadable } from 'node:stream'
import primordials from '../../ours/primordials'

type SyncIterator = Iterator<unknown, unknown, unknown>
type SourceIterator = SyncIterator | AsyncIterator<unknown, unknown, unknown>
type IteratorFactories = Record<symbol, (() => SourceIterator) | undefined>

interface ReadableStream extends NodeReadable {
  destroy(error?: unknown): this
}

const { PromisePrototypeThen, SymbolAsyncIterator, SymbolIterator } = primordials
const { ERR_INVALID_ARG_TYPE, ERR_STREAM_NULL_VALUES } = (createRequire(__filename)('../../ours/errors') as {
  codes: {
    ERR_INVALID_ARG_TYPE: new (name: string, expected: string[], actual: unknown) => Error
    ERR_STREAM_NULL_VALUES: new () => Error
  }
}).codes

type StreamOptions = DuplexOptions & { writable?: boolean }

function from<Readable extends ReadableStream>(Readable: new (options: StreamOptions) => Readable, iterable: unknown, opts?: StreamOptions) {
  let iterator: SourceIterator

  if (typeof iterable === 'string' || iterable instanceof Buffer) {
    return new Readable({
      objectMode: true,
      ...opts,

      read() {
        this.push(iterable)
        this.push(null)
      }
    })
  }

  let isAsync: boolean
  const factories = iterable as IteratorFactories | null | undefined

  if (factories && factories[SymbolAsyncIterator]) {
    isAsync = true
    iterator = factories[SymbolAsyncIterator]()
  } else if (factories && factories[SymbolIterator]) {
    isAsync = false
    iterator = factories[SymbolIterator]()
  } else {
    throw new ERR_INVALID_ARG_TYPE('iterable', ['Iterable'], iterable)
  }

  const readable = new Readable({
    objectMode: true,
    highWaterMark: 1,
    // TODO(ronag): What options should be allowed?
    ...opts
  }) // Flag to protect against _read
  // being called before last iteration completion.

  let reading = false

  readable._read = function () {
    if (!reading) {
      reading = true
      void next()
    }
  }

  readable._destroy = function (error, cb) {
    void PromisePrototypeThen(
      close(error),
      () => process.nextTick(cb, error), // nextTick is here in case cb throws
      // Iterators can reject with arbitrary values. Preserve the original reason.
      (e) => process.nextTick(cb as (reason: unknown) => void, e || error)
    )
  }

  async function close(error: unknown) {
    const hadError = error !== undefined && error !== null
    const hasThrow = typeof iterator.throw === 'function'

    if (hadError && hasThrow) {
      const { value, done } = await iterator.throw!(error)
      await value

      if (done) {
        return
      }
    }

    if (typeof iterator.return === 'function') {
      const { value } = await iterator.return()
      await value
    }
  }

  async function next() {
    for (;;) {
      try {
        const { value, done } = isAsync ? await iterator.next() : (iterator as SyncIterator).next()

        if (done) {
          readable.push(null)
        } else {
          const thenable = value as Partial<PromiseLike<unknown>> | null | undefined
          const res = value && typeof thenable?.then === 'function' ? await (thenable as PromiseLike<unknown>) : value

          if (res === null) {
            reading = false
            throw new ERR_STREAM_NULL_VALUES()
          } else if (readable.push(res)) {
            continue
          } else {
            reading = false
          }
        }
      } catch (err) {
        readable.destroy(err)
      }

      break
    }
  }

  return readable
}

export = from
