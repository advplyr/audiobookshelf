import type utils from '../../../server/utils/index'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type GeneralUtilsContract = [
  Assert<Equal<ReturnType<typeof utils.xmlToJSON>, Promise<unknown>>>,
  Assert<Equal<ReturnType<typeof utils.copyValue>, unknown>>,
  Assert<Equal<ReturnType<typeof utils.isNullOrNaN>, boolean>>,
  Assert<Equal<ReturnType<typeof utils.toNumber>, number>>,
  Assert<Equal<Parameters<typeof utils.getTitleIgnorePrefix>[0], string | null | undefined>>,
  Assert<Equal<ReturnType<typeof utils.getTitleIgnorePrefix>, string>>,
  Assert<Equal<ReturnType<typeof utils.getTitlePrefixAtEnd>, string | null | undefined>>,
  Assert<Equal<ReturnType<typeof utils.validateUrl>, string | null>>,
  Assert<Equal<ReturnType<typeof utils.timestampToSeconds>, number | null>>,
  Assert<Equal<Parameters<typeof utils.getQueryParamAsString>[0], Record<string, unknown>>>,
  Assert<Equal<InstanceType<typeof utils.ValidationError>['paramName'], string>>,
  Assert<Equal<InstanceType<typeof utils.NotFoundError>['status'], number>>
]
