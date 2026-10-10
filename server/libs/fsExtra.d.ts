// Promise and stream APIs used by migrated code. Runtime implementation remains embedded JavaScript.
import type { PathLike } from 'fs'

export { createReadStream, createWriteStream } from 'fs'
export const stat: typeof import('fs/promises').stat
export const lstat: typeof import('fs/promises').lstat
export const readFile: typeof import('fs/promises').readFile
export const writeFile: typeof import('fs/promises').writeFile
export const readdir: typeof import('fs/promises').readdir
export function pathExists(path: PathLike): Promise<boolean>
export function remove(path: PathLike): Promise<void>

export function ensureDir(path: PathLike): Promise<void | string>
