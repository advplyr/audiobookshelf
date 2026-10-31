// Fuzzy-search API consumed by podcast matching; runtime remains the embedded Fuse build.
declare class Fuse<T> {
  constructor(items: T[], options: { ignoreDiacritics: boolean; threshold: number; keys: Array<{ name: string; weight: number }> })
  search(pattern: string): Array<{ item: T }>
}

export = Fuse
