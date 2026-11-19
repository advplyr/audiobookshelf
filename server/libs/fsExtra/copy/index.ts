import universalify from '../../universalify'
import copy from './copy'
import copySync from './copy-sync'
import type { CopyFilter, CopyOptions } from './types'

type Done = (error?: unknown) => void
interface Copy {
  (source: string, destination: string, options?: CopyOptions | null): Promise<void>
  (source: string, destination: string, callback: Done): void
  (source: string, destination: string, options: CopyOptions | CopyFilter | null | undefined, callback: Done): void
}

// The callback occupies the optional options position when options are omitted.
const wrappedCopy = universalify.fromCallback<unknown, [string, string, CopyOptions | CopyFilter | null | undefined], void>(copy) as Copy

export = { copy: wrappedCopy, copySync }
