import type ApiKey from '../../../server/models/ApiKey'
import type { ApiKeyPermissions } from '../../../server/models/ApiKey'
import type MediaItemShare from '../../../server/models/MediaItemShare'
import type { MediaItemShareForClient, MediaItemShareModel, MediaItemShareObject } from '../../../server/models/MediaItemShare'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type SharingAndAuthModelsContract = [
  Assert<Equal<ApiKeyPermissions['librariesAccessible'], string[]>>,
  Assert<Equal<ReturnType<typeof ApiKey.generateApiKey>, Promise<string | null | undefined>>>,
  Assert<Equal<Awaited<ReturnType<typeof ApiKey.getById>>, ApiKey | null>>,
  Assert<Equal<MediaItemShareModel, MediaItemShare>>,
  Assert<Equal<MediaItemShareObject['expiresAt'], Date | null>>,
  Assert<Equal<Extract<keyof MediaItemShareForClient, 'pash' | 'extraData' | 'userId'>, never>>
]
