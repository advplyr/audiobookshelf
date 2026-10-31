export const LIST: 1

export interface FileEntry {
  name: string
  path: string
  fullname: string
  extension: string
  deep: number
  error?: unknown
}

// These options enable the fields consumed by fileUtils.recurseFiles.
export interface ListOptions {
  mode: typeof LIST
  recursive: boolean
  stats: false
  ignoreFolders: true
  extensions: true
  deep: true
  realPath: true
  normalizePath: false
}

export function list(path: string, options: ListOptions): Promise<(FileEntry[] & { error?: undefined }) | { error: Error; path: string }>
