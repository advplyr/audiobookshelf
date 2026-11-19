// Ported from https://github.com/mafintosh/end-of-stream with
// permission from the author, Mathias Buus (@mafintosh).
import { createRequire } from 'node:module'
import primordials from '../../ours/primordials'
import util from '../../ours/util'
import validators from '../validators'
import streamUtils from './utils'

type StreamProbe = NonNullable<Parameters<typeof streamUtils.isDestroyed>[0]>
type Listener = (error?: Error) => void

interface StreamEvents {
  on(event: string, listener: Listener): void
  removeListener(event: string, listener: Listener): void
}

type WatchedStream = StreamProbe & StreamEvents & {
  setHeader?: unknown
  abort?: unknown
  aborted?: boolean
  req?: (StreamEvents & { upgradeOrConnect?: unknown }) | null
}

type Callback = (this: WatchedStream, error?: Error) => void
type Signal = Pick<AbortSignal, 'aborted' | 'addEventListener' | 'removeEventListener'> & { reason?: unknown }

interface FinishedOptions {
  readable?: boolean
  writable?: boolean
  error?: boolean
  signal?: Signal
}

const load = createRequire(__filename)
const { AbortError, codes } = load('../../ours/errors') as {
  AbortError: new (message?: string, options?: ErrorOptions) => Error
  codes: {
    ERR_INVALID_ARG_TYPE: new (name: string, expected: string, actual: unknown) => Error
    ERR_STREAM_PREMATURE_CLOSE: new () => Error
  }
}
const { ERR_INVALID_ARG_TYPE, ERR_STREAM_PREMATURE_CLOSE } = codes
const { Promise } = primordials
const validateFunction: typeof validators.validateFunction = validators.validateFunction

const {
  isClosed,
  isReadable,
  isReadableNodeStream,
  isReadableFinished,
  isReadableErrored,
  isWritable,
  isWritableNodeStream,
  isWritableFinished,
  isWritableErrored,
  isNodeStream,
  willEmitClose: _willEmitClose
} = streamUtils

function isRequest(stream: WatchedStream) {
  return stream.setHeader && typeof stream.abort === 'function'
}

const nop = () => {}

