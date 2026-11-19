import type { InspectOptions } from 'node:util'
import util from './util'

const { format, AggregateError: CustomAggregateError } = util
const inspect: (value: unknown, options?: InspectOptions) => ReturnType<typeof util.inspect> = util.inspect
/*
  This file is a reduced and adapted version of the main lib/internal/errors.js file defined at

  https://github.com/nodejs/node/blob/master/lib/internal/errors.js

  Don't try to replace with the original file and keep it up to date (starting from E(...) definitions)
  with the upstream file.
*/

interface CodedError extends Error {
  code?: string
  errors?: unknown[]
}

interface NodeError extends Error {
  code: string
  [kIsNodeError]: true
}

type NodeErrorConstructor = new (...args: unknown[]) => NodeError
type ErrorBase = new (message: string) => Error

const AggregateError: new (errors: Error[], message?: string) => CodedError = globalThis.AggregateError || CustomAggregateError
const kIsNodeError = Symbol('kIsNodeError')
const kTypes = [
  'string',
  'function',
  'number',
  'object', // Accept 'Function' and 'Object' as alternative to the lower cased version.
  'Function',
  'Object',
  'boolean',
  'bigint',
  'symbol'
]
const classRegExp = /^([A-Z][a-z0-9]*)+$/
const nodeInternalPrefix = '__node_internal_'
const codes: Record<string, NodeErrorConstructor | undefined> = {}

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new codes.ERR_INTERNAL_ASSERTION!(message)
  }
} // Only use this for integers! Decimal numbers do not work with this function.

function addNumericalSeparator(val: string) {
  let res = ''
  let i = val.length
  const start = val[0] === '-' ? 1 : 0

  for (; i >= start + 4; i -= 3) {
    res = `_${val.slice(i - 3, i)}${res}`
  }

  return `${val.slice(0, i)}${res}`
}

function getMessage<Args extends unknown[]>(key: string, msg: string | ((...args: Args) => string), args: Args) {
  if (typeof msg === 'function') {
    assert(
      msg.length <= args.length, // Default options do not count.
      `Code: ${key}; The provided arguments length (${args.length}) does not match the required ones (${msg.length}).`
    )
    return msg(...args)
  }

  const expectedLength = (msg.match(/%[dfijoOs]/g) || []).length
  assert(
    expectedLength === args.length,
    `Code: ${key}; The provided arguments length (${args.length}) does not match the required ones (${expectedLength}).`
  )

  if (args.length === 0) {
    return msg
  }

  return format(msg, ...args)
}

function E<Args extends unknown[]>(code: string, message: string | ((...args: Args) => string), Base?: ErrorBase) {
  if (!Base) {
    Base = Error
  }

  class NodeError extends Base {
    declare code: string
    declare [kIsNodeError]: true

    constructor(...args: Args) {
      super(getMessage(code, message, args))
    }

    toString() {
      return `${this.name} [${code}]: ${this.message}`
    }
  }

  NodeError.prototype.name = Base.name
  NodeError.prototype.code = code
  NodeError.prototype[kIsNodeError] = true

  NodeError.prototype.toString = function () {
    return `${this.name} [${code}]: ${this.message}`
  }

  // Each code has its own formatter and the exported map dispatches by code.
  codes[code] = NodeError as unknown as NodeErrorConstructor
}

function hideStackFrames<Args extends unknown[], Result>(fn: (...args: Args) => Result) {
  // We rename the functions that will be hidden to cut off the stacktrace
  // at the outermost one
  const hidden = nodeInternalPrefix + fn.name
  Object.defineProperty(fn, 'name', {
    value: hidden
  })
  return fn
}

function aggregateTwoErrors(innerError: CodedError | null | undefined, outerError: CodedError | null | undefined) {
  if (innerError && outerError && innerError !== outerError) {
    if (Array.isArray(outerError.errors)) {
      // If `outerError` is already an `AggregateError`.
      outerError.errors.push(innerError)
      return outerError
    }

    const err = new AggregateError([outerError, innerError], outerError.message)
    err.code = outerError.code
    return err
  }

  return innerError || outerError
}

class AbortError extends Error {
  declare code: string

  constructor(message = 'The operation was aborted', options?: ErrorOptions | null) {
    if (options !== undefined && typeof options !== 'object') {
      throw new codes.ERR_INVALID_ARG_TYPE!('options', 'Object', options)
    }

    super(message, options as ErrorOptions | undefined)
    this.code = 'ABORT_ERR'
    this.name = 'AbortError'
  }
}

