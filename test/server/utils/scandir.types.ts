import type scandir from '../../../server/utils/scandir'
import type LibraryFile from '../../../server/objects/files/LibraryFile'
import type { BookFilenameMetadata, LibraryItemFilenameMetadata } from '../../../server/types/scandir'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type ScandirContract = [
  Assert<Equal<ReturnType<typeof scandir.groupFileItemsIntoLibraryItemDirs>, Record<string, string | string[]>>>,
  Assert<Equal<ReturnType<typeof scandir.buildLibraryFile>, Promise<LibraryFile[]>>>,
  Assert<Equal<ReturnType<typeof scandir.getBookDataFromDir>, BookFilenameMetadata>>,
  Assert<Equal<BookFilenameMetadata['seriesName'], string | null>>,
  Assert<Equal<ReturnType<typeof scandir.getDataFromMediaDir>['mediaMetadata'], LibraryItemFilenameMetadata>>
]
