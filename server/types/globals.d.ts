export {}

declare global {
  // Initialized by the server before title sorting is used.
  var ServerSettings: { sortingPrefixes: string[] | null | undefined }

  // Server initialization sets this flag; earlier consumers may see undefined.
  var isWin: boolean | undefined
}
