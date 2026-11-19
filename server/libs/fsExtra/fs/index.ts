// This is adapted from https://github.com/normalize/mz
// Copyright (c) 2014-2016 Jonathan Ong me@jongleberry.com and Contributors
import universalify from '../../universalify'
import fs from 'graceful-fs'
import type { PathLike, ReadPosition } from 'node:fs'

const u = universalify.fromCallback

const api = [
  'access',
  'appendFile',
  'chmod',
  'chown',
  'close',
  'copyFile',
  'fchmod',
  'fchown',
  'fdatasync',
  'fstat',
  'fsync',
  'ftruncate',
  'futimes',
  'lchmod',
  'lchown',
  'link',
  'lstat',
  'mkdir',
  'mkdtemp',
  'open',
  'opendir',
  'readdir',
  'readFile',
  'readlink',
  'realpath',
  'rename',
  'rm',
  'rmdir',
  'stat',
  'symlink',
  'truncate',
  'unlink',
  'utimes',
  'writeFile'
] as const

type AsyncMethod = typeof api[number]
type Fs = typeof fs
type ReadCallback<Buffer extends NodeJS.ArrayBufferView> = (error: NodeJS.ErrnoException | null, bytesRead: number, buffer: Buffer) => void
type WrappedFs = Omit<Fs, AsyncMethod | 'exists' | 'read' | 'write' | 'writev'> & {
  [Method in Exclude<AsyncMethod, 'realpath'>]: Fs[Method] & Fs[Method]['__promisify__']
} & {
  exists: typeof exists
  read: typeof read
  write: Fs['write'] & Fs['write']['__promisify__']
  writev: Fs['writev'] & Fs['writev']['__promisify__']
  realpath: Fs['realpath'] & Fs['realpath']['__promisify__'] & {
    native: Fs['realpath']['native'] & Fs['realpath']['__promisify__']
  }
}

const availableMethods = api.filter(key => {
  // Some commands are not available on some systems. Ex:
  // fs.opendir was added in Node.js v12.12.0
  // fs.rm was added in Node.js v14.14.0
  // fs.lchown is not available on at least some Linux
  return typeof fs[key] === 'function'
})

// Clone fs and replace the async methods with their callback and promise forms.
const wrappedFs: Record<string, unknown> = Object.assign({}, fs)

// Universalify async methods:
availableMethods.forEach(method => {
  // Each wrapper forwards its method's arguments and appends a callback in promise mode.
  wrappedFs[method] = u(fs[method] as (...args: unknown[]) => void)
})

// We differ from mz/fs in that we still ship the old, broken, fs.exists()
// since we are a drop-in replacement for the native module
function exists(filename: PathLike): Promise<boolean>
function exists(filename: PathLike, callback: (exists: boolean) => void): void
function exists(filename: PathLike, callback?: (exists: boolean) => void) {
  if (typeof callback === 'function') {
    return fs.exists(filename, callback)
  }
  return new Promise(resolve => {
    return fs.exists(filename, resolve)
  })
}
wrappedFs.exists = exists

// fs.read(), fs.write(), & fs.writev() need special treatment due to multiple callback args

function read<Buffer extends NodeJS.ArrayBufferView>(fd: number, buffer: Buffer, offset: number, length: number, position: ReadPosition | null): Promise<{ bytesRead: number; buffer: Buffer }>
function read<Buffer extends NodeJS.ArrayBufferView>(fd: number, buffer: Buffer, offset: number, length: number, position: ReadPosition | null, callback: ReadCallback<Buffer>): void
function read<Buffer extends NodeJS.ArrayBufferView>(
  fd: number, buffer: Buffer, offset: number, length: number, position: ReadPosition | null, callback?: ReadCallback<Buffer>
) {
  if (typeof callback === 'function') {
    return fs.read(fd, buffer, offset, length, position, callback)
  }
  return new Promise<{ bytesRead: number; buffer: Buffer }>((resolve, reject) => {
    fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
      if (err) return reject(err)
      resolve({ bytesRead, buffer })
    })
  })
}
wrappedFs.read = read

// Function signature can be
// fs.write(fd, buffer[, offset[, length[, position]]], callback)
// OR
// fs.write(fd, string[, position[, encoding]], callback)
// We need to handle both cases, so we use ...args
wrappedFs.write = function (fd: number, buffer: string | NodeJS.ArrayBufferView, ...args: unknown[]): void | Promise<{ bytesWritten: number; buffer: typeof buffer }> {
  if (typeof args[args.length - 1] === 'function') {
    return Reflect.apply(fs.write, fs, [fd, buffer, ...args]) as void
  }

  return new Promise<{ bytesWritten: number; buffer: typeof buffer }>((resolve, reject) => {
    const callback = (err: NodeJS.ErrnoException | null, bytesWritten: number, buffer: string | NodeJS.ArrayBufferView) => {
      if (err) return reject(err)
      resolve({ bytesWritten, buffer })
    }
    Reflect.apply(fs.write, fs, [fd, buffer, ...args, callback])
  })
}

// fs.writev only available in Node v12.9.0+
if (typeof fs.writev === 'function') {
  // Function signature is
  // s.writev(fd, buffers[, position], callback)
  // We need to handle the optional arg, so we use ...args
  wrappedFs.writev = function (fd: number, buffers: readonly NodeJS.ArrayBufferView[], ...args: unknown[]): void | Promise<{ bytesWritten: number; buffers: typeof buffers }> {
    if (typeof args[args.length - 1] === 'function') {
      return Reflect.apply(fs.writev, fs, [fd, buffers, ...args]) as void
    }

    return new Promise<{ bytesWritten: number; buffers: typeof buffers }>((resolve, reject) => {
      const callback = (err: NodeJS.ErrnoException | null, bytesWritten: number, buffers: readonly NodeJS.ArrayBufferView[]) => {
        if (err) return reject(err)
        resolve({ bytesWritten, buffers })
      }
      Reflect.apply(fs.writev, fs, [fd, buffers, ...args, callback])
    })
  }
}

// fs.realpath.native sometimes not available if fs is monkey-patched
if (typeof fs.realpath.native === 'function') {
  Object.assign(wrappedFs.realpath as object, { native: u(fs.realpath.native) })
} else {
  process.emitWarning(
    'fs.realpath.native is not a function. Is fs being monkey-patched?',
    'Warning', 'fs-extra-WARN0003'
  )
}

// The dynamic assignments above preserve each native callback signature and add its promise form.
export = wrappedFs as WrappedFs
