"use strict";
/* IMPORT */
/* PROMISE CONCURRENCY LIMITER */
class Limiter {
  /* CONSTRUCTOR */
  constructor(options) {
    this.concurrency = options.concurrency;
    this.count = 0;
    this.queue = new Set();
  }
  /* API */
  add(fn) {
    if (this.count < this.concurrency)
      return this.run(fn);
    return new Promise(resolve => {
      const callback = () => resolve(this.run(fn));
      this.queue.add(callback);
    });
  }
  flush() {
    for (const callback of this.queue) {
      if (this.count >= this.concurrency)
        break;
      this.queue.delete(callback);
      callback();
    }
  }
  run(fn) {
    this.count += 1;
    const promise = fn();
    const cleanup = () => {
      this.count -= 1;
      this.flush();
    };
    promise.then(cleanup, cleanup);
    return promise;
  }
}
module.exports = Limiter;
module.exports.default = Limiter;
Object.defineProperty(module.exports, "__esModule", { value: true });
