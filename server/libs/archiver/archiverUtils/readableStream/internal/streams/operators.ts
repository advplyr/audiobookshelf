import type { Readable } from 'node:stream'
import LegacyAbortController from '../../../../../watcher/aborter/controller'
import errors from '../../ours/errors'
import primordials from '../../ours/primordials'
import validators from '../validators'
import eos from './end-of-stream'

type OperatorStream = AsyncIterable<unknown> & Pick<Readable, 'destroy' | 'once' | 'on' | 'removeListener'>
type Signal = Pick<AbortSignal, 'aborted' | 'addEventListener' | 'removeEventListener'> & { reason?: unknown }
type Controller = new () => { signal: Signal; abort(): void }
type CallbackOptions = { signal: Signal }
type Iteratee = (value: unknown, options: CallbackOptions) => unknown
type Reducer = (initialValue: unknown, value: unknown, options: CallbackOptions) => unknown
type Options = { signal?: Signal; concurrency?: number }

const legacyController: typeof LegacyAbortController & { AbortController?: Controller } = LegacyAbortController
const AbortController = globalThis.AbortController || legacyController.AbortController

const {
  codes: { ERR_INVALID_ARG_TYPE, ERR_MISSING_ARGS, ERR_OUT_OF_RANGE },
  AbortError
} = errors

const { validateAbortSignal, validateInteger, validateObject } = validators

const kWeakHandler = primordials.Symbol('kWeak')

const { finished } = eos

const {
  ArrayPrototypePush,
  MathFloor,
  Number,
  NumberIsNaN,
  Promise,
  PromiseReject,
  PromisePrototypeCatch,
  Symbol
} = primordials

const kEmpty = Symbol('kEmpty')
const kEof = Symbol('kEof')

function map(this: OperatorStream, fn: Iteratee, options?: Options | null) {
  if (typeof fn !== 'function') {
    throw new ERR_INVALID_ARG_TYPE!('fn', ['Function', 'AsyncFunction'], fn)
  }

  if (options != null) {
    validateObject(options, 'options')
  }

  if (options?.signal != null) {
    validateAbortSignal(options.signal, 'options.signal')
  }

  let concurrency = 1

  if (options?.concurrency != null) {
    concurrency = MathFloor(options.concurrency)
  }

  validateInteger(concurrency, 'concurrency', 1)
  return async function* map(this: OperatorStream) {
    var _options$signal

    const ac = new AbortController()
    const queue: unknown[] = []
    const signal = ac.signal
    const signalOpt = {
      signal
    }

    const abort = () => ac.abort()

    if (
      options !== null &&
      options !== undefined &&
      (_options$signal = options.signal) !== null &&
      _options$signal !== undefined &&
      _options$signal.aborted
    ) {
      abort()
    }

    options?.signal?.addEventListener('abort', abort)
    let next: (() => void) | null | undefined
    let resume: (() => void) | null | undefined
    let done = false

    function onDone() {
      done = true
    }

    const pump = async () => {
      try {
        for await (let val of this) {
          if (done) {
            return
          }

          if (signal.aborted) {
            throw new AbortError()
          }

          try {
            val = fn(val, signalOpt)
          } catch (err) {
            val = PromiseReject(err as Error)
          }

          if (val === kEmpty) {
            continue
          }

          const pending = val as Promise<unknown> | null | undefined
          if (typeof pending?.catch === 'function') {
            void pending.catch(onDone)
          }

          queue.push(val)

          if (next) {
            next()
            next = null
          }

          if (!done && queue.length && queue.length >= concurrency) {
            await new Promise<void>((resolve) => {
              resume = resolve
            })
          }
        }

        queue.push(kEof)
      } catch (err) {
        const val = PromiseReject(err as Error)
        void PromisePrototypeCatch(val, onDone)
        queue.push(val)
      } finally {
        done = true

        if (next) {
          next()
          next = null
        }

        options?.signal?.removeEventListener('abort', abort)
      }
    }

    void pump()

    try {
      while (true) {
        while (queue.length > 0) {
          const val = await queue[0]

          if (val === kEof) {
            return
          }

          if (signal.aborted) {
            throw new AbortError()
          }

          if (val !== kEmpty) {
            yield val
          }

          queue.shift()

          if (resume) {
            resume()
            resume = null
          }
        }

        await new Promise<void>((resolve) => {
          next = resolve
        })
      }
    } finally {
      ac.abort()
      done = true

      if (resume) {
        resume()
        resume = null
      }
    }
  }.call(this)
}

