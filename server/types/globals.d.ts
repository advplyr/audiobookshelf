import type ServerSettings from '../objects/settings/ServerSettings'

declare global {
  // Optional before server initialization; comic extraction falls back to os.tmpdir().
  var MetadataPath: string | undefined

  // Initialized by the server before sorting and directory metadata parsing are used.
  var ServerSettings: {
    sortingPrefixes: string[] | null | undefined
    authOpenIDMatchExistingBy?: ServerSettings['authOpenIDMatchExistingBy']
    storeMetadataWithItem?: ServerSettings['storeMetadataWithItem']
    metadataFileFormat?: ServerSettings['metadataFileFormat']
    sortingIgnorePrefix?: boolean
    scannerParseSubtitle?: boolean
    podcastEpisodeSchedule?: ServerSettings['podcastEpisodeSchedule']
  }

  // Server initialization sets this flag; earlier consumers may see undefined.
  var isWin: boolean | undefined

  // Optional request timeout configured by server initialization.
  var PodcastDownloadTimeout: number | undefined

  // Optional SSRF bypass predicate initialized from server configuration.
  var DisableSsrfRequestFilter: ((url: string) => boolean) | undefined
}
