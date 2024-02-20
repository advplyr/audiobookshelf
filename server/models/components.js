/**
 * @openapi
 * components:
 *   schemas:
 *     oldLibraryId:
 *       type: string
 *       description: The ID of the libraries created on server version 2.2.23 and before.
 *       format: "lib_[a-z0-9]{18}"
 *       example: lib_o78uaoeuh78h6aoeif
 *     newLibraryId:
 *       type: string
 *       description: The library ID for any libraries after 2.3.0.
 *       format: uuid
 *       example: e4bb1afb-4a4f-4dd6-8be0-e615d233185b
 *     mediaType:
 *       type: string
 *       description: The type of media, will be book or podcast.
 *       enum: [book, podcast]
 *     createdAt:
 *       type: integer
 *       description: The time (in ms since POSIX epoch) when the item was created.
 *       example: 1633522963509
 *     tags:
 *       description: Tags applied items.
 *       type: array
 *       items:
 *         type: string
 *       examples:
 *         - Favorite
 *         - Nonfiction/History
 *         - Content: Violence
 *     library:
 *       type: object
 *       properties:
 *         id:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         name:
 *           type: string
 *           description: The name of the library.
 *           example: Main
 *         folders:
 *           type: array
 *           description: The folders that the library is composed of on the server.
 *           items:
 *             $ref: '#/components/schemas/folder'
 *         displayOrder:
 *           type: integer
 *           description: Display position of the library in the list of libraries. Must be >= 1.
 *           example: 1
 *         icon:
 *           type: string
 *           description: The selected icon for the library. See [Library Icons](https://api.audiobookshelf.org/#library-icons) for a list of possible icons.
 *           example: audiobookshelf
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         provider:
 *           type: string
 *           description: Preferred metadata provider for the library. See [Metadata Providers](https://api.audiobookshelf.org/#metadata-providers) for a list of possible providers.
 *           example: audible
 *         settings:
 *           $ref: '#/components/schemas/librarySettings'
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         lastUpdate:
 *           type: integer
 *           description: The time (in ms since POSIX epoch) when the library was last updated. (Read Only)
 *           example: 1646520916818
 *     librarySettings:
 *       type: object
 *       properties:
 *         coverAspectRatio:
 *           type: integer
 *           description: Whether the library should use square book covers. Must be 0 (for false) or 1 (for true).
 *           example: 1
 *         disableWatcher:
 *           type: boolean
 *           description: Whether to disable the folder watcher for the library.
 *           example: false
 *         skipMatchingMediaWithAsin:
 *           type: boolean
 *           description: Whether to skip matching books that already have an ASIN.
 *           example: false
 *         skipMatchingMediaWithIsbn:
 *           type: boolean
 *           description: Whether to skip matching books that already have an ISBN.
 *           example: false
 *         autoScanCronExpression:
 *           description: The cron expression for when to automatically scan the library folders. If null, automatic scanning will be disabled.
 *           type: [string, 'null']
 *     libraryFilterData:
 *       type: object
 *       properties:
 *         authors:
 *           description: The authors of books in the library.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/authorMinified'
 *         genres:
 *           description: The genres of books in the library.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         series:
 *           description: The series in the library. The series will only have their id and name.
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: ser_cabkj4jeu8be3rap4g
 *               name:
 *                 type: string
 *                 example: Sword of Truth
 *         narrators:
 *           description: The narrators of books in the library.
 *           type: array
 *           items:
 *             type: string
 *             example: Sam Tsoutsouvas
 *         languages:
 *           description: The languages of books in the library.
 *           type: array
 *           items:
 *             type: string
 *     folder:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the folder. (Read Only)
 *           type: string
 *           example: fol_bev1zuxhb0j0s1wehr
 *         fullPath:
 *           description: The path on the server for the folder. (Read Only)
 *           type: string
 *           example: /podcasts
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the folder was added. (Read Only)
 *           type: integer
 *           example: 1650462940610
 *     libraryItem:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the library item.
 *           type: string
 *           format: uuid
 *         ino:
 *           description: The inode of the library item.
 *           type: string
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         folderId:
 *           description: The ID of the folder the library item is in.
 *           type: string
 *         path:
 *           description: The path of the library item on the server.
 *           type: string
 *         relPath:
 *           description: The path, relative to the library folder, of the library item.
 *           type: string
 *         isFile:
 *           description: Whether the library item is a single file in the root of the library folder.
 *           type: boolean
 *         mtimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item was last modified on disk.
 *           type: integer
 *         ctimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item status was changed on disk.
 *           type: integer
 *         birthtimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item was created on disk. Will be 0 if unknown.
 *           type: integer
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the library item was added to the library.
 *           type: integer
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the library item was last updated. (Read Only)
 *           type: integer
 *         lastScan:
 *           description: The time (in ms since POSIX epoch) when the library item was last scanned. Will be null if the server has not yet scanned the library item.
 *           type: integer
 *         scanVersion:
 *           description: The version of the scanner when last scanned. Will be null if it has not been scanned.
 *           type: string
 *         isMissing:
 *           description: Whether the library item was scanned and no longer exists.
 *           type: boolean
 *         isInvalid:
 *           description: Whether the library item was scanned and no longer has media files.
 *           type: boolean
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         media:
 *           description: The media of the library item.
 *           oneOf:
 *             - $ref: '#/components/schemas/book'
 *             - $ref: '#/components/schemas/podcast'
 *         libraryFiles:
 *           description: The files of the library item.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/libraryFile'
 *     libraryItemMinified:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the library item.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         ino:
 *           description: The inode of the library item.
 *           type: string
 *           example: '649641337522215266'
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         folderId:
 *           description: The ID of the folder the library item is in.
 *           type: string
 *           example: fol_bev1zuxhb0j0s1wehr
 *         path:
 *           description: The path of the library item on the server.
 *           type: string
 *           example: /audiobooks/Terry Goodkind/Sword of Truth/Wizards First Rule
 *         relPath:
 *           description: The path, relative to the library folder, of the library item.
 *           type: string
 *           example: Terry Goodkind/Sword of Truth/Wizards First Rule
 *         isFile:
 *           description: Whether the library item is a single file in the root of the library folder.
 *           type: boolean
 *           example: false
 *         mtimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item was last modified on disk.
 *           type: integer
 *           example: 1650621074299
 *         ctimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item status was changed on disk.
 *           type: integer
 *           example: 1650621074299
 *         birthtimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item was created on disk. Will be 0 if unknown.
 *           type: integer
 *           example: 0
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the library item was added to the library.
 *           type: integer
 *           example: 1650621073750
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the library item was last updated. (Read Only)
 *           type: integer
 *           example: 1650621110769
 *         isMissing:
 *           description: Whether the library item was scanned and no longer exists.
 *           type: boolean
 *           example: false
 *         isInvalid:
 *           description: Whether the library item was scanned and no longer has media files.
 *           type: boolean
 *           example: false
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         media:
 *           description: The media of the library item.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *               - $ref: '#/components/schemas/bookMinified'
 *               - $ref: '#/components/schemas/podcastMinified'
 *         numFiles:
 *           description: The number of library files for the library item.
 *           type: integer
 *           example: 2
 *         size:
 *           description: The total size (in bytes) of the library item.
 *           type: integer
 *           example: 268990279
 *     libraryItemExpanded:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the library item.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         ino:
 *           description: The inode of the library item.
 *           type: string
 *           example: '649641337522215266'
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         folderId:
 *           description: The ID of the folder the library item is in.
 *           type: string
 *           example: fol_bev1zuxhb0j0s1wehr
 *         path:
 *           description: The path of the library item on the server.
 *           type: string
 *           example: /audiobooks/Terry Goodkind/Sword of Truth/Wizards First Rule
 *         relPath:
 *           description: The path, relative to the library folder, of the library item.
 *           type: string
 *           example: Terry Goodkind/Sword of Truth/Wizards First Rule
 *         isFile:
 *           description: Whether the library item is a single file in the root of the library folder.
 *           type: boolean
 *           example: false
 *         mtimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item was last modified on disk.
 *           type: integer
 *           example: 1650621074299
 *         ctimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item status was changed on disk.
 *           type: integer
 *           example: 1650621074299
 *         birthtimeMs:
 *           description: The time (in ms since POSIX epoch) when the library item was created on disk. Will be 0 if unknown.
 *           type: integer
 *           example: 0
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the library item was added to the library.
 *           type: integer
 *           example: 1650621073750
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the library item was last updated. (Read Only)
 *           type: integer
 *           example: 1650621110769
 *         lastScan:
 *           description: The time (in ms since POSIX epoch) when the library item was last scanned. Will be null if the server has not yet scanned the library item.
 *           type: integer
 *           example: 1651830827825
 *         scanVersion:
 *           description: The version of the scanner when last scanned. Will be null if it has not been scanned.
 *           type: string
 *           example: 2.0.21
 *         isMissing:
 *           description: Whether the library item was scanned and no longer exists.
 *           type: boolean
 *           example: false
 *         isInvalid:
 *           description: Whether the library item was scanned and no longer has media files.
 *           type: boolean
 *           example: false
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         media:
 *           description: The media of the library item.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *               - $ref: '#/components/schemas/bookExpanded'
 *               - $ref: '#/components/schemas/podcastExpanded'
 *         libraryFiles:
 *           description: The files of the library item.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/libraryFile'
 *         size:
 *           description: The total size (in bytes) of the library item.
 *           type: integer
 *           example: 268990279
 *     book:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item that contains the book.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         metadata:
 *           $ref: '#/components/schemas/bookMetadata'
 *         coverPath:
 *           description: The absolute path on the server of the cover file. Will be null if there is no cover.
 *           type: [string, 'null']
 *           example: /audiobooks/Terry Goodkind/Sword of Truth/Wizards First Rule/cover.jpg
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         audioFiles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/audioFile'
 *         chapters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         missingParts:
 *           description: Any parts missing from the book by track index.
 *           type: array
 *           items:
 *             type: integer
 *         ebookFile:
 *           $ref: '#/components/schemas/ebookFile'
 *     bookMinified:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/bookMetadataMinified'
 *         coverPath:
 *           description: The absolute path on the server of the cover file. Will be null if there is no cover.
 *           type: [string, 'null']
 *           example: /audiobooks/Terry Goodkind/Sword of Truth/Wizards First Rule/cover.jpg
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         numTracks:
 *           description: The number of tracks the book's audio files have.
 *           type: integer
 *           example: 1
 *         numAudioFiles:
 *           description: The number of audio files the book has.
 *           type: integer
 *           example: 1
 *         numChapters:
 *           description: The number of chapters the book has.
 *           type: integer
 *           example: 1
 *         numMissingParts:
 *           description: The total number of missing parts the book has.
 *           type: integer
 *           example: 0
 *         numInvalidAudioFiles:
 *           description: The number of invalid audio files the book has.
 *           type: integer
 *           example: 0
 *         duration:
 *           description: The total length (in seconds) of the book.
 *           type: number
 *           example: 33854.905
 *         size:
 *           description: The total size (in bytes) of the book.
 *           type: integer
 *           example: 268824228
 *         ebookFormat:
 *           description: The format of ebook of the book. Will be null if the book is an audiobook.
 *           type: [string, 'null']
 *     bookExpanded:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item that contains the book.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         metadata:
 *           $ref: '#/components/schemas/bookMetadataExpanded'
 *         coverPath:
 *           description: The absolute path on the server of the cover file. Will be null if there is no cover.
 *           type: [string, 'null']
 *           example: /audiobooks/Terry Goodkind/Sword of Truth/Wizards First Rule/cover.jpg
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         audioFiles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/audioFile'
 *         chapters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         missingParts:
 *           description: Any parts missing from the book by track index.
 *           type: array
 *           items:
 *             type: integer
 *         ebookFile:
 *           $ref: '#/components/schemas/ebookFile'
 *         duration:
 *           description: The total length (in seconds) of the book.
 *           type: integer
 *           example: 33854.905
 *         size:
 *           description: The total size (in bytes) of the book.
 *           type: integer
 *           example: 268824228
 *         tracks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/audioTrack'
 *     bookMetadata:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Wizards First Rule
 *         subtitle:
 *           description: The subtitle of the book. Will be null if there is no subtitle.
 *           type: [string, 'null']
 *         authors:
 *           description: The authors of the book.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/authorMinified'
 *         narrators:
 *           description: The narrators of the audiobook.
 *           type: array
 *           items:
 *             type: string
 *             example: Sam Tsoutsouvas
 *         series:
 *           description: The series the book belongs to.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/seriesSequence'
 *         genres:
 *           description: The genres of the book.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         publishedYear:
 *           description: The year the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2008'
 *         publishedDate:
 *           description: The date the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *         publisher:
 *           description: The publisher of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Brilliance Audio
 *         description:
 *           description: A description for the book. Will be null if empty.
 *           type: [string, 'null']
 *           example: >-
 *               The masterpiece that started Terry Goodkind's New York Times bestselling
 *               epic Sword of Truth In the aftermath of the brutal murder of his father,
 *               a mysterious woman, Kahlan Amnell, appears in Richard Cypher's forest
 *               sanctuary seeking help...and more. His world, his very beliefs, are
 *               shattered when ancient debts come due with thundering violence. In a
 *               dark age it takes courage to live, and more than mere courage to
 *               challenge those who hold dominion, Richard and Kahlan must take up that
 *               challenge or become the next victims. Beyond awaits a bewitching land
 *               where even the best of their hearts could betray them. Yet, Richard
 *               fears nothing so much as what secrets his sword might reveal about his
 *               own soul. Falling in love would destroy them - for reasons Richard can't
 *               imagine and Kahlan dare not say. In their darkest hour, hunted
 *               relentlessly, tormented by treachery and loss, Kahlan calls upon Richard
 *               to reach beyond his sword - to invoke within himself something more
 *               noble. Neither knows that the rules of battle have just changed...or
 *               that their time has run out. Wizard's First Rule is the beginning. One
 *               book. One Rule. Witness the birth of a legend.
 *         isbn:
 *           description: The ISBN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         asin:
 *           description: The ASIN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: B002V0QK4C
 *         language:
 *           description: The language of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         explicit:
 *           description: Whether the book has been marked as explicit.
 *           type: boolean
 *           example: false
 *     bookMetadataMinified:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Wizards First Rule
 *         titleIgnorePrefix:
 *           description: The title of the book with any prefix moved to the end.
 *           type: string
 *         subtitle:
 *           description: The subtitle of the book. Will be null if there is no subtitle.
 *           type: [string, 'null']
 *         authorName:
 *           description: The name of the book's author(s).
 *           type: string
 *           example: Terry Goodkind
 *         authorNameLF:
 *           description: The name of the book's author(s) with last names first.
 *           type: string
 *           example: Goodkind, Terry
 *         narratorName:
 *           description: The name of the audiobook's narrator(s).
 *           type: string
 *           example: Sam Tsoutsouvas
 *         seriesName:
 *           description: The name of the book's series.
 *           type: string
 *           example: Sword of Truth
 *         genres:
 *           description: The genres of the book.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         publishedYear:
 *           description: The year the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2008'
 *         publishedDate:
 *           description: The date the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *         publisher:
 *           description: The publisher of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Brilliance Audio
 *         description:
 *           description: A description for the book. Will be null if empty.
 *           type: [string, 'null']
 *           example: >-
 *               The masterpiece that started Terry Goodkind's New York Times bestselling
 *               epic Sword of Truth In the aftermath of the brutal murder of his father,
 *               a mysterious woman, Kahlan Amnell, appears in Richard Cypher's forest
 *               sanctuary seeking help...and more. His world, his very beliefs, are
 *               shattered when ancient debts come due with thundering violence. In a
 *               dark age it takes courage to live, and more than mere courage to
 *               challenge those who hold dominion, Richard and Kahlan must take up that
 *               challenge or become the next victims. Beyond awaits a bewitching land
 *               where even the best of their hearts could betray them. Yet, Richard
 *               fears nothing so much as what secrets his sword might reveal about his
 *               own soul. Falling in love would destroy them - for reasons Richard can't
 *               imagine and Kahlan dare not say. In their darkest hour, hunted
 *               relentlessly, tormented by treachery and loss, Kahlan calls upon Richard
 *               to reach beyond his sword - to invoke within himself something more
 *               noble. Neither knows that the rules of battle have just changed...or
 *               that their time has run out. Wizard's First Rule is the beginning. One
 *               book. One Rule. Witness the birth of a legend.
 *         isbn:
 *           description: The ISBN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         asin:
 *           description: The ASIN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: B002V0QK4C
 *         language:
 *           description: The language of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         explicit:
 *           description: Whether the book has been marked as explicit.
 *           type: boolean
 *           example: false
 *     bookMetadataExpanded:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Wizards First Rule
 *         titleIgnorePrefix:
 *           description: The title of the book with any prefix moved to the end.
 *           type: string
 *         subtitle:
 *           description: The subtitle of the book. Will be null if there is no subtitle.
 *           type: [string, 'null']
 *         authorName:
 *           description: The name of the book's author(s).
 *           type: string
 *           example: Terry Goodkind
 *         authorNameLF:
 *           description: The name of the book's author(s) with last names first.
 *           type: string
 *           example: Goodkind, Terry
 *         narratorName:
 *           description: The name of the audiobook's narrator(s).
 *           type: string
 *           example: Sam Tsoutsouvas
 *         seriesName:
 *           description: The name of the book's series.
 *           type: string
 *           example: Sword of Truth
 *         authors:
 *           description: The authors of the book.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/authorMinified'
 *         narrators:
 *           description: The narrators of the audiobook.
 *           type: array
 *           items:
 *             type: string
 *             example: Sam Tsoutsouvas
 *         series:
 *           description: The series the book belongs to.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/seriesSequence'
 *         genres:
 *           description: The genres of the book.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         publishedYear:
 *           description: The year the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2008'
 *         publishedDate:
 *           description: The date the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *         publisher:
 *           description: The publisher of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Brilliance Audio
 *         description:
 *           description: A description for the book. Will be null if empty.
 *           type: [string, 'null']
 *           example: >-
 *               The masterpiece that started Terry Goodkind's New York Times bestselling
 *               epic Sword of Truth In the aftermath of the brutal murder of his father,
 *               a mysterious woman, Kahlan Amnell, appears in Richard Cypher's forest
 *               sanctuary seeking help...and more. His world, his very beliefs, are
 *               shattered when ancient debts come due with thundering violence. In a
 *               dark age it takes courage to live, and more than mere courage to
 *               challenge those who hold dominion, Richard and Kahlan must take up that
 *               challenge or become the next victims. Beyond awaits a bewitching land
 *               where even the best of their hearts could betray them. Yet, Richard
 *               fears nothing so much as what secrets his sword might reveal about his
 *               own soul. Falling in love would destroy them - for reasons Richard can't
 *               imagine and Kahlan dare not say. In their darkest hour, hunted
 *               relentlessly, tormented by treachery and loss, Kahlan calls upon Richard
 *               to reach beyond his sword - to invoke within himself something more
 *               noble. Neither knows that the rules of battle have just changed...or
 *               that their time has run out. Wizard's First Rule is the beginning. One
 *               book. One Rule. Witness the birth of a legend.
 *         isbn:
 *           description: The ISBN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         asin:
 *           description: The ASIN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: B002V0QK4C
 *         language:
 *           description: The language of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         explicit:
 *           description: Whether the book has been marked as explicit.
 *           type: boolean
 *           example: false
 *     bookChapter:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the book chapter.
 *           type: integer
 *           example: 0
 *         start:
 *           description: When in the book (in seconds) the chapter starts.
 *           type: integer
 *           example: 0
 *         end:
 *           description: When in the book (in seconds) the chapter ends.
 *           type: number
 *           example: 6004.6675
 *         title:
 *           description: The title of the chapter.
 *           type: string
 *           example: Wizards First Rule 01
 *     podcast:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item that contains the podcast.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         metadata:
 *           $ref: '#/components/schemas/podcastMetadata'
 *         coverPath:
 *           description: The absolute path on the server of the cover file. Will be null if there is no cover.
 *           type: [string, 'null']
 *           example: /podcasts/Welcome to Night Vale/cover.jpg
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         episodes:
 *           description: The downloaded episodes of the podcast.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/podcastEpisode'
 *         autoDownloadEpisodes:
 *           description: Whether the server will automatically download podcast episodes according to the schedule.
 *           type: boolean
 *           example: true
 *         autoDownloadSchedule:
 *           description: The cron expression for when to automatically download podcast episodes. Will not exist if autoDownloadEpisodes is false.
 *           type: string
 *           example: 0 0 * * 1
 *         lastEpisodeCheck:
 *           description: The time (in ms since POSIX epoch) when the podcast was checked for new episodes.
 *           type: integer
 *           example: 1667326662087
 *         maxEpisodesToKeep:
 *           description: The maximum number of podcast episodes to keep when automatically downloading new episodes. Episodes beyond this limit will be deleted. If 0, all episodes will be kept.
 *           type: integer
 *           example: 0
 *         maxNewEpisodesToDownload:
 *           description: The maximum number of podcast episodes to download when automatically downloading new episodes. If 0, all episodes will be downloaded.
 *           type: integer
 *           example: 3
 *     podcastMinified:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item that contains the podcast.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         metadata:
 *           $ref: '#/components/schemas/podcastMetadata'
 *         coverPath:
 *           description: The absolute path on the server of the cover file. Will be null if there is no cover.
 *           type: [string, 'null']
 *           example: /podcasts/Welcome to Night Vale/cover.jpg
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         numEpisodes:
 *           description: The number of downloaded episodes for the podcast.
 *           type: integer
 *           example: 1
 *         autoDownloadEpisodes:
 *           description: Whether the server will automatically download podcast episodes according to the schedule.
 *           type: boolean
 *           example: true
 *         autoDownloadSchedule:
 *           description: The cron expression for when to automatically download podcast episodes. Will not exist if autoDownloadEpisodes is false.
 *           type: string
 *           example: 0 0 * * 1
 *         lastEpisodeCheck:
 *           description: The time (in ms since POSIX epoch) when the podcast was checked for new episodes.
 *           type: integer
 *           example: 1667326662087
 *         maxEpisodesToKeep:
 *           description: The maximum number of podcast episodes to keep when automatically downloading new episodes. Episodes beyond this limit will be deleted. If 0, all episodes will be kept.
 *           type: integer
 *           example: 0
 *         maxNewEpisodesToDownload:
 *           description: The maximum number of podcast episodes to download when automatically downloading new episodes. If 0, all episodes will be downloaded.
 *           type: integer
 *           example: 3
 *         size:
 *           description: The total size (in bytes) of the podcast.
 *           type: integer
 *           example: 23706728
 *     podcastExpanded:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item that contains the podcast.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         metadata:
 *           $ref: '#/components/schemas/podcastMetadataExpanded'
 *         coverPath:
 *           description: The absolute path on the server of the cover file. Will be null if there is no cover.
 *           type: [string, 'null']
 *           example: /podcasts/Welcome to Night Vale/cover.jpg
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         episodes:
 *           description: The downloaded episodes of the podcast.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/podcastEpisodeExpanded'
 *         autoDownloadEpisodes:
 *           description: Whether the server will automatically download podcast episodes according to the schedule.
 *           type: boolean
 *           example: true
 *         autoDownloadSchedule:
 *           description: The cron expression for when to automatically download podcast episodes. Will not exist if autoDownloadEpisodes is false.
 *           type: string
 *           example: 0 0 * * 1
 *         lastEpisodeCheck:
 *           description: The time (in ms since POSIX epoch) when the podcast was checked for new episodes.
 *           type: integer
 *           example: 1667326662087
 *         maxEpisodesToKeep:
 *           description: The maximum number of podcast episodes to keep when automatically downloading new episodes. Episodes beyond this limit will be deleted. If 0, all episodes will be kept.
 *           type: integer
 *           example: 0
 *         maxNewEpisodesToDownload:
 *           description: The maximum number of podcast episodes to download when automatically downloading new episodes. If 0, all episodes will be downloaded.
 *           type: integer
 *           example: 3
 *         size:
 *           description: The total size (in bytes) of the podcast.
 *           type: integer
 *           example: 23706728
 *     podcastMetadata:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Welcome to Night Vale
 *         author:
 *           description: The author of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Night Vale Presents
 *         description:
 *           description: The description for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         releaseDate:
 *           description: The release date of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2022-10-20T19:00:00Z'
 *           format: date-time
 *         genres:
 *           description: The podcast's genres.
 *           type: array
 *           items:
 *             type: string
 *             example: Science Fiction
 *               - Podcasts
 *               - Fiction
 *         feedUrl:
 *           description: A URL of an RSS feed for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: http://feeds.nightvalepresents.com/welcometonightvalepodcast
 *           format: url
 *         imageUrl:
 *           description: A URL of a cover image for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: >-
 *               https://is4-ssl.mzstatic.com/image/thumb/Podcasts125/v4/4a/31/35/4a3135d0-1fe7-a2d7-fb43-d182ec175402/mza_8232698753950666850.jpg/600x600bb.jpg
 *           format: url
 *         itunesPageUrl:
 *           description: A URL of an iTunes page for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: >-
 *               https://podcasts.apple.com/us/podcast/welcome-to-night-vale/id536258179?uo=4
 *           format: url
 *         itunesId:
 *           description: The iTunes ID for the podcast. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 536258179
 *         itunesArtistId:
 *           description: The iTunes Artist ID for the author of the podcast. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 718704794
 *         explicit:
 *           description: Whether the podcast has been marked as explicit.
 *           type: boolean
 *           example: false
 *         language:
 *           description: The language of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *         type:
 *           description: The type of the podcast.
 *           type: [string, 'null']
 *           example: episodic
 *     podcastMetadataMinified:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Welcome to Night Vale
 *         titleIgnorePrefix:
 *           description: The title of the podcast with any prefix moved to the end.
 *           type: string
 *           example: Welcome to Night Vale
 *         author:
 *           description: The author of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Night Vale Presents
 *         description:
 *           description: The description for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         releaseDate:
 *           description: The release date of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2022-10-20T19:00:00Z'
 *           format: date-time
 *         genres:
 *           description: The podcast's genres.
 *           type: array
 *           items:
 *             type: string
 *             example: Science Fiction
 *               - Podcasts
 *               - Fiction
 *         feedUrl:
 *           description: A URL of an RSS feed for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: http://feeds.nightvalepresents.com/welcometonightvalepodcast
 *           format: url
 *         imageUrl:
 *           description: A URL of a cover image for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: >-
 *               https://is4-ssl.mzstatic.com/image/thumb/Podcasts125/v4/4a/31/35/4a3135d0-1fe7-a2d7-fb43-d182ec175402/mza_8232698753950666850.jpg/600x600bb.jpg
 *           format: url
 *         itunesPageUrl:
 *           description: A URL of an iTunes page for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: >-
 *               https://podcasts.apple.com/us/podcast/welcome-to-night-vale/id536258179?uo=4
 *           format: url
 *         itunesId:
 *           description: The iTunes ID for the podcast. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 536258179
 *         itunesArtistId:
 *           description: The iTunes Artist ID for the author of the podcast. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 718704794
 *         explicit:
 *           description: Whether the podcast has been marked as explicit.
 *           type: boolean
 *           example: false
 *         language:
 *           description: The language of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *         type:
 *           description: The type of the podcast.
 *           type: [string, 'null']
 *           example: episodic
 *     podcastMetadataExpanded:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Welcome to Night Vale
 *         titleIgnorePrefix:
 *           description: The title of the podcast with any prefix moved to the end.
 *           type: string
 *           example: Welcome to Night Vale
 *         author:
 *           description: The author of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Night Vale Presents
 *         description:
 *           description: The description for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         releaseDate:
 *           description: The release date of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2022-10-20T19:00:00Z'
 *           format: date-time
 *         genres:
 *           description: The podcast's genres.
 *           type: array
 *           items:
 *             type: string
 *             example: Science Fiction
 *               - Podcasts
 *               - Fiction
 *         feedUrl:
 *           description: A URL of an RSS feed for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: http://feeds.nightvalepresents.com/welcometonightvalepodcast
 *           format: url
 *         imageUrl:
 *           description: A URL of a cover image for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: >-
 *               https://is4-ssl.mzstatic.com/image/thumb/Podcasts125/v4/4a/31/35/4a3135d0-1fe7-a2d7-fb43-d182ec175402/mza_8232698753950666850.jpg/600x600bb.jpg
 *           format: url
 *         itunesPageUrl:
 *           description: A URL of an iTunes page for the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *           example: >-
 *               https://podcasts.apple.com/us/podcast/welcome-to-night-vale/id536258179?uo=4
 *           format: url
 *         itunesId:
 *           description: The iTunes ID for the podcast. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 536258179
 *         itunesArtistId:
 *           description: The iTunes Artist ID for the author of the podcast. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 718704794
 *         explicit:
 *           description: Whether the podcast has been marked as explicit.
 *           type: boolean
 *           example: false
 *         language:
 *           description: The language of the podcast. Will be null if unknown.
 *           type: [string, 'null']
 *         type:
 *           description: The type of the podcast.
 *           type: [string, 'null']
 *           example: episodic
 *     podcastEpisode:
 *       type: [object, 'null']
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item that contains the podcast.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         id:
 *           description: The ID of the podcast episode.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         index:
 *           description: The index of the podcast episode.
 *           type: integer
 *           example: 1
 *         season:
 *           description: The season of the podcast episode, if known.
 *           type: string
 *           example: ''
 *         episode:
 *           description: The episode of the season of the podcast, if known.
 *           type: string
 *           example: ''
 *         episodeType:
 *           description: The type of episode that the podcast episode is.
 *           type: string
 *           example: full
 *         title:
 *           description: The title of the podcast episode.
 *           type: string
 *           example: Pilot
 *         subtitle:
 *           description: The subtitle of the podcast episode.
 *           type: string
 *           example: >-
 *               Pilot Episode. A new dog park opens in Night Vale. Carlos, a scientist,
 *               visits and discovers some interesting things. Seismic things. Plus, a
 *               helpful guide to surveillance helicopter-spotting. Weather: "These and
 *               More Than These" by Joseph Fink Music:...
 *         description:
 *           description: A HTML encoded, description of the podcast episode.
 *           type: string
 *           example: >2-
 *               <p>Pilot Episode. A new dog park opens in Night Vale. Carlos, a scientist, visits and discovers some interesting things. Seismic things. Plus, a helpful guide to surveillance helicopter-spotting.</p>
 *               <p>Weather: "These and More Than These" by Joseph Fink</p>
 *               <p>Music: Disparition, <a target="_blank">disparition.info</a></p>
 *               <p>Logo: Rob Wilson, <a target="_blank">silastom.com</a></p>
 *               <p>Produced by Night Vale Presents. Written by Joseph Fink and Jeffrey
 *               Cranor. Narrated by Cecil Baldwin. More Info: <a
 *               target="_blank">welcometonightvale.com</a>, and follow <a
 *               target="_blank">@NightValeRadio</a> on Twitter or <a
 *               target="_blank">Facebook</a>.</p>
 *         enclosure:
 *           $ref: '#/components/schemas/podcastEpisodeEnclousure'
 *         pubDate:
 *           description: When the podcast episode was published.
 *           type: string
 *           example: Fri, 15 Jun 2012 12:00:00 -0000
 *         audioFile:
 *           $ref: '#/components/schemas/audioFile'
 *         publishedAt:
 *           description: The time (in ms since POSIX epoch) when the podcast episode was published.
 *           type: integer
 *           example: 1339761600000
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the podcast episode was added to the library.
 *           type: integer
 *           example: 1667326679503
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the podcast episode was last updated.
 *           type: integer
 *           example: 1667326679503
 *     podcastEpisodeExpanded:
 *       type: [object, 'null']
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item that contains the podcast.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         id:
 *           description: The ID of the podcast episode.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         index:
 *           description: The index of the podcast episode.
 *           type: integer
 *           example: 1
 *         season:
 *           description: The season of the podcast episode, if known.
 *           type: string
 *           example: ''
 *         episode:
 *           description: The episode of the season of the podcast, if known.
 *           type: string
 *           example: ''
 *         episodeType:
 *           description: The type of episode that the podcast episode is.
 *           type: string
 *           example: full
 *         title:
 *           description: The title of the podcast episode.
 *           type: string
 *           example: Pilot
 *         subtitle:
 *           description: The subtitle of the podcast episode.
 *           type: string
 *           example: >-
 *               Pilot Episode. A new dog park opens in Night Vale. Carlos, a scientist,
 *               visits and discovers some interesting things. Seismic things. Plus, a
 *               helpful guide to surveillance helicopter-spotting. Weather: "These and
 *               More Than These" by Joseph Fink Music:...
 *         description:
 *           description: A HTML encoded, description of the podcast episode.
 *           type: string
 *           example: >2-
 * 
 *                       <p>Pilot Episode. A new dog park opens in Night Vale. Carlos, a scientist, visits and discovers some interesting things. Seismic things. Plus, a helpful guide to surveillance helicopter-spotting.</p>
 * 
 *               <p>Weather: "These and More Than These" by Joseph Fink</p>
 * 
 * 
 *               <p>Music: Disparition, <a target="_blank">disparition.info</a></p>
 * 
 * 
 *               <p>Logo: Rob Wilson, <a target="_blank">silastom.com</a></p>
 * 
 * 
 *               <p>Produced by Night Vale Presents. Written by Joseph Fink and Jeffrey
 *               Cranor. Narrated by Cecil Baldwin. More Info: <a
 *               target="_blank">welcometonightvale.com</a>, and follow <a
 *               target="_blank">@NightValeRadio</a> on Twitter or <a
 *               target="_blank">Facebook</a>.</p>
 *         enclosure:
 *           $ref: '#/components/schemas/podcastEpisodeEnclousure'
 *         pubDate:
 *           description: When the podcast episode was published.
 *           type: string
 *           example: Fri, 15 Jun 2012 12:00:00 -0000
 *         audioFile:
 *           $ref: '#/components/schemas/audioFile'
 *         audioTrack:
 *           $ref: '#/components/schemas/audioTrack'
 *         publishedAt:
 *           description: The time (in ms since POSIX epoch) when the podcast episode was published.
 *           type: integer
 *           example: 1339761600000
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the podcast episode was added to the library.
 *           type: integer
 *           example: 1667326679503
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the podcast episode was last updated.
 *           type: integer
 *           example: 1667326679503
 *         duration:
 *           description: The total length (in seconds) of the podcast episode.
 *           type: number
 *           example: 1454.18449
 *         size:
 *           description: The total size (in bytes) of the podcast episode.
 *           type: integer
 *           example: 23653735
 *     podcastEpisodeEnclousure:
 *       type: [object, 'null']
 *       properties:
 *         url:
 *           description: The URL where the podcast episode's audio file was downloaded from.
 *           type: string
 *           example: >-
 *               https://www.podtrac.com/pts/redirect.mp3/dovetail.prxu.org/_/126/1fadf1ad-aad8-449f-843b-6e8bb6949622/1_Pilot.mp3
 *           format: url
 *         type:
 *           description: The MIME type of the podcast episode's audio file.
 *           type: string
 *           example: audio/mpeg
 *         length:
 *           description: The size (in bytes) that was reported when downloading the podcast episode's audio file.
 *           type: string
 *           example: '20588611'
 *     podcastEpisodeDownload:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the podcast episode download.
 *           type: string
 *           example: epdl_pgv4d47j6dtqpk4r0v
 *         episodeDisplayTitle:
 *           description: The display title of the episode to be downloaded.
 *           type: string
 *           example: Glow Cloud
 *         url:
 *           description: The URL from which to download the episode.
 *           type: string
 *           example: >-
 *               https://www.podtrac.com/pts/redirect.mp3/dovetail.prxu.org/_/126/cb1dd91f-5d8d-42e9-ba22-14ff335d2cbb/2_Glow_Cloud.mp3
 *           format: url
 *         libraryItemId:
 *           description: The ID of the library item the episode belongs to.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         isFinished:
 *           description: Whether the episode has finished downloading.
 *           type: boolean
 *           example: false
 *         failed:
 *           description: Whether the episode failed to download.
 *           type: boolean
 *           example: false
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the episode started downloading. Will be null if it has not started downloading yet.
 *           type: [string, 'null']
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         finishedAt:
 *           description: The time (in ms since POSIX epoch) when the episode finished downloading. Will be null if it has not finished.
 *           type: [string, 'null']
 *         podcastTitle:
 *           description: The title of the episode's podcast.
 *           type: [string, 'null']
 *           example: Welcome to Night Vale
 *         podcastExplicit:
 *           description: Whether the episode's podcast is explicit.
 *           type: boolean
 *           example: false
 *         season:
 *           description: The season of the podcast episode.
 *           type: [string, 'null']
 *           example: ''
 *         episode:
 *           description: The episode number of the podcast episode.
 *           type: [string, 'null']
 *           example: ''
 *         episodeType:
 *           description: The type of the podcast episode.
 *           type: string
 *           example: full
 *         publishedAt:
 *           description: The time (in ms since POSIX epoch) when the episode was published.
 *           type: [integer, 'null']
 *           example: 1341144000000
 *     podcastFeed:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/podcastMetadata'
 *         episodes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/podcastEpisode'
 *     podcastFeedMinified:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/podcastMetadata'
 *         numEpisodes:
 *           description: The number of episodes the podcast has.
 *           type: integer
 *           example: 280
 *     podcastFeedMetadata:
 *       type: object
 *       properties:
 *         image:
 *           description: A URL for the podcast's cover image.
 *           type: string
 *           example: >-
 *               https://f.prxu.org/126/images/1f749c5d-c83a-4db9-8112-a3245da49c54/nightvalelogo-web4.jpg
 *           format: url
 *         categories:
 *           description: The podcast's categories. Can be similar to genres.
 *           type: array
 *           items:
 *             type: string
 *             example: Fiction:Science Fiction
 *         feedUrl:
 *           description: A URL of an RSS feed for the podcast.
 *           type: string
 *           example: http://feeds.nightvalepresents.com/welcometonightvalepodcast
 *           format: url
 *         description:
 *           description: A HTML encoded description of the podcast.
 *           type: string
 *           example: |2-
 * 
 *                     <p>Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.</p>
 *                   
 *         descriptionPlain:
 *           description: A plain text description of the podcast.
 *           type: string
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         title:
 *           description: The podcast's title.
 *           type: string
 *           example: Welcome to Night Vale
 *         language:
 *           description: The podcast's language.
 *           type: string
 *           example: en
 *         explicit:
 *           description: Whether the podcast is explicit. Will probably be "true" or "false".
 *           type: string
 *           example: 'false'
 *         author:
 *           description: The podcast's author.
 *           type: string
 *           example: Night Vale Presents
 *         pubDate:
 *           description: The podcast's publication date.
 *           type: string
 *           example: Thu, 17 Nov 2022 16:04:42 -0000
 *         link:
 *           description: A URL the RSS feed provided for possible display to the user.
 *           type: string
 *           example: http://welcometonightvale.com
 *           format: url
 *     podcastFeedEpisode:
 *       type: object
 *       properties:
 *         title:
 *           description: The podcast episode's title.
 *           type: string
 *           example: Pilot
 *         subtitle:
 *           description: The podcast episode's subtitle.
 *           type: string
 *           example: >-
 *               Pilot Episode. A new dog park opens in Night Vale. Carlos, a scientist,
 *               visits and discovers some interesting things. Seismic things. Plus, a
 *               helpful guide to surveillance helicopter-spotting. Weather: "These and
 *               More Than These" by Joseph Fink Music:...
 *         description:
 *           description: A HTML encoded description of the podcast episode.
 *           type: string
 *           example: >2-
 * 
 *                       <p>Pilot Episode. A new dog park opens in Night Vale. Carlos, a scientist, visits and discovers some interesting things. Seismic things. Plus, a helpful guide to surveillance helicopter-spotting.</p>
 * 
 *               <p>Weather: "These and More Than These" by Joseph Fink</p>
 * 
 * 
 *               <p>Music: Disparition, <a target="_blank">disparition.info</a></p>
 * 
 * 
 *               <p>Logo: Rob Wilson, <a target="_blank">silastom.com</a></p>
 * 
 * 
 *               <p>Produced by Night Vale Presents. Written by Joseph Fink and Jeffrey
 *               Cranor. Narrated by Cecil Baldwin. More Info: <a
 *               target="_blank">welcometonightvale.com</a>, and follow <a
 *               target="_blank">@NightValeRadio</a> on Twitter or <a
 *               target="_blank">Facebook</a>.</p>
 *                     
 *         descriptionPlain:
 *           description: A plain text description of the podcast episode.
 *           type: string
 *           example: >2-
 * 
 *                       Pilot Episode. A new dog park opens in Night Vale. Carlos, a scientist, visits and discovers some interesting things. Seismic things. Plus, a helpful guide to surveillance helicopter-spotting.
 * 
 *               Weather: "These and More Than These" by Joseph Fink
 * 
 * 
 *               Music: Disparition, disparition.info
 * 
 * 
 *               Logo: Rob Wilson, silastom.com
 * 
 * 
 *               Produced by Night Vale Presents. Written by Joseph Fink and Jeffrey
 *               Cranor. Narrated by Cecil Baldwin. More Info: welcometonightvale.com,
 *               and follow @NightValeRadio on Twitter or Facebook.
 *         pubDate:
 *           description: The podcast episode's publication date.
 *           type: string
 *           example: Fri, 15 Jun 2012 12:00:00 -0000
 *         episodeType:
 *           description: The type of episode that the podcast episode is.
 *           type: string
 *           example: full
 *         season:
 *           description: The season of the podcast episode.
 *           type: string
 *           example: ''
 *         episode:
 *           description: The episode of the season of the podcast.
 *           type: string
 *           example: ''
 *         author:
 *           description: The author of the podcast episode.
 *           type: string
 *           example: ''
 *         duration:
 *           description: The duration of the podcast episode as reported by the RSS feed.
 *           type: string
 *           example: '21:02'
 *         explicit:
 *           description: Whether the podcast episode is explicit.
 *           type: string
 *           example: ''
 *         publishedAt:
 *           description: The time (in ms since POSIX epoch) when the podcast episode was published.
 *           type: integer
 *           example: 1339761600000
 *         enclosure:
 *           $ref: '#/components/schemas/podcastEpisodeEnclousure'
 *     audioFile:
 *       type: object
 *       properties:
 *         index:
 *           description: The index of the audio file.
 *           type: integer
 *           example: 1
 *         ino:
 *           description: The inode of the audio file.
 *           type: string
 *           example: '649644248522215260'
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the audio file was added to the library.
 *           type: integer
 *           example: 1650621074131
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the audio file last updated. (Read Only)
 *           type: integer
 *           example: 1651830828023
 *         trackNumFromMeta:
 *           description: The track number of the audio file as pulled from the file's metadata. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 1
 *         discNumFromMeta:
 *           description: The disc number of the audio file as pulled from the file's metadata. Will be null if unknown.
 *           type: [string, 'null']
 *         trackNumFromFilename:
 *           description: The track number of the audio file as determined from the file's name. Will be null if unknown.
 *           type: [integer, 'null']
 *           example: 1
 *         discNumFromFilename:
 *           description: The track number of the audio file as determined from the file's name. Will be null if unknown.
 *           type: [string, 'null']
 *         manuallyVerified:
 *           description: Whether the audio file has been manually verified by a user.
 *           type: boolean
 *           example: false
 *         invalid:
 *           description: Whether the audio file is missing from the server.
 *           type: boolean
 *           example: false
 *         exclude:
 *           description: Whether the audio file has been marked for exclusion.
 *           type: boolean
 *           example: false
 *         error:
 *           description: Any error with the audio file. Will be null if there is none.
 *           type: [string, 'null']
 *         format:
 *           description: The format of the audio file.
 *           type: string
 *           example: MP2/3 (MPEG audio layer 2/3)
 *         duration:
 *           description: The total length (in seconds) of the audio file.
 *           type: number
 *           example: 6004.6675
 *         bitRate:
 *           description: The bit rate (in bit/s) of the audio file.
 *           type: integer
 *           example: 64000
 *         language:
 *           description: The language of the audio file.
 *           type: [string, 'null']
 *         codec:
 *           description: The codec of the audio file.
 *           type: string
 *           example: mp3
 *         timeBase:
 *           description: The time base of the audio file.
 *           type: string
 *           example: 1/14112000
 *         channels:
 *           description: The number of channels the audio file has.
 *           type: integer
 *           example: 2
 *         channelLayout:
 *           description: The layout of the audio file's channels.
 *           type: string
 *           example: stereo
 *         chapters:
 *           description: If the audio file is part of an audiobook, the chapters the file contains.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         embeddedCoverArt:
 *           description: The type of embedded cover art in the audio file. Will be null if none exists.
 *           type: [string, 'null']
 *         metaTags:
 *           $ref: '#/components/schemas/audioMetaTags'
 *         mimeType:
 *           description: The MIME type of the audio file.
 *           type: string
 *           example: audio/mpeg
 *     audioMetaTags:
 *       description: ID3 metadata tags pulled from the audio file on import. Only non-null tags will be returned in requests.
 *       type: object
 *       properties:
 *         tagAlbum:
 *           type: [string, 'null']
 *           example: SOT Bk01
 *         tagArtist:
 *           type: [string, 'null']
 *           example: Terry Goodkind
 *         tagGenre:
 *           type: [string, 'null']
 *           example: Audiobook Fantasy
 *         tagTitle:
 *           type: [string, 'null']
 *           example: Wizards First Rule 01
 *         tagSeries:
 *           type: [string, 'null']
 *         tagSeriesPart:
 *           type: [string, 'null']
 *         tagTrack:
 *           type: [string, 'null']
 *           example: 01/20
 *         tagDisc:
 *           type: [string, 'null']
 *         tagSubtitle:
 *           type: [string, 'null']
 *         tagAlbumArtist:
 *           type: [string, 'null']
 *           example: Terry Goodkind
 *         tagDate:
 *           type: [string, 'null']
 *         tagComposer:
 *           type: [string, 'null']
 *           example: Terry Goodkind
 *         tagPublisher:
 *           type: [string, 'null']
 *         tagComment:
 *           type: [string, 'null']
 *         tagDescription:
 *           type: [string, 'null']
 *         tagEncoder:
 *           type: [string, 'null']
 *         tagEncodedBy:
 *           type: [string, 'null']
 *         tagIsbn:
 *           type: [string, 'null']
 *         tagLanguage:
 *           type: [string, 'null']
 *         tagASIN:
 *           type: [string, 'null']
 *         tagOverdriveMediaMarker:
 *           type: [string, 'null']
 *         tagOriginalYear:
 *           type: [string, 'null']
 *         tagReleaseCountry:
 *           type: [string, 'null']
 *         tagReleaseType:
 *           type: [string, 'null']
 *         tagReleaseStatus:
 *           type: [string, 'null']
 *         tagISRC:
 *           type: [string, 'null']
 *         tagMusicBrainzTrackId:
 *           type: [string, 'null']
 *         tagMusicBrainzAlbumId:
 *           type: [string, 'null']
 *         tagMusicBrainzAlbumArtistId:
 *           type: [string, 'null']
 *         tagMusicBrainzArtistId:
 *           type: [string, 'null']
 *     audioTrack:
 *       type: object
 *       properties:
 *         index:
 *           description: The index of the audio track.
 *           type: integer
 *           example: 1
 *         startOffset:
 *           description: When in the audio file (in seconds) the track starts.
 *           type: number
 *           example: 0
 *         duration:
 *           description: The length (in seconds) of the audio track.
 *           type: number
 *           example: 33854.905
 *         title:
 *           description: The filename of the audio file the audio track belongs to.
 *           type: string
 *           example: Wizards First Rule 01.mp3
 *         contentUrl:
 *           description: The URL path of the audio file.
 *           type: string
 *           example: >-
 *               /s/item/li_8gch9ve09orgn4fdz8/Terry Goodkind - SOT Bk01 - Wizards First
 *               Rule 01.mp3
 *         mimeType:
 *           description: The MIME type of the audio file.
 *           type: string
 *           example: audio/mpeg
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 *     ebookFile:
 *       type: [object, 'null']
 *       properties:
 *         ino:
 *           description: The inode of the ebook file.
 *           type: string
 *           example: '9463162'
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 *         ebookFormat:
 *           description: The ebook format of the ebook file.
 *           type: string
 *           example: epub
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the library file was added.
 *           type: integer
 *           example: 1650621073750
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the library file was last updated.
 *           type: integer
 *           example: 1650621110769
 *     libraryFile:
 *       type: object
 *       properties:
 *         ino:
 *           description: The inode of the library file.
 *           type: string
 *           example: '649644248522215260'
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the library file was added.
 *           type: integer
 *           example: 1650621052494
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the library file was last updated.
 *           type: integer
 *           example: 1650621052494
 *         fileType:
 *           description: The type of file that the library file is (audio, image, etc.).
 *           type: string
 *           example: audio
 *     fileMetadata:
 *       type: [object, 'null']
 *       properties:
 *         filename:
 *           description: The filename of the file.
 *           type: string
 *           example: Wizards First Rule 01.mp3
 *         ext:
 *           description: The file extension of the file.
 *           type: string
 *           example: .mp3
 *         path:
 *           description: The absolute path on the server of the file.
 *           type: string
 *           example: >-
 *               /audiobooks/Terry Goodkind/Sword of Truth/Wizards First Rule/Terry
 *               Goodkind - SOT Bk01 - Wizards First Rule 01.mp3
 *         relPath:
 *           description: The path of the file, relative to the book's or podcast's folder.
 *           type: string
 *           example: Wizards First Rule 01.mp3
 *         size:
 *           description: The size (in bytes) of the file.
 *           type: integer
 *           example: 48037888
 *         mtimeMs:
 *           description: The time (in ms since POSIX epoch) when the file was last modified on disk.
 *           type: integer
 *           example: 1632223180278
 *         ctimeMs:
 *           description: The time (in ms since POSIX epoch) when the file status was changed on disk.
 *           type: integer
 *           example: 1645978261001
 *         birthtimeMs:
 *           description: The time (in ms since POSIX epoch) when the file was created on disk. Will be 0 if unknown.
 *           type: integer
 *           example: 0
 *     author:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the author.
 *           type: string
 *           example: aut_z3leimgybl7uf3y4ab
 *         asin:
 *           description: The ASIN of the author. Will be null if unknown.
 *           type: [string, 'null']
 *         name:
 *           description: The name of the author.
 *           type: string
 *           example: Terry Goodkind
 *         description:
 *           description: A description of the author. Will be null if there is none.
 *           type: [string, 'null']
 *         imagePath:
 *           description: The absolute path for the author image. Will be null if there is no image.
 *           type: [string, 'null']
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the author was added.
 *           type: integer
 *           example: 1650621073750
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the author was last updated.
 *           type: integer
 *           example: 1650621073750
 *     authorMinified:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the author.
 *           type: string
 *           example: aut_z3leimgybl7uf3y4ab
 *         name:
 *           description: The name of the author.
 *           type: string
 *           example: Terry Goodkind
 *     authorExpanded:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the author.
 *           type: string
 *           example: aut_z3leimgybl7uf3y4ab
 *         asin:
 *           description: The ASIN of the author. Will be null if unknown.
 *           type: [string, 'null']
 *         name:
 *           description: The name of the author.
 *           type: string
 *           example: Terry Goodkind
 *         description:
 *           description: A description of the author. Will be null if there is none.
 *           type: [string, 'null']
 *         imagePath:
 *           description: The absolute path for the author image. Will be null if there is no image.
 *           type: [string, 'null']
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the author was added.
 *           type: integer
 *           example: 1650621073750
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the author was last updated.
 *           type: integer
 *           example: 1650621073750
 *         numBooks:
 *           description: The number of books associated with the author in the library.
 *           type: integer
 *           example: 1
 *     series:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the series.
 *           type: string
 *           example: ser_cabkj4jeu8be3rap4g
 *         name:
 *           description: The name of the series.
 *           type: string
 *           example: Sword of Truth
 *         description:
 *           description: A description for the series. Will be null if there is none.
 *           type: [string, 'null']
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the series was added.
 *           type: integer
 *           example: 1650621073750
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the series was last updated.
 *           type: integer
 *           example: 1650621073750
 *     seriesNumBooks:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the series.
 *           type: string
 *           example: ser_cabkj4jeu8be3rap4g
 *         name:
 *           description: The name of the series.
 *           type: string
 *           example: Sword of Truth
 *         nameIgnorePrefix:
 *           description: The name of the series with any prefix moved to the end.
 *           type: string
 *           example: Sword of Truth
 *         libraryItemIds:
 *           description: The IDs of the library items in the series.
 *           type: array
 *           items:
 *             type: string
 *             example: li_8gch9ve09orgn4fdz8
 *         numBooks:
 *           description: The number of books in the series.
 *           type: integer
 *           example: 1
 *     seriesBooks:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the series.
 *           type: string
 *           example: ser_cabkj4jeu8be3rap4g
 *         name:
 *           description: The name of the series.
 *           type: string
 *           example: Sword of Truth
 *         nameIgnorePrefix:
 *           description: The name of the series with any prefix moved to the end.
 *           type: string
 *           example: Sword of Truth
 *         nameIgnorePrefixSort:
 *           description: The name of the series with any prefix removed.
 *           type: string
 *           example: Sword of Truth
 *         type:
 *           description: Will always be series.
 *           type: string
 *           example: series
 *         books:
 *           description: The library items that contain the books in the series. A sequence attribute that denotes the position in the series the book is in, is tacked on.
 *           type: array
 *           items: 
 *             $ref: '#/components/schemas/libraryItem'
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the series was added.
 *           type: integer
 *           example: 1650621073750
 *         totalDuration:
 *           description: The combined duration (in seconds) of all books in the series.
 *           type: number
 *           example: 12000.946
 *     seriesSequence:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the series.
 *           type: string
 *           example: ser_cabkj4jeu8be3rap4g
 *         name:
 *           description: The name of the series.
 *           type: string
 *           example: Sword of Truth
 *         sequence:
 *           description: The position in the series the book is.
 *           type: string
 *           example: '1'
 *     playlist:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the playlist.
 *           type: string
 *           example: pl_qbwet64998s5ra6dcu
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         userId:
 *           description: The ID of the user the playlist belongs to.
 *           type: string
 *           example: root
 *         name:
 *           description: The playlist's name.
 *           type: string
 *           example: Favorites
 *         description:
 *           description: The playlist's description.
 *           type: [string, 'null']
 *         coverPath:
 *           description: The path of the playlist's cover.
 *           type: [string, 'null']
 *         items:
 *           description: The items in the playlist.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/playlistItem'
 *         lastUpdate:
 *           description: The time (in ms since POSIX epoch) when the playlist was last updated.
 *           type: integer
 *           example: 1669623431313
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *     playlistExpanded:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the playlist.
 *           type: string
 *           example: pl_qbwet64998s5ra6dcu
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         userId:
 *           description: The ID of the user the playlist belongs to.
 *           type: string
 *           example: root
 *         name:
 *           description: The playlist's name.
 *           type: string
 *           example: Favorites
 *         description:
 *           description: The playlist's description.
 *           type: [string, 'null']
 *         coverPath:
 *           description: The path of the playlist's cover.
 *           type: [string, 'null']
 *         items:
 *           description: The items in the playlist.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/playlistItemExpanded'
 *         lastUpdate:
 *           description: The time (in ms since POSIX epoch) when the playlist was last updated.
 *           type: integer
 *           example: 1669623431313
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *     playlistItem:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item the playlist item is for.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         episodeId:
 *           description: The ID of the podcast episode the playlist item is for.
 *           type: [string, 'null']
 *     playlistItemExpanded:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item the playlist item is for.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         episodeId:
 *           description: The ID of the podcast episode the playlist item is for.
 *           type: [string, 'null']
 *         episode:
 *           $ref: '#/components/schemas/podcastEpisodeExpanded'
 *         libraryItem:
 *           description: The library item the playlist item is for. Will be Library Item Minified if episodeId is not null.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *             - $ref: '#/components/schemas/libraryItemMinified'
 *             - $ref: '#/components/schemas/libraryItemExpanded'
 *     mediaProgress:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the media progress. If the media progress is for a book, this will just be the libraryItemId. If for a podcast episode, it will be a hyphenated combination of the libraryItemId and episodeId.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm-ep_lh6ko39pumnrma3dhv
 *         libraryItemId:
 *           description: The ID of the library item the media progress is of.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode the media progress is of. Will be null if the progress is for a book.
 *           type: [string, 'null']
 *           example: ep_lh6ko39pumnrma3dhv
 *         duration:
 *           description: The total duration (in seconds) of the media. Will be 0 if the media was marked as finished without the user listening to it.
 *           type: number
 *           example: 1454.18449
 *         progress:
 *           description: The percentage completion progress of the media. Will be 1 if the media is finished.
 *           type: number
 *           example: 0.011193983371394644
 *         currentTime:
 *           description: The current time (in seconds) of the user's progress. If the media has been marked as finished, this will be the time the user was at beforehand.
 *           type: number
 *           example: 16.278117
 *         isFinished:
 *           description: Whether the media is finished.
 *           type: boolean
 *           example: false
 *         hideFromContinueListening:
 *           description: Whether the media will be hidden from the "Continue Listening" shelf.
 *           type: boolean
 *           example: false
 *         lastUpdate:
 *           description: The time (in ms since POSIX epoch) when the media progress was last updated.
 *           type: integer
 *           example: 1668120246620
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the media progress was created.
 *           type: integer
 *           example: 1668120083771
 *         finishedAt:
 *           description: The time (in ms since POSIX epoch) when the media was finished. Will be null if the media has is not finished.
 *           type: [string, 'null']
 *     mediaProgressWithMedia:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the media progress. If the media progress is for a book, this will just be the libraryItemId. If for a podcast episode, it will be a hyphenated combination of the libraryItemId and episodeId.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm-ep_lh6ko39pumnrma3dhv
 *         libraryItemId:
 *           description: The ID of the library item the media progress is of.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode the media progress is of. Will be null if the progress is for a book.
 *           type: [string, 'null']
 *           example: ep_lh6ko39pumnrma3dhv
 *         duration:
 *           description: The total duration (in seconds) of the media. Will be 0 if the media was marked as finished without the user listening to it.
 *           type: number
 *           example: 1454.18449
 *         progress:
 *           description: The percentage completion progress of the media. Will be 1 if the media is finished.
 *           type: number
 *           example: 0.011193983371394644
 *         currentTime:
 *           description: The current time (in seconds) of the user's progress. If the media has been marked as finished, this will be the time the user was at beforehand.
 *           type: number
 *           example: 16.278117
 *         isFinished:
 *           description: Whether the media is finished.
 *           type: boolean
 *           example: false
 *         hideFromContinueListening:
 *           description: Whether the media will be hidden from the "Continue Listening" shelf.
 *           type: boolean
 *           example: false
 *         lastUpdate:
 *           description: The time (in ms since POSIX epoch) when the media progress was last updated.
 *           type: integer
 *           example: 1668120246620
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the media progress was created.
 *           type: integer
 *           example: 1668120083771
 *         finishedAt:
 *           description: The time (in ms since POSIX epoch) when the media was finished. Will be null if the media has is not finished.
 *           type: [string, 'null']
 *         media:
 *           description: The media of the library item the media progress is for.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *             - $ref: '#/components/schemas/bookExpanded'
 *             - $ref: '#/components/schemas/podcastExpanded'
 *         episode:
 *           $ref: '#/components/schemas/podcastEpisode'
 *     playbackSession:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the playback session.
 *           type: string
 *           example: play_c786zm3qtjz6bd5q3n
 *         userId:
 *           description: The ID of the user the playback session is for.
 *           type: string
 *           example: root
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         libraryItemId:
 *           description: The ID of the library item.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode. Will be null if this playback session was started without an episode ID.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         mediaMetadata:
 *           description: The metadata of the library item's media.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *              - $ref: '#/components/schemas/bookMetadata'
 *              - $ref: '#/components/schemas/podcastMetadata'
 *         chapters:
 *           description: If the library item is a book, the chapters it contains.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         displayTitle:
 *           description: The title of the playing item to show to the user.
 *           type: string
 *           example: Pilot
 *         displayAuthor:
 *           description: The author of the playing item to show to the user.
 *           type: string
 *           example: Night Vale Presents
 *         coverPath:
 *           description: The cover path of the library item's media.
 *           type: string
 *           example: /metadata/items/li_bufnnmp4y5o2gbbxfm/cover.jpg
 *         duration:
 *           description: The total duration (in seconds) of the playing item.
 *           type: number
 *           example: 1454.18449
 *         playMethod:
 *           description: What play method the playback session is using. See below for values.
 *           type: integer
 *           example: 0
 *         mediaPlayer:
 *           description: The given media player when the playback session was requested.
 *           type: string
 *           example: unknown
 *         deviceInfo:
 *           $ref: '#/components/schemas/deviceInfo'
 *         serverVersion:
 *           description: The server version the playback session was started with.
 *           type: string
 *           example: 2.4.4
 *         date:
 *           description: The day (in the format YYYY-MM-DD) the playback session was started.
 *           type: string
 *           example: '2022-11-11'
 *           format: date
 *         dayOfWeek:
 *           description: The day of the week the playback session was started.
 *           type: string
 *           example: Friday
 *         timeListening:
 *           description: The amount of time (in seconds) the user has spent listening using this playback session.
 *           type: number
 *           example: 0
 *         startTime:
 *           description: The time (in seconds) where the playback session started.
 *           type: number
 *           example: 0
 *         currentTime:
 *           description: The current time (in seconds) of the playback position.
 *           type: number
 *           example: 0
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was started.
 *           type: integer
 *           example: 1668206493239
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was last updated.
 *           type: integer
 *           example: 1668206493239
 *     playbackSessionExpanded:
 *       type: [object, 'null']
 *       properties:
 *         id:
 *           description: The ID of the playback session.
 *           type: string
 *           example: play_c786zm3qtjz6bd5q3n
 *         userId:
 *           description: The ID of the user the playback session is for.
 *           type: string
 *           example: root
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         libraryItemId:
 *           description: The ID of the library item.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode. Will be null if this playback session was started without an episode ID.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         mediaMetadata:
 *           description: The metadata of the library item's media.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *              - $ref: '#/components/schemas/bookMetadata'
 *              - $ref: '#/components/schemas/podcastMetadata'
 *         chapters:
 *           description: If the library item is a book, the chapters it contains.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         displayTitle:
 *           description: The title of the playing item to show to the user.
 *           type: string
 *           example: Pilot
 *         displayAuthor:
 *           description: The author of the playing item to show to the user.
 *           type: string
 *           example: Night Vale Presents
 *         coverPath:
 *           description: The cover path of the library item's media.
 *           type: string
 *           example: /metadata/items/li_bufnnmp4y5o2gbbxfm/cover.jpg
 *         duration:
 *           description: The total duration (in seconds) of the playing item.
 *           type: number
 *           example: 1454.18449
 *         playMethod:
 *           description: What play method the playback session is using. See below for values.
 *           type: integer
 *           example: 0
 *         mediaPlayer:
 *           description: The given media player when the playback session was requested.
 *           type: string
 *           example: unknown
 *         deviceInfo:
 *           $ref: '#/components/schemas/deviceInfo'
 *         serverVersion:
 *           description: The server version the playback session was started with.
 *           type: string
 *           example: 2.4.4
 *         date:
 *           description: The day (in the format YYYY-MM-DD) the playback session was started.
 *           type: string
 *           example: '2022-11-11'
 *           format: date
 *         dayOfWeek:
 *           description: The day of the week the playback session was started.
 *           type: string
 *           example: Friday
 *         timeListening:
 *           description: The amount of time (in seconds) the user has spent listening using this playback session.
 *           type: number
 *           example: 0
 *         startTime:
 *           description: The time (in seconds) where the playback session started.
 *           type: number
 *           example: 0
 *         currentTime:
 *           description: The current time (in seconds) of the playback position.
 *           type: number
 *           example: 0
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was started.
 *           type: integer
 *           example: 1668206493239
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was last updated.
 *           type: integer
 *           example: 1668206493239
 *         audioTracks:
 *           description: The audio tracks that are being played with the playback session.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/audioFile'
 *         videoTrack:
 *           description: The video track that is being played with the playback session. Will be null if the playback session is for a book or podcast. (Video Track Object does not exist)
 *           type: [string, 'null']
 *         libraryItem:
 *           $ref: '#/components/schemas/libraryItemExpanded'
 *     deviceInfo:
 *       type: object
 *       properties:
 *         id:
 *           description: Unique identifier.
 *           type: string
 *           example: 69b7e852-23a6-4587-bed3-6a5966062e38
 *           format: uuid
 *         userId:
 *           description: User identifier.
 *           type: string
 *           example: 3c479fe6-6bf8-44e4-a4a6-680c768b501c
 *           format: uuid
 *         deviceId:
 *           description: Device identifier, as provided in the request.
 *           type: string
 *           example: 4dd05e7fadca538b
 *         ipAddress:
 *           description: The IP address that the request came from.
 *           type: [string, 'null']
 *           example: 192.168.1.118
 *           format: ipv4
 *         browserName:
 *           description: The browser name, taken from the user agent.
 *           type: [string, 'null']
 *           example: Firefox
 *         browserVersion:
 *           description: The browser version, taken from the user agent.
 *           type: [string, 'null']
 *           example: '106.0'
 *         osName:
 *           description: The name of OS, taken from the user agent.
 *           type: [string, 'null']
 *           example: Linux
 *         osVersion:
 *           description: The version of the OS, taken from the user agent.
 *           type: [string, 'null']
 *           example: x86_64
 *         deviceName:
 *           description: The device name, constructed automatically from other attributes.
 *           type: [string, 'null']
 *         deviceType:
 *           description: The device name, constructed automatically from other attributes.
 *           type: [string, 'null']
 *         manufacturer:
 *           description: The client device's manufacturer, as provided in the request.
 *           type: [string, 'null']
 *         model:
 *           description: The client device's model, as provided in the request.
 *           type: [string, 'null']
 *         sdkVersion:
 *           description: For an Android device, the Android SDK version of the client, as provided in the request.
 *           type: [string, 'null']
 *         clientName:
 *           description: Name of the client, as provided in the request.
 *           type: string
 *           example: Abs Web
 *         clientVersion:
 *           description: Version of the client, as provided in the request.
 *           type: string
 *           example: 2.3.3
 *     user:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the user. Only the root user has the root ID.
 *           type: string
 *           example: root
 *         username:
 *           description: The username of the user.
 *           type: string
 *           example: root
 *         type:
 *           description: The type of the user. Will be root, guest, user, or admin. There will be only one root user which is created when the server first starts.
 *           type: string
 *           example: root
 *         token:
 *           description: The authentication token of the user.
 *           type: string
 *           example: exJhbGciOiJI6IkpXVCJ9.eyJ1c2Vyi5NDEyODc4fQ.ZraBFohS4Tg39NszY
 *         mediaProgress:
 *           description: The user's media progress.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/mediaProgress'
 *         seriesHideFromContinueListening:
 *           description: The IDs of series to hide from the user's "Continue Series" shelf.
 *           type: array
 *           items:
 *             type: string
 *             example: ...
 *         bookmarks:
 *           description: The user's bookmarks.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/audioBookmark'
 *         isActive:
 *           description: Whether the user's account is active.
 *           type: boolean
 *           example: true
 *         isLocked:
 *           description: Whether the user is locked.
 *           type: boolean
 *           example: false
 *         lastSeen:
 *           description: The time (in ms since POSIX epoch) when the user was last seen by the server. Will be null if the user has never logged in.
 *           type: integer
 *           example: 1668296147437
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         permissions:
 *           $ref: '#/components/schemas/userPermissions'
 *         librariesAccessible:
 *           description: The IDs of libraries accessible to the user. An empty array means all libraries are accessible.
 *           type: array
 *           items:
 *             type: string
 *             example: ...
 *         itemTagsAccessible:
 *           description: The tags accessible to the user. An empty array means all tags are accessible.
 *           type: array
 *           items:
 *             type: string
 *             example: ...
 *     userWithProgressDetails:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the user. Only the root user has the root ID.
 *           type: string
 *           example: root
 *         username:
 *           description: The username of the user.
 *           type: string
 *           example: root
 *         type:
 *           description: The type of the user. Will be root, guest, user, or admin. There will be only one root user which is created when the server first starts.
 *           type: string
 *           example: root
 *         token:
 *           description: The authentication token of the user.
 *           type: string
 *           example: exJhbGciOiJI6IkpXVCJ9.eyJ1c2Vyi5NDEyODc4fQ.ZraBFohS4Tg39NszY
 *         mediaProgress:
 *           description: The user's media progress.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/mediaProgressWithMedia'
 *         seriesHideFromContinueListening:
 *           description: The IDs of series to hide from the user's "Continue Series" shelf.
 *           type: array
 *           items:
 *             type: string
 *             example: ...
 *         bookmarks:
 *           description: The user's bookmarks.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/audioBookmark'
 *         isActive:
 *           description: Whether the user's account is active.
 *           type: boolean
 *           example: true
 *         isLocked:
 *           description: Whether the user is locked.
 *           type: boolean
 *           example: false
 *         lastSeen:
 *           description: The time (in ms since POSIX epoch) when the user was last seen by the server. Will be null if the user has never logged in.
 *           type: integer
 *           example: 1668296147437
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         permissions:
 *           $ref: '#/components/schemas/userPermissions'
 *         librariesAccessible:
 *           description: The IDs of libraries accessible to the user. An empty array means all libraries are accessible.
 *           type: array
 *           items:
 *             type: string
 *             example: ...
 *         itemTagsAccessible:
 *           description: The tags accessible to the user. An empty array means all tags are accessible.
 *           type: array
 *           items:
 *             type: string
 *             example: ...
 *     userWithSession:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the user. Only the root user has the root ID.
 *           type: string
 *           example: root
 *         username:
 *           description: The username of the user.
 *           type: string
 *           example: root
 *         type:
 *           description: The type of the user. Will be root, guest, user, or admin. There will be only one root user which is created when the server first starts.
 *           type: string
 *           example: root
 *         session:
 *           $ref: '#/components/schemas/playbackSessionExpanded'
 *         lastSeen:
 *           description: The time (in ms since POSIX epoch) when the user was last seen by the server. Will be null if the user has never logged in.
 *           type: integer
 *           example: 1668296147437
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *     userPermissions:
 *       type: object
 *       properties:
 *         download:
 *           description: Whether the user can download items to the server.
 *           type: boolean
 *           example: true
 *         update:
 *           description: Whether the user can update library items.
 *           type: boolean
 *           example: true
 *         delete:
 *           description: Whether the user can delete library items.
 *           type: boolean
 *           example: true
 *         upload:
 *           description: Whether the user can upload items to the server.
 *           type: boolean
 *           example: true
 *         accessAllLibraries:
 *           description: Whether the user can access all libraries.
 *           type: boolean
 *           example: true
 *         accessAllTags:
 *           description: Whether the user can access all tags.
 *           type: boolean
 *           example: true
 *         accessExplicitContent:
 *           description: Whether the user can access explicit content.
 *           type: boolean
 *           example: true
 *     audioBookmark:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item the bookmark is for.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         title:
 *           description: The title of the bookmark.
 *           type: string
 *           example: the good part
 *         time:
 *           description: The time (in seconds) the bookmark is at in the book.
 *           type: integer
 *           example: 16
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 * 
 *     backup:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the backup. Will be the date and time when the backup was created.
 *           type: string
 *           example: 2022-11-14T0130
 *         backupMetadataCovers:
 *           description: Whether the backup includes library item covers and author images located in metadata.
 *           type: boolean
 *           example: true
 *         backupDirPath:
 *           description: The backup directory path.
 *           type: string
 *           example: /metadata/backups
 *         datePretty:
 *           description: The date and time when the backup was created in a human-readable format.
 *           type: string
 *           example: Mon, Nov 14 2022 01:30
 *         fullPath:
 *           description: The full path of the backup on the server.
 *           type: string
 *           example: /metadata/backups/2022-11-14T0130.audiobookshelf
 *         path:
 *           description: The path of the backup relative to the metadata directory.
 *           type: string
 *           example: backups/2022-11-14T0130.audiobookshelf
 *         filename:
 *           description: The filename of the backup.
 *           type: string
 *           example: 2022-11-14T0130.audiobookshelf
 *         fileSize:
 *           description: The size (in bytes) of the backup file.
 *           type: integer
 *           example: 7776983
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         serverVersion:
 *           description: The version of the server when the backup was created.
 *           type: string
 *           example: 2.2.4
 *     notificationSettings:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the notification settings.
 *           type: string
 *           example: notification-settings
 *         appriseType:
 *           description: The type of Apprise that will be used. At the moment, only api is available.
 *           type: [string, 'null']
 *           example: api
 *         appriseApiUrl:
 *           description: The full URL where the Apprise API to use is located.
 *           type: string
 *           example: https://apprise.example.com/notify
 *           format: url
 *         notifications:
 *           description: The set notifications.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/notification'
 *         maxFailedAttempts:
 *           description: The maximum number of times a notification fails before being disabled.
 *           type: integer
 *           example: 5
 *         maxNotificationQueue:
 *           description: The maximum number of notifications in the notification queue before events are ignored.
 *           type: integer
 *           example: 20
 *         notificationDelay:
 *           description: The time (in ms) between notification pushes.
 *           type: integer
 *           example: 1000
 *     notification:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the notification.
 *           type: string
 *           example: noti_nod281qwkj5ow7h7fi
 *         libraryId:
 *           description: The ID of the library the notification is associated with.
 *           type: [string, 'null']
 *         eventName:
 *           description: The name of the event the notification will fire on.
 *           type: string
 *           example: onPodcastEpisodeDownloaded
 *         urls:
 *           description: The Apprise URLs to use for the notification.
 *           type: array
 *           items:
 *             type: string
 *             example: apprises://apprise.example.com/email
 *         titleTemplate:
 *           description: The template for the notification title.
 *           type: string
 *           example: New {{podcastTitle}} Episode!
 *         bodyTemplate:
 *           description: The template for the notification body.
 *           type: string
 *           example: '{{episodeTitle}} has been added to {{libraryName}} library.'
 *         enabled:
 *           description: Whether the notification is enabled.
 *           type: boolean
 *           example: true
 *         type:
 *           description: The notification's type.
 *           type: string
 *           example: info
 *         lastFiredAt:
 *           description: The time (in ms since POSIX epoch) when the notification was last fired. Will be null if the notification has not fired.
 *           type: [integer, 'null']
 *           example: 1668776410792
 *         lastAttemptFailed:
 *           description: Whether the last notification attempt failed.
 *           type: boolean
 *           example: false
 *         numConsecutiveFailedAttempts:
 *           description: The number of consecutive times the notification has failed.
 *           type: integer
 *           example: 0
 *         numTimesFired:
 *           description: The number of times the notification has fired.
 *           type: integer
 *           example: 5
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *     notificationEvents:
 *       type: object
 *       properties:
 *         name:
 *           description: The name of the notification event.
 *           type: string
 *           example: onPodcastEpisodeDownloaded
 *         requiresLibrary:
 *           description: Whether the notification event depends on a library existing.
 *           type: boolean
 *           example: true
 *         libraryMediaType:
 *           description: The type of media of the library the notification depends on existing. Will not exist if requiresLibrary is false.
 *           type: [string, 'null']
 *           example: podcast
 *         description:
 *           description: The description of the notification event.
 *           type: string
 *           example: Triggered when a podcast episode is auto-downloaded
 *         variables:
 *           description: The variables of the notification event that can be used in the notification templates.
 *           type: array
 *           items:
 *             type: string
 *             example: libraryItemId
 *               - libraryId
 *               - libraryName
 *               - mediaTags
 *               - podcastTitle
 *               - podcastAuthor
 *               - podcastDescription
 *               - podcastGenres
 *               - episodeId
 *               - episodeTitle
 *               - episodeSubtitle
 *               - episodeDescription
 *         defaults:
 *           type: object
 *           properties:
 *             title:
 *               description: The default title template for notifications using the notification event.
 *               type: string
 *               example: New {{podcastTitle}} Episode!
 *             body:
 *               description: The default body template for notifications using the notification event.
 *               type: string
 *               example: '{{episodeTitle}} has been added to {{libraryName}} library.'
 *         testData:
 *           description: The keys of the testData object will match the list of variables. The values will be the data used when sending a test notification.
 *           type: object
 *           properties:
 *             libraryItemId:
 *               type: string
 *               example: li_notification_test
 *             libraryId:
 *               type: string
 *               example: lib_test
 *             libraryName:
 *               type: string
 *               example: Podcasts
 *             podcastTitle:
 *               type: string
 *               example: Abs Test Podcast
 *             episodeId:
 *               type: string
 *               example: ep_notification_test
 *             episodeTitle:
 *               type: string
 *               example: Successful Test
 * 
 *     serverSettings:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the server settings.
 *           type: string
 *           example: server-settings
 *         scannerFindCovers:
 *           description: Whether the scanner will attempt to find a cover if your audiobook does not have an embedded cover or a cover image inside the folder. Note that This will extend scan time.
 *           type: boolean
 *           example: false
 *         scannerCoverProvider:
 *           description: If scannerFindCovers is true, which metadata provider to use. See Metadata Providers for options.
 *           type: string
 *           example: google
 *         scannerParseSubtitle:
 *           description: Whether to extract subtitles from audiobook folder names. Subtitles must be separated by -, i.e. /audiobooks/Book Title - A Subtitle Here/ has the subtitle A Subtitle Here.
 *           type: boolean
 *           example: false
 *         scannerPreferAudioMetadata:
 *           description: Whether to use audio file ID3 meta tags instead of folder names for book details.
 *           type: boolean
 *           example: false
 *         scannerPreferOpfMetadata:
 *           description: Whether to use OPF file metadata instead of folder names for book details.
 *           type: boolean
 *           example: false
 *         scannerPreferMatchedMetadata:
 *           description: Whether matched data will override item details when using Quick Match. By default, Quick Match will only fill in missing details.
 *           type: boolean
 *           example: false
 *         scannerDisableWatcher:
 *           description: Whether to disable the automatic adding/updating of items when file changes are detected. Requires server restart for changes to take effect.
 *           type: boolean
 *           example: true
 *         scannerPreferOverdriveMediaMarker:
 *           description: Whether to use the custom metadata in MP3 files from Overdrive for chapter timings automatically.
 *           type: boolean
 *           example: false
 *         scannerUseTone:
 *           description: Should use tone to extract metadata
 *           type: boolean
 *           example: false
 *         storeCoverWithItem:
 *           description: Whether to store covers in the library item's folder. By default, covers are stored in /metadata/items. Only one file named cover will be kept.
 *           type: boolean
 *           example: false
 *         storeMetadataWithItem:
 *           description: Whether to store metadata files in the library item's folder. By default, metadata files are stored in /metadata/items. Uses the .abs file extension.
 *           type: boolean
 *           example: false
 *         metadataFileFormat:
 *           description: Must be either json or abs
 *           type: string
 *           example: json
 *         rateLimitLoginRequests:
 *           description: The maximum number of login requests per rateLimitLoginWindow.
 *           type: integer
 *           example: 10
 *         rateLimitLoginWindow:
 *           description: The length (in ms) of each login rate limit window.
 *           type: integer
 *           example: 600000
 *         backupSchedule:
 *           description: The cron expression for when to do automatic backups.
 *           type: string
 *           example: 30 1 * * *
 *         backupsToKeep:
 *           description: The number of backups to keep.
 *           type: integer
 *           example: 2
 *         maxBackupSize:
 *           description: The maximum backup size (in GB) before they fail, a safeguard against misconfiguration.
 *           type: integer
 *           example: 1
 *         backupMetadataCovers:
 *           description: Whether backups should include library item covers and author images located in metadata.
 *           type: boolean
 *           example: true
 *         loggerDailyLogsToKeep:
 *           description: The number of daily logs to keep.
 *           type: integer
 *           example: 7
 *         loggerScannerLogsToKeep:
 *           description: The number of scanner logs to keep.
 *           type: integer
 *           example: 2
 *         homeBookshelfView:
 *           description: Whether the home page should use a skeuomorphic design with wooden shelves.
 *           type: string
 *           example: 1
 *         bookshelfView:
 *           description: Whether other bookshelf pages should use a skeuomorphic design with wooden shelves.
 *           type: string
 *           example: 1
 *         sortingIgnorePrefix:
 *           description: Whether to ignore prefixes when sorting. For example, for the prefix the, the book title The Book Title would sort as Book Title, The.
 *           type: boolean
 *           example: false
 *         sortingPrefixes:
 *           description: If sortingIgnorePrefix is true, what prefixes to ignore.
 *           type: array
 *           items:
 *             type: string
 *             example: the
 *               - a
 *         chromecastEnabled:
 *           description: Whether to enable streaming to Chromecast devices.
 *           type: boolean
 *           example: false
 *         dateFormat:
 *           description: What date format to use. Options are MM/dd/yyyy, dd/MM/yyyy, dd.MM.yyyy, yyyy-MM-dd, MMM do, yyyy, MMMM do, yyyy, dd MMM yyyy, or dd MMMM yyyy.
 *           type: string
 *           example: MM/dd/yyyy
 *         timeFormat:
 *           description: What time format to use. Options are HH:mm (24-hour) and h:mma (am/pm).
 *           type: string
 *           example: HH:mm
 *         language:
 *           description: The default server language.
 *           type: string
 *           example: en-us
 *         logLevel:
 *           description: What log level the server should use when logging. 1 for debug, 2 for info, or 3 for warnings.
 *           type: integer
 *           example: 2
 *         version:
 *           description: The server's version.
 *           type: string
 *           example: 2.2.5
 *     rssFeed:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the RSS feed.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         slug:
 *           description: The slug (the last part of the URL) for the RSS feed.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         userId:
 *           description: The ID of the user that created the RSS feed.
 *           type: string
 *           example: root
 *         entityType:
 *           description: The type of entity the RSS feed is for.
 *           type: string
 *           example: item
 *         entityId:
 *           description: The ID of the entity the RSS feed is for.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         coverPath:
 *           description: The path of the cover to use for the RSS feed.
 *           type: string
 *           example: /metadata/items/li_bufnnmp4y5o2gbbxfm/cover.jpg
 *         serverAddress:
 *           description: The server's address.
 *           type: string
 *           example: https://abs.example.com
 *           format: url
 *         feedUrl:
 *           description: The full URL of the RSS feed.
 *           type: string
 *           example: https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         meta:
 *           $ref: '#/components/schemas/rssFeedMetadata'
 *         episodes:
 *           description: The RSS feed's episodes.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/rssFeedEpisode'
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the RSS feed was last updated.
 *           type: integer
 *           example: 1669031843179
 *     rssFeedMinified:
 *       type: [object, 'null']
 *       properties:
 *         id:
 *           description: The ID of the RSS feed.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         entityType:
 *           description: The type of entity the RSS feed is for.
 *           type: string
 *           example: item
 *         entityId:
 *           description: The ID of the entity the RSS feed is for.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         feedUrl:
 *           description: The full URL of the RSS feed.
 *           type: string
 *           example: https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         meta:
 *           $ref: '#/components/schemas/rssFeedMetadataMinified'
 *     rssFeedMetadata:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the entity the RSS feed is for.
 *           type: string
 *           example: Welcome to Night Vale
 *         description:
 *           description: The description of the entity the RSS feed is for.
 *           type: [string, 'null']
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         author:
 *           description: The author of the entity the RSS feed is for.
 *           type: [string, 'null']
 *           example: Night Vale Presents
 *         imageUrl:
 *           description: The URL of the RSS feed's image.
 *           type: string
 *           example: https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm/cover
 *           format: url
 *         feedUrl:
 *           description: The URL of the RSS feed.
 *           type: string
 *           example: https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         link:
 *           description: The URL of the entity the RSS feed is for.
 *           type: string
 *           example: https://abs.example.com/item/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         explicit:
 *           description: Whether the RSS feed's contents are explicit.
 *           type: boolean
 *           example: false
 *         type:
 *           description: The type of the RSS feed.
 *           type: [string, 'null']
 *           example: episodic
 *         language:
 *           description: The language of the RSS feed.
 *           type: [string, 'null']
 *           example: en
 *         preventIndexing:
 *           description: Whether the RSS feed is marked to prevent indexing of the feed.
 *           type: boolean
 *           example: true
 *         ownerName:
 *           description: The owner name of the RSS feed.
 *           type: [string, 'null']
 *         ownerEmail:
 *           description: The owner email of the RSS feed.
 *           type: [string, 'null']
 *     rssFeedMetadataMinified:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the entity the RSS feed is for.
 *           type: string
 *           example: Welcome to Night Vale
 *         description:
 *           description: The description of the entity the RSS feed is for.
 *           type: [string, 'null']
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         preventIndexing:
 *           description: Whether the RSS feed is marked to prevent indexing of the feed.
 *           type: boolean
 *           example: true
 *         ownerName:
 *           description: The owner name of the RSS feed.
 *           type: [string, 'null']
 *         ownerEmail:
 *           description: The owner email of the RSS feed.
 *           type: [string, 'null']
 *     rssFeedEpisode:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the RSS feed episode.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         title:
 *           description: The title of the RSS feed episode.
 *           type: string
 *           example: Pilot
 *         description:
 *           description: An HTML encoded description of the RSS feed episode.
 *           type: string
 *           example: >-
 *               <div><br>Pilot Episode. A new dog park opens in Night Vale. Carlos, a
 *               scientist, visits and discovers some interesting things. Seismic things.
 *               Plus, a helpful guide to surveillance
 *               helicopter-spotting.<br><br></div><div><br>Weather: "These and More Than
 *               These" by Joseph Fink<br><br></div><div><br>Music: Disparition,
 *               disparition.info<br><br></div><div><br>Logo: Rob Wilson,
 *               silastom.com<br><br></div><div><br>Produced by Night Vale Presents.
 *               Written by Joseph Fink and Jeffrey Cranor. Narrated by Cecil Baldwin.
 *               More Info: welcometonightvale.com, and follow @NightValeRadio on Twitter
 *               or Facebook.<br><br></div>
 *         enclosure:
 *           description: Download information for the RSS feed episode. (Similar to Podcast Episode Enclosure)
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *               example: >-
 *                   https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm/item/ep_lh6ko39pumnrma3dhv/1
 *                   - Pilot.mp3
 *             type:
 *               type: string
 *               example: audio/mpeg
 *             size:
 *               type: integer
 *               example: 23653735
 *         pubDate:
 *           description: The RSS feed episode's publication date.
 *           type: string
 *           example: Fri, 15 Jun 2012 12:00:00 -0000
 *         link:
 *           description: A URL to display to the RSS feed user.
 *           type: string
 *           example: https://abs.example.com/item/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         author:
 *           description: The author of the RSS feed episode.
 *           type: string
 *           example: Night Vale Presents
 *         explicit:
 *           description: Whether the RSS feed episode is explicit.
 *           type: boolean
 *           example: false
 *         duration:
 *           description: The duration (in seconds) of the RSS feed episode.
 *           type: number
 *           example: 1454.18449
 *         season:
 *           description: The season of the RSS feed episode.
 *           type: [string, 'null']
 *         episode:
 *           description: The episode number of the RSS feed episode.
 *           type: [string, 'null']
 *         episodeType:
 *           description: The type of the RSS feed episode.
 *           type: [string, 'null']
 *         libraryItemId:
 *           description: The ID of the library item the RSS feed is for.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode the RSS feed episode is for. Will be null if the RSS feed is for a book.
 *           type: [string, 'null']
 *           example: ep_lh6ko39pumnrma3dhv
 *         trackIndex:
 *           description: The RSS feed episode's track index.
 *           type: integer
 *           example: 0
 *         fullPath:
 *           description: The path on the server of the audio file the RSS feed episode is for.
 *           type: string
 *           example: /podcasts/Welcome to Night Vale/1 - Pilot.mp3
 *     stream:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the stream. It will be the same as the ID of the playback session that the stream is for.
 *           type: string
 *           example: play_c786zm3qtjz6bd5q3n
 *         userId:
 *           description: The ID of the user that started the stream.
 *           type: string
 *           example: root
 *         libraryItem:
 *           $ref: '#/components/schemas/libraryItemExpanded'
 *         episode:
 *           $ref: '#/components/schemas/podcastEpisodeExpanded'
 *         segmentLength:
 *           description: The length (in seconds) of each segment of the stream.
 *           type: integer
 *           example: 6
 *         playlistPath:
 *           description: The path on the server of the stream output.
 *           type: string
 *           example: /metadata/streams/play_c786zm3qtjz6bd5q3n/output.m3u8
 *         clientPlaylistUri:
 *           description: The URI path for the client to access the stream.
 *           type: string
 *           example: /hls/play_c786zm3qtjz6bd5q3n/output.m3u8
 *         startTime:
 *           description: The time (in seconds) where the playback session started.
 *           type: integer
 *           example: 0
 *         segmentStartNumber:
 *           description: The segment where the transcoding began.
 *           type: integer
 *           example: 0
 *         isTranscodeComplete:
 *           description: Whether transcoding is complete.
 *           type: boolean
 *           example: false 
 *     streamProgress:
 *       type: object
 *       properties:
 *         stream:
 *           description: The ID of the stream the progress is for.
 *           type: string
 *           example: play_c786zm3qtjz6bd5q3n
 *         percent:
 *           description: A human-readable percentage of transcode completion.
 *           type: string
 *           example: 8.66% 
 *         chunks:
 *           description: The segment ranges that have been transcoded.
 *           type: array
 *           items:
 *             type: string
 *             example: 0-536 
 *         numSegments:
 *           description: The total number of segments of the stream.
 *           type: integer
 *           example: 6200 
 */ 