import { EventEmitter } from 'events'

interface WatcherOptions {
  ignored?: RegExp
  renameDetection?: boolean
  renameTimeout?: number
  recursive?: boolean
  ignoreInitial?: boolean
  persistent?: boolean
}

interface WatcherEvents {
  add: [path: string]
  change: [path: string]
  unlink: [path: string]
  rename: [from: string, to: string]
  error: [error: Error]
  ready: []
  close: []
}

declare class Watcher extends EventEmitter<WatcherEvents> {
  constructor(paths: string[], options?: WatcherOptions)
  close(): boolean
}

export = Watcher
