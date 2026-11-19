import eos from '../internal/streams/end-of-stream'
import pipelineApi from '../internal/streams/pipeline'
import streamUtils from '../internal/streams/utils'
import primordials from '../ours/primordials'

interface PipelineOptions {
  signal?: AbortSignal
  end?: boolean
}

const { ArrayPrototypePop, Promise } = primordials

const { isIterable, isNodeStream } = streamUtils

const { pipelineImpl: pl } = pipelineApi

const { finished } = eos

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
