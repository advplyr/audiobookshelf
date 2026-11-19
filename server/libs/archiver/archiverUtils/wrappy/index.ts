// Returns a wrapper function that returns a wrapped callback
// The wrapper function should do some stuff, and return a
// presumably different callback function.
// This makes sure that own properties are retained, so that
// decorations and such are not lost along the way.
function wrappy<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result
function wrappy<Callback, Result>(fn: (callback: Callback) => Result, cb: Callback): Result
function wrappy<Args extends unknown[], Result>(fn: (...args: Args) => Result, cb?: Args[0]): ((...args: Args) => Result) | Result {
  if (fn && cb) return wrappy(fn)(...([cb] as Args))

  if (typeof fn !== 'function')
    throw new TypeError('need wrapper function')

  const properties = fn as typeof fn & Record<string, unknown>
  Object.keys(fn).forEach(function (k) {
    Reflect.set(wrapper, k, properties[k])
  })

  return wrapper

  function wrapper(this: unknown, ...args: Args) {
    // Preserve the receiver of the original non-strict CommonJS wrapper.
    var ret = fn.apply(this == null ? globalThis : Object(this) as object, args)
    const returned: unknown = ret
    var cb = args[args.length - 1]
    if (typeof returned === 'function' && returned !== cb) {
      const properties = cb as Record<string, unknown>
      Object.keys(properties).forEach(function (k) {
        Reflect.set(returned, k, properties[k])
      })
    }
    return ret
  }
}

export = wrappy
