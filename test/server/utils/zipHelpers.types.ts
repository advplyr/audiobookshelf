import type { Response } from 'express'
import type * as zipHelpers from '../../../server/utils/zipHelpers'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type ZipHelpersContract = [
  Assert<Equal<ReturnType<typeof zipHelpers.zipDirectoryPipe>, Promise<void>>>,
  Assert<Equal<ReturnType<typeof zipHelpers.zipDirectoriesPipe>, Promise<void>>>,
  Assert<Equal<Parameters<typeof zipHelpers.zipDirectoryPipe>[2], Response>>,
  Assert<Equal<ReturnType<typeof zipHelpers.handleDownloadError>, Response | undefined>>
]
