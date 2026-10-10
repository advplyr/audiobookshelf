type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

// No declaration import: the server compiler must load ambient globals itself.
export type GlobalsContract = [
  Assert<Equal<typeof global.isWin, boolean | undefined>>,
  Assert<Equal<string extends typeof global.isWin ? true : false, false>>
]
