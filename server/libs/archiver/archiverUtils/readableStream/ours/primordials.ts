/*
  This file is a reduced and adapted version of the main lib/internal/per_context/primordials.js file defined at

  https://github.com/nodejs/node/blob/master/lib/internal/per_context/primordials.js

  Don't try to replace with the original file and keep it up to date with the upstream file.
*/

export = {
  ArrayIsArray(this: void, self: unknown): self is unknown[] {
    return Array.isArray(self)
  },

  ArrayPrototypeIncludes<T>(this: void, self: readonly T[], el: T) {
    return self.includes(el)
  },

  ArrayPrototypeIndexOf<T>(this: void, self: readonly T[], el: T) {
    return self.indexOf(el)
  },

  ArrayPrototypeJoin(this: void, self: readonly unknown[], sep?: string) {
    return self.join(sep)
  },

  ArrayPrototypeMap<T, U>(this: void, self: readonly T[], fn: (value: T, index: number, array: readonly T[]) => U) {
    return self.map(fn)
  },

  ArrayPrototypePop<T>(this: void, self: { pop(element?: unknown): T | undefined }, el?: unknown) {
    return self.pop(el)
  },

  ArrayPrototypePush<T>(this: void, self: T[], el: T) {
    return self.push(el)
  },

  ArrayPrototypeSlice<T>(this: void, self: readonly T[], start?: number, end?: number) {
    return self.slice(start, end)
  },

  Error,

  FunctionPrototypeCall<Receiver, Args extends unknown[], Result>(this: void, fn: (this: Receiver, ...args: Args) => Result, thisArgs: Receiver, ...args: Args) {
    return fn.call(thisArgs, ...args)
  },

  FunctionPrototypeSymbolHasInstance(this: void, self: object, instance: unknown) {
    return Function.prototype[Symbol.hasInstance].call(self, instance)
  },

  MathFloor: Math.floor,
  Number,
  NumberIsInteger: Number.isInteger,
  NumberIsNaN: Number.isNaN,
  NumberMAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
  NumberMIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER,
  NumberParseInt: Number.parseInt,

  ObjectDefineProperties<T extends object>(this: void, self: T, props: PropertyDescriptorMap) {
    return Object.defineProperties(self, props)
  },

  ObjectDefineProperty<T extends object>(this: void, self: T, name: PropertyKey, prop: PropertyDescriptor) {
    return Object.defineProperty(self, name, prop)
  },

  ObjectGetOwnPropertyDescriptor(this: void, self: object, name: PropertyKey) {
    return Object.getOwnPropertyDescriptor(self, name)
  },

  ObjectKeys(this: void, obj: object) {
    return Object.keys(obj)
  },

  ObjectSetPrototypeOf<T extends object>(this: void, target: T, proto: object | null) {
    return Object.setPrototypeOf(target, proto) as T
  },

  Promise,

  PromisePrototypeCatch<T, U>(this: void, self: Promise<T>, fn?: ((reason: unknown) => U | PromiseLike<U>) | null) {
    return self.catch(fn)
  },

  PromisePrototypeThen<T, U = T, V = never>(this: void, self: Promise<T>, thenFn?: ((value: T) => U | PromiseLike<U>) | null, catchFn?: ((reason: unknown) => V | PromiseLike<V>) | null) {
    return self.then(thenFn, catchFn)
  },

  PromiseReject(this: void, err: Error) {
    return Promise.reject(err)
  },

  ReflectApply: Reflect.apply,

  RegExpPrototypeTest(this: void, self: RegExp, value: string) {
    return self.test(value)
  },

  SafeSet: Set,
  String,

  StringPrototypeSlice(this: void, self: string, start?: number, end?: number) {
    return self.slice(start, end)
  },

  StringPrototypeToLowerCase(this: void, self: string) {
    return self.toLowerCase()
  },

  StringPrototypeToUpperCase(this: void, self: string) {
    return self.toUpperCase()
  },

  StringPrototypeTrim(this: void, self: string) {
    return self.trim()
  },

  Symbol,
  SymbolAsyncIterator: Symbol.asyncIterator,
  SymbolHasInstance: Symbol.hasInstance,
  SymbolIterator: Symbol.iterator,

  TypedArrayPrototypeSet(this: void, self: Uint8Array, buf: ArrayLike<number>, len?: number) {
    return self.set(buf, len)
  },

  Uint8Array
}
