// A declaration named wasm-libarchive.d.ts would shadow the generated loader
// and prevent the server build from copying it into dist-server.
export type LoadLibarchive = <Settings extends { locateFile(path: string, prefix: string): string }>(settings: Settings) => Loading<Settings>

// The generated loader augments the settings object in place and invokes
// this callback once the WASM runtime is ready. Its then method returns itself.
type Loading<Settings> = Settings & {
  then(callback: (module: Loading<Settings> & LibarchiveRuntime) => void): Loading<Settings>
}

type CInput = { number: number; string: string | null }
type COutput = { number: number; string: string }

export interface LibarchiveRuntime {
  HEAP8: Int8Array
  _free(pointer: number): void
  allocate(bytes: number[], type: string, allocator: number): number
  intArrayFromString(value: string): number[]
  cwrap<Args extends (keyof CInput)[], Kind extends keyof COutput | null>(
    name: string,
    returnType: Kind,
    argumentTypes: [...Args]
  ): (...args: { [Index in keyof Args]: CInput[Args[Index]] }) => Kind extends keyof COutput ? COutput[Kind] : void
}
