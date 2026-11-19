import { createRequire } from 'node:module'
import eos from './end-of-stream'

type AbortableStream = Pick<Parameters<typeof eos>[0], 'on' | 'removeListener'> & {
  pipe(...args: never[]): unknown
  destroy(error?: Error): unknown
}
type Signal = Pick<AbortSignal, 'aborted' | 'addEventListener' | 'removeEventListener'> & { reason?: unknown }

interface AbortSignalApi {
  addAbortSignal<Stream extends AbortableStream>(this: void, signal: Signal, stream: Stream): Stream
  addAbortSignalNoValidate<Stream extends AbortableStream>(this: void, signal: Signal, stream: Stream): Stream
}

declare const module: { exports: AbortSignalApi }

const load = createRequire(__filename)
const { AbortError, codes } = load('../../ours/errors') as {
  AbortError: new (message?: string, options?: ErrorOptions) => Error
  codes: { ERR_INVALID_ARG_TYPE: new (name: string, expected: string, actual: unknown) => Error }
}
const { ERR_INVALID_ARG_TYPE } = codes // This method is inlined here for readable-stream
// It also does not allow for signal to not exist on the stream
// https://github.com/nodejs/node/pull/36061#discussion_r533718029

const validateAbortSignal = (signal: Signal, name: string) => {
  if (typeof signal !== 'object' || !('aborted' in signal)) {
    throw new ERR_INVALID_ARG_TYPE(name, 'AbortSignal', signal)
  }
}

function isNodeStream(obj: AbortableStream) {
  return !!(obj && typeof obj.pipe === 'function')
}

module.exports.addAbortSignal = function addAbortSignal<Stream extends AbortableStream>(signal: Signal, stream: Stream) {
  validateAbortSignal(signal, 'signal')

  if (!isNodeStream(stream)) {
    throw new ERR_INVALID_ARG_TYPE('stream', 'stream.Stream', stream)
  }

  return module.exports.addAbortSignalNoValidate(signal, stream)
}

module.exports.addAbortSignalNoValidate = function <Stream extends AbortableStream>(signal: Signal, stream: Stream) {
  if (typeof signal !== 'object' || !('aborted' in signal)) {
    return stream
  }

  const onAbort = () => {
    stream.destroy(
      new AbortError(undefined, {
        cause: signal.reason
      })
    )
  }

  if (signal.aborted) {
    onAbort()
  } else {
    signal.addEventListener('abort', onAbort)
    eos(stream, () => signal.removeEventListener('abort', onAbort))
  }

  return stream
}

export = module.exports
