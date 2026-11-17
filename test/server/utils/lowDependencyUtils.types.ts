import type LongTimeout from '../../../server/utils/longTimeout'
import type stringifySequelizeQuery from '../../../server/utils/stringifySequelizeQuery'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

// Preserve constructor/function exports and the observable timer and JSON return types.
export type LowDependencyUtilsContract = [
  Assert<Equal<ConstructorParameters<typeof LongTimeout>, []>>,
  Assert<Equal<LongTimeout['timeout'], number>>,
  Assert<Equal<LongTimeout['timer'], NodeJS.Timeout | null>>,
  Assert<Equal<Parameters<LongTimeout['set']>, [fn: () => void, timeout: number]>>,
  Assert<Equal<ReturnType<LongTimeout['set']>, void>>,
  Assert<Equal<ReturnType<LongTimeout['clear']>, void>>,
  Assert<Equal<Parameters<typeof stringifySequelizeQuery>, [findOptions: unknown]>>,
  Assert<Equal<ReturnType<typeof stringifySequelizeQuery>, string | undefined>>
]
