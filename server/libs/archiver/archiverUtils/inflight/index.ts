import wrappy from '../wrappy'
import once from '../../../lodash.once'

type Callback<Args extends unknown[]> = (...args: Args) => void

// Each key groups callers that share the same callback arguments.
const reqs = Object.create(null) as Record<string, unknown>

function inflight<Args extends unknown[]>(key: string, cb: Callback<Args>): Callback<Args> | null {
  const callbacks = reqs[key] as Callback<Args>[] | undefined
  if (callbacks) {
    callbacks.push(cb)
    return null
  } else {
    reqs[key] = [cb]
    return makeres<Args>(key)
  }
}

function makeres<Args extends unknown[]>(key: string) {
  return once(function RES(...args: Args) {
    var cbs = reqs[key] as Callback<Args>[]
    var len = cbs.length

    // XXX It's somewhat ambiguous whether a new callback added in this
    // pass should be queued for later execution if something in the
    // list of callbacks throws, or if it should just be discarded.
    // However, it's such an edge case that it hardly matters, and either
    // choice is likely as surprising as the other.
    // As it happens, we do go ahead and schedule it for later execution.
    try {
      for (var i = 0; i < len; i++) {
        cbs[i].apply(null, args)
      }
    } finally {
      if (cbs.length > len) {
        // added more in the interim.
        // de-zalgo, just in case, but don't call again.
        cbs.splice(0, len)
        process.nextTick(function () {
          RES.apply(null, args)
        })
      } else {
        delete reqs[key]
      }
    }
  })
}

const wrapped: typeof inflight = wrappy(inflight)
export = wrapped
