/*
  This is an example of a fully expanded podcast library item (under construction)
*/

const LibraryItem = require('../server/objects/LibraryItem')

new LibraryItem({
  id: 'li_abai123wir',
  ino: "55450570412017066",
  libraryId: 'lib_1239p1d8',
  folderId: 'fol_192ab8901',
  path: '/podcasts/Great Podcast Name',
  relPath: '/Great Podcast Name',
  mtimeMs: 1646784672127,
  ctimeMs: 1646784672127,
  birthtimeMs: 1646784672127,
  addedAt: 1646784672127,
  updatedAt: 1646784672127,
  lastScan: 1646784672127,
  scanVersion: 1.72,
  isMissing: false,
  isInvalid: false,
  mediaType: 'podcast',
  media: { // Podcast.js
    coverPath: '/metadata/items/li_abai123wir/cover.webp',
    tags: ['favorites'],
    lastCoverSearch: null,
    lastCoverSearchQuery: null,
    metadata: { // PodcastMetadata.js
      title: 'Great Podcast Name',
      artist: 'Some Artist Name',
      genres: ['Fantasy', 'Adventure'],
      publishedDate: '1994-01-01',
      description: 'In the aftermath of the brutal murder of his father, a mysterious woman...',
      feedUrl: '',
      itunesPageUrl: '',
      itunesId: '',
      itunesArtistId: '',
      explicit: false
    },
    episodes: [
      { // PodcastEpisode.js
        id: 'ep_289374asf0a98',
        index: 1,
        // TODO: podcast episode data and PodcastEpisodeMetadata
        addedAt: 1646784672127,
        updatedAt: 1646784672127
      }
    ]
  },
  libraryFiles: [
    { // LibraryFile.js
      ino: "55450570412017066",
      metadata: { // FileMetadata.js
        filename: 'cover.png',
        ext: '.png',
        path: '/podcasts/Great Podcast Name/cover.png',
        relPath: '/cover.png',
        mtimeMs: 1646784672127,
        ctimeMs: 1646784672127,
        birthtimeMs: 1646784672127,
        size: 1197449516
      },
      addedAt: 1646784672127,
      updatedAt: 1646784672127
    },
    { // LibraryFile.js
      ino: "55450570412017066",
      metadata: { // FileMetadata.js
        filename: 'episode_1.mp3',
        ext: '.mp3',
        path: '/podcasts/Great Podcast Name/episode_1.mp3',
        relPath: '/episode_1.mp3',
        mtimeMs: 1646784672127,
        ctimeMs: 1646784672127,
        birthtimeMs: 1646784672127,
        size: 1197449516
      },
      addedAt: 1646784672127,
      updatedAt: 1646784672127
    }
  ]
})