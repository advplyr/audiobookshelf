import type fileUtils from '../../../server/utils/fileUtils'
import type { FilePathItem } from '../../../server/types/fileUtils'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type FileUtilsContract = [
  Assert<Equal<ReturnType<typeof fileUtils.recurseFiles>, Promise<FilePathItem[]>>>,
  Assert<Equal<ReturnType<typeof fileUtils.getFileSize>, Promise<number>>>,
  Assert<Equal<ReturnType<typeof fileUtils.getFileMTimeMs>, Promise<number>>>,
  Assert<Equal<ReturnType<typeof fileUtils.getIno>, Promise<string | null>>>,
  Assert<Equal<ReturnType<typeof fileUtils.sanitizeFilename>, string | false>>,
  Assert<Equal<ReturnType<typeof fileUtils.removeFile>, false | Promise<boolean>>>,
  Assert<Equal<ReturnType<typeof fileUtils.downloadFile>, Promise<void>>>,
  Assert<Equal<ReturnType<typeof fileUtils.getWindowsDrives>, Promise<string[]>>>,
  Assert<Equal<ReturnType<typeof fileUtils.copyToExisting>, Promise<void>>>,
  Assert<Equal<Extract<Awaited<ReturnType<typeof fileUtils.getFileTimestampsWithIno>>, boolean>, false>>
]
