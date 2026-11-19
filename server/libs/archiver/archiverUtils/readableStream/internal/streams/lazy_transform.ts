// LazyTransform is a special type of Transform stream that is lazily loaded.
// This is used for performance with bi-API-ship: when two APIs are available
// for the stream, one conventional and one non-conventional.
import { createRequire } from 'node:module'
import type { Transform, TransformOptions } from 'node:stream'
import primordials from '../../ours/primordials'

const { ObjectDefineProperties, ObjectDefineProperty, ObjectSetPrototypeOf } = primordials

type StateName = '_readableState' | '_writableState'

interface LazyStream extends Transform {
  _options?: TransformOptions
  _readableState: unknown
  _writableState: { decodeStrings: boolean; defaultEncoding: string }
}

const load = createRequire(__filename)
const stream = load('../../stream') as {
  Transform: {
    (this: LazyStream, options?: TransformOptions): void
    prototype: Transform
  }
}

const getDefaultEncoding = () => 'buffer'

const LazyTransform = function (this: LazyStream, options?: TransformOptions) {
  this._options = options
} as unknown as {
  new (options?: TransformOptions): LazyStream
  prototype: LazyStream
}

ObjectSetPrototypeOf(LazyTransform.prototype, stream.Transform.prototype)
ObjectSetPrototypeOf(LazyTransform, stream.Transform)

function makeGetter(name: StateName) {
  return function (this: LazyStream) {
    stream.Transform.call(this, this._options)
    this._writableState.decodeStrings = false

    if (!this._options || !this._options.defaultEncoding) {
      this._writableState.defaultEncoding = getDefaultEncoding()
    }

    return this[name]
  }
}

function makeSetter(name: StateName) {
  return function (this: LazyStream, val: unknown) {
    ObjectDefineProperty(this, name, {
      value: val,
      enumerable: true,
      configurable: true,
      writable: true
    })
  }
}

ObjectDefineProperties(LazyTransform.prototype, {
  _readableState: {
    get: makeGetter('_readableState'),
    set: makeSetter('_readableState'),
    configurable: true,
    enumerable: true
  },
  _writableState: {
    get: makeGetter('_writableState'),
    set: makeSetter('_writableState'),
    configurable: true,
    enumerable: true
  }
})

export = LazyTransform
