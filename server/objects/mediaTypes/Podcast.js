const Logger = require('../../Logger')
const PodcastEpisode = require('../entities/PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')
const { filePathToPOSIX } = require('../../utils/fileUtils')

/**
 * @openapi
 * components:
 *   schemas:
 *     podcastBase:
 *       type: object
 *       properties:
 *         coverPath:
 *           description: The absolute path on the server of the cover file. Will be null if there is no cover.
 *           type: [string, 'null']
 *           example: /podcasts/Welcome to Night Vale/cover.jpg
 *         tags:
 *           $ref: '#/components/schemas/tags'
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
 *     podcast:
 *       type: object
 *       description: A podcast on the server
 *       allOf:
 *         - $ref: '#/components/schemas/podcastBase'
 *         - type: object
 *           properties:
 *             libraryItemId:
 *               $ref: '#/components/schemas/libraryItemId'
 *             metadata:
 *               $ref: '#/components/schemas/podcastMetadata'
 *             episodes:
 *               description: The downloaded episodes of the podcast.
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/podcastEpisode'
 *     podcastMinified:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/podcastMetadataMinified'
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
 */
class Podcast {
  constructor(podcast) {
    this.id = null
    this.libraryItemId = null
    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.episodes = []

    this.autoDownloadEpisodes = false
    this.autoDownloadSchedule = null
    this.lastEpisodeCheck = 0
    this.maxEpisodesToKeep = 0
    this.maxNewEpisodesToDownload = 3

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

    if (podcast) {
      this.construct(podcast)
    }
  }

  construct(podcast) {
    this.id = podcast.id
    this.libraryItemId = podcast.libraryItemId
    this.metadata = new PodcastMetadata(podcast.metadata)
    this.coverPath = podcast.coverPath
    this.tags = [...podcast.tags]
    this.episodes = podcast.episodes.map((e) => {
      var podcastEpisode = new PodcastEpisode(e)
      podcastEpisode.libraryItemId = this.libraryItemId
      return podcastEpisode
    })
    this.autoDownloadEpisodes = !!podcast.autoDownloadEpisodes
    this.autoDownloadSchedule = podcast.autoDownloadSchedule || '0 * * * *' // Added in 2.1.3 so default to hourly
    this.lastEpisodeCheck = podcast.lastEpisodeCheck || 0
    this.maxEpisodesToKeep = podcast.maxEpisodesToKeep || 0
    this.maxNewEpisodesToDownload = podcast.maxNewEpisodesToDownload || 3
  }

  toJSON() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      metadata: this.metadata.toJSONMinified(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      numEpisodes: this.episodes.length,
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSONExpanded()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }

  toJSONForMetadataFile() {
    return {
      tags: [...this.tags],
      title: this.metadata.title,
      author: this.metadata.author,
      description: this.metadata.description,
      releaseDate: this.metadata.releaseDate,
      genres: [...this.metadata.genres],
      feedURL: this.metadata.feedUrl,
      imageURL: this.metadata.imageUrl,
      itunesPageURL: this.metadata.itunesPageUrl,
      itunesId: this.metadata.itunesId,
      itunesArtistId: this.metadata.itunesArtistId,
      explicit: this.metadata.explicit,
      language: this.metadata.language,
      podcastType: this.metadata.type
    }
  }

  get size() {
    var total = 0
    this.episodes.forEach((ep) => total += ep.size)
    return total
  }
  get hasMediaEntities() {
    return !!this.episodes.length
  }
  get duration() {
    let total = 0
    this.episodes.forEach((ep) => total += ep.duration)
    return total
  }
  get numTracks() {
    return this.episodes.length
  }
  get latestEpisodePublished() {
    var largestPublishedAt = 0
    this.episodes.forEach((ep) => {
      if (ep.publishedAt && ep.publishedAt > largestPublishedAt) {
        largestPublishedAt = ep.publishedAt
      }
    })
    return largestPublishedAt
  }
  get episodesWithPubDate() {
    return this.episodes.filter(ep => !!ep.publishedAt)
  }

