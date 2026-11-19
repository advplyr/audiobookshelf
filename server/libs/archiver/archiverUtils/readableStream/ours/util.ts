import bufferModule from 'node:buffer'

const AsyncFunction = (Object.getPrototypeOf(async function () {}) as { constructor: typeof Function }).constructor
const Blob = globalThis.Blob || bufferModule.Blob

const isBlob =
  typeof Blob !== 'undefined'
    ? function isBlob(b: unknown) {
        return b instanceof Blob
      }
    : function isBlob(b: unknown) {
        void b
        return false
      }
// This is a simplified version of AggregateError

class AggregateError extends Error {
  declare errors: readonly Pick<Error, 'stack'>[]

  constructor(errors: readonly Pick<Error, 'stack'>[]) {
    const input: unknown = errors
    if (!Array.isArray(input)) {
      throw new TypeError(`Expected input to be an Array, got ${typeof errors}`)
    }

    let message = ''

    for (let i = 0; i < errors.length; i++) {
      message += `    ${errors[i].stack}\n`
    }

    super(message)
    this.name = 'AggregateError'
    this.errors = errors
  }
}

type FormatValue = string | number | boolean | bigint | symbol | object | null | undefined

const util = {
  AggregateError,

  once<Receiver, Args extends unknown[]>(callback: (this: Receiver, ...args: Args) => unknown) {
    let called = false
    return function (this: Receiver, ...args: Args) {
      if (called) {
        return
      }

      called = true
      callback.apply(this, args)
    }
  },

  createDeferredPromise: function <Value = void>() {
    let resolve!: (value: Value | PromiseLike<Value>) => void
    let reject!: (reason?: unknown) => void

    const promise = new Promise<Value>((res, rej) => {
      resolve = res
      reject = rej
    })
    return {
      promise,
      resolve,
      reject
    }
  },

  promisify<Value>(this: void, fn: (callback: (error?: Error | null, value?: Value) => void) => void) {
    return new Promise<Value | undefined>((resolve, reject) => {
      fn((err, ...args) => {
        if (err) {
          return reject(err)
        }

        return resolve(args[0])
      })
    })
  },

  debuglog() {
    return function () {}
  },

  format(format: string, ...args: FormatValue[]) {
    // Simplified version of https://nodejs.org/api/util.html#utilformatformat-args
    return format.replace(/%([sdifj])/g, function (...matches: [string, string, ...unknown[]]) {
      const type = matches[1]
      const replacement = args.shift()

      if (type === 'f') {
        return (replacement as number).toFixed(6)
      } else if (type === 'j') {
        return JSON.stringify(replacement)
      } else if (type === 's' && typeof replacement === 'object') {
        const ctor = replacement!.constructor !== Object ? replacement!.constructor.name : ''
        return `${ctor} {}`.trim()
      } else {
        const formatted = replacement as { toString(): string }
        return formatted.toString()
      }
    })
  },

  inspect(value: unknown) {
    // Vastly simplified version of https://nodejs.org/api/util.html#utilinspectobject-options
    switch (typeof value) {
      case 'string':
        if (value.includes("'")) {
          if (!value.includes('"')) {
            return `"${value}"`
          } else if (!value.includes('`') && !value.includes('${')) {
            return `\`${value}\``
          }
        }

        return `'${value}'`

      case 'number':
        if (isNaN(value)) {
          return 'NaN'
        } else if (Object.is(value, -0)) {
          return String(value)
        }

        return value

      case 'bigint':
        return `${String(value)}n`

      case 'boolean':
      case 'undefined':
        return String(value)

      case 'object':
        return '{}'
    }
  },

  types: {
    isAsyncFunction(this: void, fn: unknown) {
      return fn instanceof AsyncFunction
    },

    isArrayBufferView(this: void, arr: unknown) {
      return ArrayBuffer.isView(arr)
    }
  },
  isBlob
}
const promisify = util.promisify as typeof util.promisify & { custom: symbol }
promisify.custom = Symbol.for('nodejs.util.promisify.custom')

export = util as typeof util & { promisify: typeof promisify }
