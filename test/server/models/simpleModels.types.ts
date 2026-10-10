import type { CreationAttributes } from 'sequelize'
import type LibraryFolder from '../../../server/models/LibraryFolder'
import type CollectionBook from '../../../server/models/CollectionBook'
import type BookSeries from '../../../server/models/BookSeries'
import type BookAuthor from '../../../server/models/BookAuthor'
import type CustomMetadataProvider from '../../../server/models/CustomMetadataProvider'
import type Session from '../../../server/models/Session'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type SimpleModelsContract = [
  Assert<Equal<ReturnType<LibraryFolder['toOldJSON']>['fullPath'], string | null>>,
  Assert<Equal<CreationAttributes<LibraryFolder>['id'], string | undefined>>,
  Assert<Equal<CollectionBook['order'], number | null>>,
  Assert<Equal<BookSeries['sequence'], string | null>>,
  Assert<Equal<ReturnType<typeof BookAuthor.getCountsForAuthors>, Promise<Record<string, number>>>>,
  Assert<Equal<CustomMetadataProvider['extraData'], unknown>>,
  Assert<Equal<keyof ReturnType<CustomMetadataProvider['toClientJson']>, 'id' | 'name' | 'mediaType' | 'slug'>>,
  Assert<Equal<CreationAttributes<Session>['refreshToken'], string>>,
  Assert<Equal<Session['lastRefreshTokenExpiresAt'], Date | null>>,
  Assert<Equal<Awaited<ReturnType<typeof Session.createSession>>, Session>>
]