function asIndexedPairs(this: OperatorStream, options: Options | null | undefined = undefined) {
  if (options != null) {
    validateObject(options, 'options')
  }

  if (options?.signal != null) {
    validateAbortSignal(options.signal, 'options.signal')
  }

  return async function* asIndexedPairs(this: OperatorStream) {
    let index = 0

    for await (const val of this) {
      var _options$signal4

      if (
        options !== null &&
        options !== undefined &&
        (_options$signal4 = options.signal) !== null &&
        _options$signal4 !== undefined &&
        _options$signal4.aborted
      ) {
        throw new AbortError({
          cause: options.signal!.reason
        })
      }

      yield [index++, val]
    }
  }.call(this)
}

async function some(this: OperatorStream, fn: Iteratee, options: Options | null | undefined = undefined) {
  for await (const unused of filter.call(this, fn, options)) {
    void unused
    return true
  }

  return false
}

async function every(this: OperatorStream, fn: Iteratee, options: Options | null | undefined = undefined) {
  if (typeof fn !== 'function') {
    throw new ERR_INVALID_ARG_TYPE!('fn', ['Function', 'AsyncFunction'], fn)
  } // https://en.wikipedia.org/wiki/De_Morgan%27s_laws

  return !(await some.call(
    this,
    async (...args) => {
      return !(await fn(...args))
    },
    options
  ))
}

async function find(this: OperatorStream, fn: Iteratee, options?: Options | null) {
  for await (const result of filter.call(this, fn, options)) {
    return result
  }

  return undefined
}

async function forEach(this: OperatorStream, fn: Iteratee, options?: Options | null) {
  if (typeof fn !== 'function') {
    throw new ERR_INVALID_ARG_TYPE!('fn', ['Function', 'AsyncFunction'], fn)
  }

  async function forEachFn(value: unknown, options: CallbackOptions) {
    await fn(value, options)
    return kEmpty
  }

  for await (const unused of map.call(this, forEachFn, options)) {
    void unused
  }
}

function filter(this: OperatorStream, fn: Iteratee, options?: Options | null) {
  if (typeof fn !== 'function') {
    throw new ERR_INVALID_ARG_TYPE!('fn', ['Function', 'AsyncFunction'], fn)
  }

  async function filterFn(value: unknown, options: CallbackOptions) {
    if (await fn(value, options)) {
      return value
    }

    return kEmpty
  }

  return map.call(this, filterFn, options)
} // Specific to provide better error to reduce since the argument is only
// missing if the stream has no items in it - but the code is still appropriate

class ReduceAwareErrMissingArgs extends ERR_MISSING_ARGS! {
  constructor() {
    super('reduce')
    this.message = 'Reduce of an empty stream requires an initial value'
  }
}

async function reduce(this: OperatorStream, reducer: Reducer, initialValue?: unknown, options?: Options | null) {
  var _options$signal5

  if (typeof reducer !== 'function') {
    throw new ERR_INVALID_ARG_TYPE!('reducer', ['Function', 'AsyncFunction'], reducer)
  }

  if (options != null) {
    validateObject(options, 'options')
  }

  if (options?.signal != null) {
    validateAbortSignal(options.signal, 'options.signal')
  }

  let hasInitialValue = arguments.length > 1

  if (
    options !== null &&
    options !== undefined &&
    (_options$signal5 = options.signal) !== null &&
    _options$signal5 !== undefined &&
    _options$signal5.aborted
  ) {
    const err = new AbortError(undefined, {
      cause: options.signal!.reason
    })
    this.once('error', () => { }) // The error is already propagated

    await finished(this.destroy(err))
    throw err
  }

  const ac = new AbortController()
  const signal = ac.signal

  if (options !== null && options !== undefined && options.signal) {
    const opts = {
      once: true,
      [kWeakHandler]: this
    }
    options.signal.addEventListener('abort', () => ac.abort(), opts)
  }

  let gotAnyItemFromStream = false

  try {
    for await (const value of this) {
      var _options$signal6

      gotAnyItemFromStream = true

      if (
        options !== null &&
        options !== undefined &&
        (_options$signal6 = options.signal) !== null &&
        _options$signal6 !== undefined &&
        _options$signal6.aborted
      ) {
        throw new AbortError()
      }

      if (!hasInitialValue) {
        initialValue = value
        hasInitialValue = true
      } else {
        initialValue = await reducer(initialValue, value, {
          signal
        })
      }
    }

    if (!gotAnyItemFromStream && !hasInitialValue) {
      throw new ReduceAwareErrMissingArgs()
    }
  } finally {
    ac.abort()
  }

  return initialValue
}

