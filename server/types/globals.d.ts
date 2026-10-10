export {}

declare global {
  // Initialized by the server before sorting and directory metadata parsing are used.
  var ServerSettings: {
    sortingPrefixes: string[] | null | undefined
    scannerParseSubtitle?: boolean
  }

  // Server initialization sets this flag; earlier consumers may see undefined.
  var isWin: boolean | undefined

  // Optional request timeout configured by server initialization.
  var PodcastDownloadTimeout: number | undefined

  // Optional SSRF bypass predicate initialized from server configuration.
  var DisableSsrfRequestFilter: ((url: string) => boolean) | undefined
}
