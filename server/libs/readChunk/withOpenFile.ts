import fs from 'node:fs'
import type { Mode, OpenMode, PathLike } from 'node:fs'
import pify from './pify'

type OpenArgs = [path: PathLike, flags?: OpenMode | null, mode?: Mode | null]
type FileCallback<Result> = (fd: number) => Result
type OpenWithCallback<Result> =
  | [path: PathLike, callback: FileCallback<Result>]
  | [path: PathLike, flags: OpenArgs[1], callback: FileCallback<Result>]
  | [path: PathLike, flags: OpenArgs[1], mode: OpenArgs[2], callback: FileCallback<Result>]

const pTry = <Args extends unknown[], Result>(fn: (...args: Args) => Result | PromiseLike<Result>, ...arguments_: Args) => new Promise<Result>(resolve => {
  resolve(fn(...arguments_));
})
const pFinally = <Result>(promise: Promise<Result>, onFinally?: () => unknown) => {
  onFinally = onFinally || (() => { });

  return promise.then(
    val => new Promise(resolve => {
      resolve(onFinally?.());
    }).then(() => val),
    err => new Promise(resolve => {
      resolve(onFinally?.());
    }).then(() => {
      throw err;
    })
  );
};


// pify wraps callback-based methods while keeping the same open arguments.
const fsP = pify(fs) as {
  open(...args: OpenArgs): Promise<number>
  close(fd: number): Promise<void>
}

function withOpenFile<Result>(...args: OpenWithCallback<Result | PromiseLike<Result>>): Promise<Result>
function withOpenFile<Result>(...args: (OpenArgs[number] | FileCallback<Result | PromiseLike<Result>>)[]) {
  const callback = args.pop() as FileCallback<Result | PromiseLike<Result>>
  return fsP
    .open(...args as OpenArgs)
    .then(fd => pFinally(pTry(callback, fd), () => fsP.close(fd)))
}

function sync<Result>(...args: OpenWithCallback<Result>): Result
function sync<Result>(...args: (OpenArgs[number] | FileCallback<Result>)[]) {
  const callback = args.pop() as FileCallback<Result>
  // Node defaults omitted flags to read-only even though the declaration requires flags.
  const openSync = fs.openSync as (...args: OpenArgs) => number
  const fd = openSync(...args as OpenArgs)
  try {
    return callback(fd)
  } finally {
    fs.closeSync(fd)
  }
}

export = Object.assign(withOpenFile, { sync })
