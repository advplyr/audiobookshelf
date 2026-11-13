//
// used by fsExtra
// Source: https://github.com/RyanZim/universalify
//

type Callback<Value> = (error: unknown, value?: Value) => void

interface Universal<Receiver, Args extends unknown[], Value> {
  (this: Receiver, ...args: Args): Promise<Value>
  (this: Receiver, ...args: [...Args, Callback<Value>]): void
}

function fromCallback<Receiver, Args extends unknown[], Value>(fn: (this: Receiver, ...args: [...Args, Callback<Value>]) => void): Universal<Receiver, Args, Value> {
  return Object.defineProperty(function (this: Receiver, ...args: Args | [...Args, Callback<Value>]) {
    if (typeof args[args.length - 1] === 'function') fn.apply(this, args as [...Args, Callback<Value>])
    else {
      return new Promise<Value>((resolve, reject) => {
        // The wrapped callback determines the rejection value.
        const fail: (error: unknown) => void = reject
        fn.call(
          this,
          ...args as Args,
          (err: unknown, res?: Value) => (err != null) ? fail(err) : resolve(res as Value)
        )
      })
    }
  }, 'name', { value: fn.name }) as Universal<Receiver, Args, Value>
}

function fromPromise<Receiver, Args extends unknown[], Value>(fn: (this: Receiver, ...args: Args) => Promise<Value>): Universal<Receiver, Args, Value> {
  return Object.defineProperty(function (this: Receiver, ...args: Args | [...Args, Callback<Value>]) {
    const cb = args[args.length - 1]
    if (typeof cb !== 'function') return fn.apply(this, args as Args)
    else {
      const callback = cb as Callback<Value>
      void fn.apply(this, args.slice(0, -1) as Args).then(r => callback(null, r), callback)
    }
  }, 'name', { value: fn.name }) as Universal<Receiver, Args, Value>
}
export = { fromCallback, fromPromise }
