export type ArchiveInput = Buffer | Uint8Array | ArrayBuffer | null

export interface ArchiveEntry {
  size: number
  path: string
  type: string | undefined
  ref: number
  fileName?: string
  fileData?: Int8Array
}

export type ExtractedEntry = ArchiveEntry & { fileData: Int8Array }

export type ArchiveRequest =
  | { type: 'HELLO' | 'LIST_FILES' | 'EXTRACT_FILES' | 'CHECK_ENCRYPTION' }
  | { type: 'OPEN'; file: ArchiveInput }
  | { type: 'EXTRACT_SINGLE_FILE'; target: string }
  | { type: 'SET_PASSPHRASE'; passphrase: string | null }

export type ArchiveResponse =
  | { type: 'READY' | 'BUSY' | 'OPENED' | 'END' }
  | { type: 'ENTRY'; entry: ArchiveEntry }
  | { type: 'FILE'; entry: ExtractedEntry }
  | { type: 'ENCRYPTION_STATUS'; status: boolean | null }
  | { type: 'PASSPHRASE_STATUS'; status: boolean }
  | { type: 'ERROR'; error: { message: string; name: string; stack?: string } }
