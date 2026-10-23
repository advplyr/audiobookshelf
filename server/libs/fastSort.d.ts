// Sorting operations consumed by migrated library helpers; the implementation remains JS.
export type SortDirection<T> = { asc?: (item: T) => unknown; desc?: (item: T) => unknown }

export function createNewSortInstance(options: { comparer: (left: string, right: string) => number }): <T>(items: T[]) => {
  asc(selector?: (item: T) => unknown): T[]
  by(directions: SortDirection<T>[]): T[]
}
