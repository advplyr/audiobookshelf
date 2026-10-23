import type helpers from '../../../server/utils/libraryHelpers'
import type { CollapsePayload, ExpandedLibraryItem, LibraryItemJSON, SeriesGroup } from '../../../server/types/libraryHelpers'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type LibraryHelpersContract = [
  Assert<Equal<ReturnType<typeof helpers.getSeriesFromBooks>, SeriesGroup[]>>,
  Assert<Equal<ReturnType<typeof helpers.collapseBookSeries>, ExpandedLibraryItem[]>>,
  Assert<Equal<ReturnType<typeof helpers.handleCollapseSubseries>, Promise<LibraryItemJSON[]>>>,
  Assert<Equal<Parameters<typeof helpers.handleCollapseSubseries>[0], CollapsePayload>>,
  Assert<Equal<CollapsePayload['limit'], number | string>>
]