  update(payload) {
    var json = this.toJSON()
    delete json.episodes // do not update media entities here
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (key === 'metadata') {
          if (this.metadata.update(payload.metadata)) {
            hasUpdates = true
          }
        } else if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[Podcast] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  updateEpisode(id, payload) {
    var episode = this.episodes.find(ep => ep.id == id)
    if (!episode) return false
    return episode.update(payload)
  }

  updateCover(coverPath) {
    coverPath = filePathToPOSIX(coverPath)
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  removeFileWithInode(inode) {
    const hasEpisode = this.episodes.some(ep => ep.audioFile.ino === inode)
    if (hasEpisode) {
      this.episodes = this.episodes.filter(ep => ep.audioFile.ino !== inode)
    }
    return hasEpisode
  }

  findFileWithInode(inode) {
    var episode = this.episodes.find(ep => ep.audioFile.ino === inode)
    if (episode) return episode.audioFile
    return null
  }

  setData(mediaData) {
    this.metadata = new PodcastMetadata()
    if (mediaData.metadata) {
      this.metadata.setData(mediaData.metadata)
    }

    this.coverPath = mediaData.coverPath || null
    this.autoDownloadEpisodes = !!mediaData.autoDownloadEpisodes
    this.autoDownloadSchedule = mediaData.autoDownloadSchedule || global.ServerSettings.podcastEpisodeSchedule
    this.lastEpisodeCheck = Date.now() // Makes sure new episodes are after this
  }

  checkHasEpisode(episodeId) {
    return this.episodes.some(ep => ep.id === episodeId)
  }
  checkHasEpisodeByFeedUrl(url) {
    return this.episodes.some(ep => ep.checkEqualsEnclosureUrl(url))
  }

  // Only checks container format
  checkCanDirectPlay(payload, episodeId) {
    var episode = this.episodes.find(ep => ep.id === episodeId)
    if (!episode) return false
    return episode.checkCanDirectPlay(payload)
  }

  getDirectPlayTracklist(episodeId) {
    var episode = this.episodes.find(ep => ep.id === episodeId)
    if (!episode) return false
    return episode.getDirectPlayTracklist()
  }

  addPodcastEpisode(podcastEpisode) {
    this.episodes.push(podcastEpisode)
  }

  addNewEpisodeFromAudioFile(audioFile, index) {
    const pe = new PodcastEpisode()
    pe.libraryItemId = this.libraryItemId
    pe.podcastId = this.id
    audioFile.index = 1 // Only 1 audio file per episode
    pe.setDataFromAudioFile(audioFile, index)
    this.episodes.push(pe)
  }

  removeEpisode(episodeId) {
    const episode = this.episodes.find(ep => ep.id === episodeId)
    if (episode) {
      this.episodes = this.episodes.filter(ep => ep.id !== episodeId)
    }
    return episode
  }

  getPlaybackTitle(episodeId) {
    var episode = this.episodes.find(ep => ep.id == episodeId)
    if (!episode) return this.metadata.title
    return episode.title
  }

  getPlaybackAuthor() {
    return this.metadata.author
  }

  getEpisodeDuration(episodeId) {
    var episode = this.episodes.find(ep => ep.id == episodeId)
    if (!episode) return 0
    return episode.duration
  }

  getEpisode(episodeId) {
    if (!episodeId) return null

    // Support old episode ids for mobile downloads
    if (episodeId.startsWith('ep_')) return this.episodes.find(ep => ep.oldEpisodeId == episodeId)

    return this.episodes.find(ep => ep.id == episodeId)
  }

  getChapters(episodeId) {
    return this.getEpisode(episodeId)?.chapters?.map(ch => ({ ...ch })) || []
  }
}
module.exports = Podcast
