import { createRequire } from 'node:module'
import type { finished as Finished } from 'node:stream/promises'
import primordials from '../ours/primordials'

interface PipelineOptions {
  signal?: AbortSignal
  end?: boolean
}

const { ArrayPrototypePop, Promise } = primordials
const load = createRequire(__filename)

const { isIterable, isNodeStream } = load('../internal/streams/utils') as {
  isIterable: (value: unknown) => boolean
  isNodeStream: (value: unknown) => boolean
}

const { pipelineImpl: pl } = load('../internal/streams/pipeline') as {
  pipelineImpl: (streams: unknown[], callback: (error: Error | null, value?: unknown) => void, options: PipelineOptions) => void
}

const { finished } = load('../internal/streams/end-of-stream') as { finished: typeof Finished }

function pipeline(...streams: unknown[]) {
  return new Promise<unknown>((resolve, reject) => {
    let signal: AbortSignal | undefined
    let end: boolean | undefined
    const lastArg = streams[streams.length - 1]

    if (lastArg && typeof lastArg === 'object' && !isNodeStream(lastArg) && !isIterable(lastArg)) {
      const options = ArrayPrototypePop(streams) as PipelineOptions
      signal = options.signal
      end = options.end
    }

    pl(
      streams,
      (err, value) => {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      },
      {
        signal,
        end
      }
    )
  })
}

export = {
  finished,
  pipeline
}
