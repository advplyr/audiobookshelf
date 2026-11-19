export type CopyFilter = (source: string, destination: string) => boolean | PromiseLike<boolean>
export type SyncCopyFilter = (source: string, destination: string) => boolean

export interface CopyOptions<Filter = CopyFilter> {
  clobber?: boolean
  overwrite?: boolean
  dereference?: boolean
  errorOnExist?: boolean
  preserveTimestamps?: boolean
  filter?: Filter
}