async function toArray(this: OperatorStream, options?: Options | null) {
  if (options != null) {
    validateObject(options, 'options')
  }

  if (options?.signal != null) {
    validateAbortSignal(options.signal, 'options.signal')
  }

  const result: unknown[] = []

  for await (const val of this) {
    var _options$signal7

    if (
      options !== null &&
      options !== undefined &&
      (_options$signal7 = options.signal) !== null &&
      _options$signal7 !== undefined &&
      _options$signal7.aborted
    ) {
      throw new AbortError(undefined, {
        cause: options.signal!.reason
      })
    }

    ArrayPrototypePush(result, val)
  }

  return result
}

function flatMap(this: OperatorStream, fn: Iteratee, options?: Options | null) {
  const values = map.call(this, fn, options)
  return async function* flatMap(this: OperatorStream) {
    for await (const val of values) {
      yield* val as Iterable<unknown> | AsyncIterable<unknown>
    }
  }.call(this)
}

function toIntegerOrInfinity(value: unknown) {
  // We coerce here to align with the spec
  // https://github.com/tc39/proposal-iterator-helpers/issues/169
  const number = Number(value)

  if (NumberIsNaN(number)) {
    return 0
  }

  if (number < 0) {
    throw new ERR_OUT_OF_RANGE!('number', '>= 0', number)
  }

  return number
}

function drop(this: OperatorStream, number: unknown, options: Options | null | undefined = undefined) {
  if (options != null) {
    validateObject(options, 'options')
  }

  if (options?.signal != null) {
    validateAbortSignal(options.signal, 'options.signal')
  }

  let count = toIntegerOrInfinity(number)
  return async function* drop(this: OperatorStream) {
    var _options$signal8

    if (
      options !== null &&
      options !== undefined &&
      (_options$signal8 = options.signal) !== null &&
      _options$signal8 !== undefined &&
      _options$signal8.aborted
    ) {
      throw new AbortError()
    }

    for await (const val of this) {
      var _options$signal9

      if (
        options !== null &&
        options !== undefined &&
        (_options$signal9 = options.signal) !== null &&
        _options$signal9 !== undefined &&
        _options$signal9.aborted
      ) {
        throw new AbortError()
      }

      if (count-- <= 0) {
        yield val
      }
    }
  }.call(this)
}

function take(this: OperatorStream, number: unknown, options: Options | null | undefined = undefined) {
  if (options != null) {
    validateObject(options, 'options')
  }

  if (options?.signal != null) {
    validateAbortSignal(options.signal, 'options.signal')
  }

  let count = toIntegerOrInfinity(number)
  return async function* take(this: OperatorStream) {
    var _options$signal10

    if (
      options !== null &&
      options !== undefined &&
      (_options$signal10 = options.signal) !== null &&
      _options$signal10 !== undefined &&
      _options$signal10.aborted
    ) {
      throw new AbortError()
    }

    for await (const val of this) {
      var _options$signal11

      if (
        options !== null &&
        options !== undefined &&
        (_options$signal11 = options.signal) !== null &&
        _options$signal11 !== undefined &&
        _options$signal11.aborted
      ) {
        throw new AbortError()
      }

      if (count-- > 0) {
        yield val
      } else {
        return
      }
    }
  }.call(this)
}

const streamReturningOperators = {
  asIndexedPairs,
  drop,
  filter,
  flatMap,
  map,
  take
}
const promiseReturningOperators = {
  every,
  forEach,
  reduce,
  toArray,
  some,
  find
}

declare const module: { exports: { streamReturningOperators: typeof streamReturningOperators; promiseReturningOperators: typeof promiseReturningOperators } }
module.exports.streamReturningOperators = streamReturningOperators
module.exports.promiseReturningOperators = promiseReturningOperators

export = module.exports