E('ERR_ASSERTION', '%s', Error)
E(
  'ERR_INVALID_ARG_TYPE',
  (name: unknown, expected: unknown, actual: unknown) => {
    assert(typeof name === 'string', "'name' must be a string")

    const descriptions: unknown[] = Array.isArray(expected) ? expected : [expected]

    let msg = 'The '

    if (name.endsWith(' argument')) {
      // For cases like 'first argument'
      msg += `${name} `
    } else {
      msg += `"${name}" ${name.includes('.') ? 'property' : 'argument'} `
    }

    msg += 'must be '
    const types: (string | number)[] = []
    const instances: string[] = []
    const other: string[] = []

    for (const value of descriptions) {
      assert(typeof value === 'string', 'All expected entries have to be of type string')

      if (kTypes.includes(value)) {
        types.push(value.toLowerCase())
      } else if (classRegExp.test(value)) {
        instances.push(value)
      } else {
        assert(value !== 'object', 'The value "object" should be written as "Object"')
        other.push(value)
      }
    } // Special handle `object` in case other instances are allowed to outline
    // the differences between each other.

    if (instances.length > 0) {
      const pos = types.indexOf('object')

      if (pos !== -1) {
        // Preserve the original coercion of the collected types into the splice index.
        types.splice(Number(types), pos, 1)
        instances.push('Object')
      }
    }

    if (types.length > 0) {
      switch (types.length) {
        case 1:
          msg += `of type ${types[0]}`
          break

        case 2:
          msg += `one of type ${types[0]} or ${types[1]}`
          break

        default: {
          const last = types.pop()
          msg += `one of type ${types.join(', ')}, or ${last}`
        }
      }

      if (instances.length > 0 || other.length > 0) {
        msg += ' or '
      }
    }

    if (instances.length > 0) {
      switch (instances.length) {
        case 1:
          msg += `an instance of ${instances[0]}`
          break

        case 2:
          msg += `an instance of ${instances[0]} or ${instances[1]}`
          break

        default: {
          const last = instances.pop()
          msg += `an instance of ${instances.join(', ')}, or ${last}`
        }
      }

      if (other.length > 0) {
        msg += ' or '
      }
    }

    switch (other.length) {
      case 0:
        break

      case 1:
        if (other[0].toLowerCase() !== other[0]) {
          msg += 'an '
        }

        msg += `${other[0]}`
        break

      case 2:
        msg += `one of ${other[0]} or ${other[1]}`
        break

      default: {
        const last = other.pop()
        msg += `one of ${other.join(', ')}, or ${last}`
      }
    }

    if (actual == null) {
      msg += `. Received ${actual}`
    } else if (typeof actual === 'function' && actual.name) {
      msg += `. Received function ${actual.name}`
    } else if (typeof actual === 'object') {
      var _actual$constructor

      if (
        (_actual$constructor = actual.constructor) !== null &&
        _actual$constructor !== undefined &&
        _actual$constructor.name
      ) {
        msg += `. Received an instance of ${actual.constructor.name}`
      } else {
        const inspected = inspect(actual, {
          depth: -1
        })
        msg += `. Received ${inspected}`
      }
    } else {
      let inspected = inspect(actual, {
        colors: false
      })

      if ((inspected as string).length > 25) {
        inspected = `${(inspected as string).slice(0, 25)}...`
      }

      msg += `. Received type ${typeof actual} (${inspected})`
    }

    return msg
  },
  TypeError
)
E(
  'ERR_INVALID_ARG_VALUE',
  (name: string, value: unknown, reason: string = 'is invalid') => {
    let inspected = inspect(value)

    if ((inspected as string).length > 128) {
      inspected = (inspected as string).slice(0, 128) + '...'
    }

    const type = name.includes('.') ? 'property' : 'argument'
    return `The ${type} '${name}' ${reason}. Received ${inspected}`
  },
  TypeError
)
E(
  'ERR_INVALID_RETURN_VALUE',
  (input: string, name: string, value: unknown) => {
    var _value$constructor

    const type =
      value !== null &&
      value !== undefined &&
      (_value$constructor = value.constructor) !== null &&
      _value$constructor !== undefined &&
      _value$constructor.name
        ? `instance of ${value.constructor.name}`
        : `type ${typeof value}`
    return `Expected ${input} to be returned from the "${name}"` + ` function but got ${type}.`
  },
  TypeError
)
E(
  'ERR_MISSING_ARGS',
  (...input: string[]) => {
    assert(input.length > 0, 'At least one arg needs to be specified')
    let msg: string | undefined
    const len = input.length
    const args = (Array.isArray(input) ? input : [input]).map((a) => `"${a}"`).join(' or ') as string & Partial<Pick<string[], 'pop' | 'join'>>

    switch (len) {
      case 1:
        msg += `The ${args[0]} argument`
        break

      case 2:
        msg += `The ${args[0]} and ${args[1]} arguments`
        break

      default:
        {
          const last = args.pop!()
          msg += `The ${args.join!(', ')}, and ${last} arguments`
        }
        break
    }

    return `${msg} must be specified`
  },
  TypeError
)
E(
  'ERR_OUT_OF_RANGE',
  (str: string, range: string, input: unknown) => {
    assert(range, 'Missing "range" argument')
    let received

    if (Number.isInteger(input) && Math.abs(input as number) > 2 ** 32) {
      received = addNumericalSeparator(String(input))
    } else if (typeof input === 'bigint') {
      received = String(input)

      if (input > 2n ** 32n || input < -(2n ** 32n)) {
        received = addNumericalSeparator(received)
      }

      received += 'n'
    } else {
      received = inspect(input)
    }

    return `The value of "${str}" is out of range. It must be ${range}. Received ${received}`
  },
  RangeError
)
E('ERR_MULTIPLE_CALLBACK', 'Callback called multiple times', Error)
E('ERR_METHOD_NOT_IMPLEMENTED', 'The %s method is not implemented', Error)
E('ERR_STREAM_ALREADY_FINISHED', 'Cannot call %s after a stream was finished', Error)
E('ERR_STREAM_CANNOT_PIPE', 'Cannot pipe, not readable', Error)
E('ERR_STREAM_DESTROYED', 'Cannot call %s after a stream was destroyed', Error)
E('ERR_STREAM_NULL_VALUES', 'May not write null values to stream', TypeError)
E('ERR_STREAM_PREMATURE_CLOSE', 'Premature close', Error)
E('ERR_STREAM_PUSH_AFTER_EOF', 'stream.push() after EOF', Error)
E('ERR_STREAM_UNSHIFT_AFTER_END_EVENT', 'stream.unshift() after end event', Error)
E('ERR_STREAM_WRITE_AFTER_END', 'write after end', Error)
E('ERR_UNKNOWN_ENCODING', 'Unknown encoding: %s', TypeError)
export = {
  AbortError,
  aggregateTwoErrors: hideStackFrames(aggregateTwoErrors),
  hideStackFrames,
  codes
}
