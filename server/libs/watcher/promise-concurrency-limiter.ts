/* IMPORT */
/* PROMISE CONCURRENCY LIMITER */
class Limiter {
  concurrency: number;
  count: number;
  queue: Set<() => void>;

  /* CONSTRUCTOR */
  constructor(options: { concurrency: number }) {
    this.concurrency = options.concurrency;
    this.count = 0;
    this.queue = new Set();
  }
  /* API */
  add<Result>(fn: () => Promise<Result>): Promise<Result> {
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
  run<Result>(fn: () => Promise<Result>): Promise<Result> {
    this.count += 1;
    const promise = fn();
    const cleanup = () => {
      this.count -= 1;
      this.flush();
    };
    void promise.then(cleanup, cleanup);
    return promise;
  }
}
const exported = Object.assign(Limiter, { default: Limiter });
Object.defineProperty(exported, "__esModule", { value: true });

export = exported;