function eos(stream: WatchedStream, callback: Callback): () => void
function eos(stream: WatchedStream, options: FinishedOptions | null | undefined, callback: Callback): () => void
function eos(stream: WatchedStream, optionsOrCallback: FinishedOptions | Callback | null | undefined, callbackInput?: Callback) {
  let options = optionsOrCallback as FinishedOptions | null | undefined
  let callback = callbackInput
  var _options$readable: boolean | undefined, _options$writable: boolean | undefined

  if (arguments.length === 2) {
    callback = optionsOrCallback as Callback
    options = {}
  } else if (options == null) {
    options = {}
  } else {
    validators.validateObject(options, 'options')
  }

  const resolvedOptions = options
  validateFunction(callback, 'callback')
  validators.validateAbortSignal(resolvedOptions.signal, 'options.signal')
  let complete = util.once(callback)
  const readable =
    (_options$readable = resolvedOptions.readable) !== null && _options$readable !== undefined
      ? _options$readable
      : isReadableNodeStream(stream)
  const writable =
    (_options$writable = resolvedOptions.writable) !== null && _options$writable !== undefined
      ? _options$writable
      : isWritableNodeStream(stream)

  if (!isNodeStream(stream)) {
    // TODO: Webstreams.
    throw new ERR_INVALID_ARG_TYPE('stream', 'Stream', stream)
  }

  const wState = stream._writableState
  const rState = stream._readableState

  const onlegacyfinish = () => {
    if (!stream.writable) {
      onfinish()
    }
  } // TODO (ronag): Improve soft detection to include core modules and
  // common ecosystem modules that do properly emit 'close' but fail
  // this generic check.

  let willEmitClose =
    _willEmitClose(stream) && isReadableNodeStream(stream) === readable && isWritableNodeStream(stream) === writable
  let writableFinished = isWritableFinished(stream, false)

  const onfinish = () => {
    writableFinished = true // Stream should not be destroyed here. If it is that
    // means that user space is doing something differently and
    // we cannot trust willEmitClose.

    if (stream.destroyed) {
      willEmitClose = false
    }

    if (willEmitClose && (!stream.readable || readable)) {
      return
    }

    if (!readable || readableFinished) {
      complete.call(stream)
    }
  }

  let readableFinished = isReadableFinished(stream, false)

  const onend = () => {
    readableFinished = true // Stream should not be destroyed here. If it is that
    // means that user space is doing something differently and
    // we cannot trust willEmitClose.

    if (stream.destroyed) {
      willEmitClose = false
    }

    if (willEmitClose && (!stream.writable || writable)) {
      return
    }

    if (!writable || writableFinished) {
      complete.call(stream)
    }
  }

  const onerror = (err?: Error) => {
    complete.call(stream, err)
  }

  let closed = isClosed(stream)

  const onclose = () => {
    closed = true
    const errored = isWritableErrored(stream) || isReadableErrored(stream)

    if (errored && typeof errored !== 'boolean') {
      return complete.call(stream, errored)
    }

    if (readable && !readableFinished && isReadableNodeStream(stream, true)) {
      if (!isReadableFinished(stream, false)) return complete.call(stream, new ERR_STREAM_PREMATURE_CLOSE())
    }

    if (writable && !writableFinished) {
      if (!isWritableFinished(stream, false)) return complete.call(stream, new ERR_STREAM_PREMATURE_CLOSE())
    }

    complete.call(stream)
  }

  const onrequest = () => {
    stream.req!.on('finish', onfinish)
  }

  if (isRequest(stream)) {
    stream.on('complete', onfinish)

    if (!willEmitClose) {
      stream.on('abort', onclose)
    }

    if (stream.req) {
      onrequest()
    } else {
      stream.on('request', onrequest)
    }
  } else if (writable && !wState) {
    // legacy streams
    stream.on('end', onlegacyfinish)
    stream.on('close', onlegacyfinish)
  } // Not all streams will emit 'close' after 'aborted'.

  if (!willEmitClose && typeof stream.aborted === 'boolean') {
    stream.on('aborted', onclose)
  }

  stream.on('end', onend)
  stream.on('finish', onfinish)

  if (resolvedOptions.error !== false) {
    stream.on('error', onerror)
  }

  stream.on('close', onclose)

  if (closed) {
    process.nextTick(onclose)
  } else if (
    (wState !== null && wState !== undefined && wState.errorEmitted) ||
    (rState !== null && rState !== undefined && rState.errorEmitted)
  ) {
    if (!willEmitClose) {
      process.nextTick(onclose)
    }
  } else if (
    !readable &&
    (!willEmitClose || isReadable(stream)) &&
    (writableFinished || isWritable(stream) === false)
  ) {
    process.nextTick(onclose)
  } else if (
    !writable &&
    (!willEmitClose || isWritable(stream)) &&
    (readableFinished || isReadable(stream) === false)
  ) {
    process.nextTick(onclose)
  } else if (rState && stream.req && stream.aborted) {
    process.nextTick(onclose)
  }

  const cleanup = () => {
    complete = nop
    stream.removeListener('aborted', onclose)
    stream.removeListener('complete', onfinish)
    stream.removeListener('abort', onclose)
    stream.removeListener('request', onrequest)
    if (stream.req) stream.req.removeListener('finish', onfinish)
    stream.removeListener('end', onlegacyfinish)
    stream.removeListener('close', onlegacyfinish)
    stream.removeListener('finish', onfinish)
    stream.removeListener('end', onend)
    stream.removeListener('error', onerror)
    stream.removeListener('close', onclose)
  }

  if (resolvedOptions.signal && !closed) {
    const abort = () => {
      // Keep it because cleanup removes it.
      const endCallback = complete
      cleanup()
      endCallback.call(
        stream,
        new AbortError(undefined, {
          cause: resolvedOptions.signal!.reason
        })
      )
    }

    if (resolvedOptions.signal.aborted) {
      process.nextTick(abort)
    } else {
      const originalCallback = complete
      complete = util.once((...args: Parameters<Callback>) => {
        resolvedOptions.signal!.removeEventListener('abort', abort)
        originalCallback.apply(stream, args)
      })
      resolvedOptions.signal.addEventListener('abort', abort)
    }
  }

  return cleanup
}

function finished(stream: WatchedStream, opts?: FinishedOptions | null) {
  return new Promise<void>((resolve, reject) => {
    eos(stream, opts, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

declare const module: { exports: typeof eos & { finished?: typeof finished } }
module.exports = eos
module.exports.finished = finished

export = module.exports as typeof eos & { finished: typeof finished }
