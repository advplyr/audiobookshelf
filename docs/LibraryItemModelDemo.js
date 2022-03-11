/*
  This is an example of a fully expanded book library item
*/

const LibraryItem = require('../server/objects/LibraryItem')

new LibraryItem({
  id: 'li_abai123wir',
  ino: "55450570412017066",
  libraryId: 'lib_1239p1d8',
  folderId: 'fol_192ab8901',
  path: '/audiobooks/Terry Goodkind/Sword of Truth/1 - Wizards First Rule',
  relPath: '/Terry Goodkind/Sword of Truth/1 - Wizards First Rule',
  mtimeMs: 1646784672127,
  ctimeMs: 1646784672127,
  birthtimeMs: 1646784672127,
  addedAt: 1646784672127,
  lastUpdate: 1646784672127,
  lastScan: 1646784672127,
  scanVersion: 1.72,
  isMissing: false,
  mediaType: 'book',
  media: { // Book.js
    coverPath: '/metadata/books/li_abai123wir/cover.webp',
    metadata: { // BookMetadata.js
      title: 'Wizards First Rule',
      subtitle: null,
      authors: [
        {
          id: 'au_42908lkajsfdk',
          name: 'Terry Goodkind'
        }
      ],
      narrators: ['Sam Tsoutsouvas'],
      series: [
        {
          id: 'se_902384lansf',
          name: 'Sword of Truth',
          sequence: 1
        }
      ],
      genres: ['Fantasy', 'Adventure'],
      publishedYear: '1994',
      publishedDate: '1994-01-01',
      publisher: 'Brilliance Audio',
      description: 'In the aftermath of the brutal murder of his father, a mysterious woman...',
      isbn: '289374092834',
      asin: '19023819203',
      language: 'english'
    },
    tags: ['favorites'],
    audioFiles: [
      { // AudioFile.js
        ino: "55450570412017066",
        index: 1,
        metadata: { // FileMetadata.js
          filename: 'audiofile.mp3',
          ext: '.mp3',
          path: '/audiobooks/Terry Goodkind/Sword of Truth/1 - Wizards First Rule/CD01/audiofile.mp3',
          relPath: '/CD01/audiofile.mp3',
          mtimeMs: 1646784672127,
          ctimeMs: 1646784672127,
          birthtimeMs: 1646784672127,
          size: 1197449516
        },
        trackNumFromMeta: 1,
        discNumFromMeta: null,
        trackNumFromFilename: null,
        discNumFromFilename: 1,
        manuallyVerified: false,
        exclude: false,
        invalid: false,
        format: "MP2/3 (MPEG audio layer 2/3)",
        duration: 2342342,
        bitRate: 324234,
        language: null,
        codec: 'mp3',
        timeBase: "1/14112000",
        channels: 1,
        channelLayout: "mono",
        chapters: [],
        embeddedCoverArt: 'jpeg', // Video stream codec ['mjpeg', 'jpeg', 'png'] or null
        metaTags: { // AudioMetaTags.js
          tagAlbum: '',
          tagArtist: '',
          tagGenre: '',
          tagTitle: '',
          tagSeries: '',
          tagSeriesPart: '',
          tagTrack: '',
          tagDisc: '',
          tagSubtitle: '',
          tagAlbumArtist: '',
          tagDate: '',
          tagComposer: '',
          tagPublisher: '',
          tagComment: '',
          tagDescription: '',
          tagEncoder: '',
          tagEncodedBy: '',
          tagIsbn: '',
          tagLanguage: '',
          tagASIN: ''
        },
        addedAt: 1646784672127,
        updatedAt: 1646784672127
      }
    ],
    ebookFiles: [
      { // EBookFile.js
        ino: "55450570412017066",
        metadata: { // FileMetadata.js
          filename: 'ebookfile.mobi',
          ext: '.mobi',
          path: '/audiobooks/Terry Goodkind/Sword of Truth/1 - Wizards First Rule/ebookfile.mobi',
          relPath: '/ebookfile.mobi',
          mtimeMs: 1646784672127,
          ctimeMs: 1646784672127,
          birthtimeMs: 1646784672127,
          size: 1197449516
        },
        ebookFormat: 'mobi',
        addedAt: 1646784672127,
        updatedAt: 1646784672127
      }
    ],
    chapters: [
      {
        id: 0,
        title: 'Chapter 01',
        start: 0,
        end: 2467.753
      }
    ]
  },
  libraryFiles: [
    { // LibraryFile.js
      ino: "55450570412017066",
      metadata: { // FileMetadata.js
        filename: 'cover.png',
        ext: '.png',
        path: '/audiobooks/Terry Goodkind/Sword of Truth/1 - Wizards First Rule/subfolder/cover.png',
        relPath: '/subfolder/cover.png',
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
        filename: 'cover.png',
        ext: '.mobi',
        path: '/audiobooks/Terry Goodkind/Sword of Truth/1 - Wizards First Rule/ebookfile.mobi',
        relPath: '/ebookfile.mobi',
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