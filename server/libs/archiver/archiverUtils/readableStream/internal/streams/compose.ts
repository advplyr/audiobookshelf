import { createRequire } from 'node:module'
import errors from '../../ours/errors'
import teardown from './destroy'
import Duplex from './duplex'
import utils from './utils'

type StreamCallback = (error?: Error | null) => void
type Destroyable = NonNullable<Parameters<typeof teardown.destroyer>[0]>

interface PipelineEndpoint extends Destroyable {
  writableObjectMode?: boolean
  write(chunk: unknown, encoding: BufferEncoding): boolean
  end(): void
  read(): unknown
  on(event: string, listener: () => void): void
}

const { pipeline } = createRequire(__filename)('./pipeline') as { pipeline: (streams: unknown[], callback: StreamCallback) => PipelineEndpoint }
const { destroyer } = teardown
const { isNodeStream, isReadable, isWritable } = utils

const {
  AbortError,
  codes: { ERR_INVALID_ARG_VALUE, ERR_MISSING_ARGS }
} = errors

function compose(...streams: unknown[]) {
  if (streams.length === 0) {
    throw new ERR_MISSING_ARGS!('streams')
  }

  if (streams.length === 1) {
    return Duplex.from(streams[0])
  }

  const orgStreams = [...streams]

  if (typeof streams[0] === 'function') {
    streams[0] = Duplex.from(streams[0])
  }

  if (typeof streams[streams.length - 1] === 'function') {
    const idx = streams.length - 1
    streams[idx] = Duplex.from(streams[idx])
  }

  for (let n = 0; n < streams.length; ++n) {
    const stream = streams[n] as PipelineEndpoint | undefined
    if (!isNodeStream(stream)) {
      // TODO(ronag): Add checks for non streams.
      continue
    }

    if (n < streams.length - 1 && !isReadable(stream)) {
      throw new ERR_INVALID_ARG_VALUE!(`streams[${n}]`, orgStreams[n], 'must be readable')
    }

    if (n > 0 && !isWritable(stream)) {
      throw new ERR_INVALID_ARG_VALUE!(`streams[${n}]`, orgStreams[n], 'must be writable')
    }
  }

  let ondrain: StreamCallback | null | undefined
  let onfinish: StreamCallback | null | undefined
  let onreadable: (() => void) | null | undefined
  let onclose: StreamCallback | null | undefined
  let d: InstanceType<typeof Duplex>

  function onfinished(err?: Error | null) {
    const cb = onclose
    onclose = null

    if (cb) {
      cb(err)
    } else if (err) {
      d.destroy(err)
    } else if (!readable && !writable) {
      d.destroy()
    }
  }

  const head = streams[0] as PipelineEndpoint | undefined
  const tail = pipeline(streams, onfinished)
  const writable = !!isWritable(head)
  const readable = !!isReadable(tail) // TODO(ronag): Avoid double buffering.
  // Implement Writable/Readable/Duplex traits.
  // See, https://github.com/nodejs/node/pull/33515.

  d = new Duplex({
    // TODO (ronag): highWaterMark?
    writableObjectMode: !!(head !== null && head !== undefined && head.writableObjectMode),
    readableObjectMode: !!(tail !== null && tail !== undefined && tail.writableObjectMode),
    writable,
    readable
  })

  if (writable) {
    d._write = function (chunk: unknown, encoding, callback) {
      if (head!.write(chunk, encoding)) {
        callback()
      } else {
        ondrain = callback
      }
    }

    d._final = function (callback) {
      head!.end()
      onfinish = callback
    }

    head!.on('drain', function () {
      if (ondrain) {
        const cb = ondrain
        ondrain = null
        cb()
      }
    })
    tail.on('finish', function () {
      if (onfinish) {
        const cb = onfinish
        onfinish = null
        cb()
      }
    })
  }

  if (readable) {
    tail.on('readable', function () {
      if (onreadable) {
        const cb = onreadable
        onreadable = null
        cb()
      }
    })
    tail.on('end', function () {
      d.push(null)
    })

    d._read = function () {
      while (true) {
        const buf = tail.read()

        if (buf === null) {
          // The composed stream's read hook takes no size argument.
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
      destroyer(tail, err)
    }
  }

  return d
}

export = compose
