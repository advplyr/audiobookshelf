import type { Request } from 'express'
import type { getRequestOrigin, getRequestProtocol, isRequestSecure } from '../../../server/utils/requestUtils'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

// Exact comparisons also fail if a migrated export loses its type and becomes any.
export type RequestUtilsContract = [
  Assert<Equal<ReturnType<typeof isRequestSecure>, boolean>>,
  Assert<Equal<ReturnType<typeof getRequestProtocol>, 'http' | 'https'>>,
  Assert<Equal<ReturnType<typeof getRequestOrigin>, { protocol: 'http' | 'https'; host: string | undefined; origin: string }>>,
  Assert<Equal<Parameters<typeof getRequestOrigin>[0], Pick<Request, 'secure' | 'get'>>>
]
