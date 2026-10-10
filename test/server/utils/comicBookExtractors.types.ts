import type { createComicBookExtractor } from '../../../server/utils/comicBookExtractors'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T
type Extractor = ReturnType<typeof createComicBookExtractor>

export type ComicBookExtractorsContract = [
  Assert<Equal<Parameters<typeof createComicBookExtractor>, [comicPath: string]>>,
  Assert<Equal<ReturnType<Extractor['open']>, Promise<void>>>,
  Assert<Equal<ReturnType<Extractor['getFilePaths']>, Promise<string[] | null> | Promise<Array<string | undefined> | null>>>,
  Assert<Equal<ReturnType<Extractor['extractToBuffer']>, Promise<Buffer | null> | Promise<Uint8Array | null | undefined>>>,
  Assert<Equal<ReturnType<Extractor['extractToFile']>, Promise<boolean>>>,
  Assert<Equal<ReturnType<Extractor['close']>, void>>
]
