export {}

declare global {
  // Server initialization sets this flag; earlier consumers may see undefined.
  var isWin: boolean | undefined
}
