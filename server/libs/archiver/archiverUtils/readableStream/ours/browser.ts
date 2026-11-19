import CustomStream from '../stream'
import promises from '../stream/promises'

type Destroy = typeof CustomStream.destroy
type BrowserMembers = Omit<typeof CustomStream, 'promises' | 'destroy'> & {
  destroy?: Destroy
  default: BrowserStream
}
type BrowserStream = BrowserMembers & Pick<typeof CustomStream.Readable, 'from'> & {
  new (...args: ConstructorParameters<typeof CustomStream.Readable>): InstanceType<typeof CustomStream.Readable>
}

// Keep the individual CommonJS assignments for named ESM imports.
declare const module: { exports: Partial<BrowserMembers> }

const Readable: typeof CustomStream.Readable & { destroy?: Destroy } = CustomStream.Readable
const originalDestroy = Readable.destroy
module.exports = Readable as unknown as Partial<BrowserMembers>

module.exports._uint8ArrayToBuffer = CustomStream._uint8ArrayToBuffer
module.exports._isUint8Array = CustomStream._isUint8Array
module.exports.isDisturbed = CustomStream.isDisturbed
module.exports.isErrored = CustomStream.isErrored
module.exports.isReadable = CustomStream.isReadable
module.exports.Readable = CustomStream.Readable
module.exports.Writable = CustomStream.Writable
module.exports.Duplex = CustomStream.Duplex
module.exports.Transform = CustomStream.Transform
module.exports.PassThrough = CustomStream.PassThrough
module.exports.addAbortSignal = CustomStream.addAbortSignal
module.exports.finished = CustomStream.finished
module.exports.destroy = CustomStream.destroy
module.exports.destroy = originalDestroy
module.exports.pipeline = CustomStream.pipeline
module.exports.compose = CustomStream.compose
Object.defineProperty(CustomStream, 'promises', {
  configurable: true,
  enumerable: true,

  get() {
    return promises
  }
})
module.exports.Stream = CustomStream.Stream // Allow default importing

const exported = module.exports as BrowserStream
module.exports.default = exported

export = exported
