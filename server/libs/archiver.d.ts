import type { Transform } from 'stream'

declare function archiver(format: 'zip', options: { zlib: { level: number } }): archiver.Archive

declare namespace archiver {
  // Boundary used by zipHelpers.
  interface Archive extends Transform {
    directory(path: string, destination: string | false): this
    file(path: string, data: { name: string }): this
    finalize(): Promise<void>
    pointer(): number
  }
}

export = archiver
