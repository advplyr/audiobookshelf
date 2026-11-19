import { EventEmitter as EE } from 'node:events'
import primordials from '../../ours/primordials'

const { ArrayIsArray, ObjectSetPrototypeOf } = primordials

type EventEmitterOptions = ConstructorParameters<typeof EE>[0]
type StreamListener = (this: EE, ...args: unknown[]) => void
type LegacyEmitter = Pick<EE, 'on'> & {
  prependListener?: EE['prependListener']
  _events?: Record<string, StreamListener | StreamListener[]>
}

interface LegacyDestination extends EE {
  writable?: boolean
  _isStdio?: boolean
  write(chunk: unknown): boolean
  end(): unknown
  destroy?(): unknown
}

interface LegacyStream extends EE {
  readable?: boolean
  pause?(): unknown
  resume?(): unknown
  pipe<T extends LegacyDestination>(destination: T, options?: { end?: boolean }): T
}

const Stream = function (this: LegacyStream, opts?: EventEmitterOptions) {
  EE.call(this, opts)
} as unknown as {
  (this: LegacyStream, options?: EventEmitterOptions): void
  new (options?: EventEmitterOptions): LegacyStream
  prototype: LegacyStream
}

ObjectSetPrototypeOf(Stream.prototype, EE.prototype)
ObjectSetPrototypeOf(Stream, EE)

Stream.prototype.pipe = function (dest, options) {
  const ondata = (chunk: unknown) => {
    if (dest.writable && dest.write(chunk) === false && this.pause) {
      this.pause()
    }
  }

  this.on('data', ondata)

  const ondrain = () => {
    if (this.readable && this.resume) {
      this.resume()
    }
  }

  dest.on('drain', ondrain) // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.

  if (!dest._isStdio && (!options || options.end !== false)) {
    this.on('end', onend)
    this.on('close', onclose)
  }

  let didOnEnd = false

  function onend() {
    if (didOnEnd) return
    didOnEnd = true
    dest.end()
  }

  function onclose() {
    if (didOnEnd) return
    didOnEnd = true
    if (typeof dest.destroy === 'function') dest.destroy()
  } // Don't leave dangling pipes when there are errors.

  function onerror(this: EE, er: unknown) {
    cleanup()

    if (EE.listenerCount(this, 'error') === 0) {
      this.emit('error', er)
    }
  }

  // Remove all the event listeners that were added.
  const cleanup = () => {
    this.removeListener('data', ondata)
    dest.removeListener('drain', ondrain)
    this.removeListener('end', onend)
    this.removeListener('close', onclose)
    this.removeListener('error', onerror)
    dest.removeListener('error', onerror)
    this.removeListener('end', cleanup)
    this.removeListener('close', cleanup)
    dest.removeListener('close', cleanup)
  }

  prependListener(this, 'error', onerror)
  prependListener(dest, 'error', onerror)

  this.on('end', cleanup)
  this.on('close', cleanup)
  dest.on('close', cleanup)
  dest.emit('pipe', this) // Allow for unix-like usage: A.pipe(B).pipe(C)

  return dest
}

function prependListener(emitter: LegacyEmitter, event: string, fn: StreamListener) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn) // This is a hack to make sure that our error handler is attached before any
  // userland ones.  NEVER DO THIS. This is here only because this code needs
  // to continue to work with older versions of Node.js that do not include
  // the prependListener() method. The goal is to eventually remove this hack.

  const listeners = emitter._events?.[event]
  if (!listeners) emitter.on(event, fn)
  else if (ArrayIsArray(listeners)) listeners.unshift(fn)
  else emitter._events![event] = [fn, listeners]
}

export = {
  Stream,
  prependListener
}
