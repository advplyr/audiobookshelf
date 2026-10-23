// Async ZIP operations consumed by the migrated EPUB and comic readers.
declare namespace StreamZip {
  class async {
    constructor(options: { file: string })
    entries(): Promise<Record<string, { isDirectory: boolean }>>
    entryData(entry: string): Promise<Buffer>
    extract(entry: string, outputPath: string): Promise<number | undefined>
    close(): Promise<void>
  }
}

export = StreamZip
