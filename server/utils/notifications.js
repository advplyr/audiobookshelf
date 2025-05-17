const { version } = require('../../package.json')
const LibraryItem = require('../models/LibraryItem')

const libraryItemVariables = [
  'id',
  'ino',
  'oldLibraryItemId',
  'libraryId',
  'folderId',
  'path',
  'relPath',
  'isFile',
  'mtimeMs',
  'ctimeMs',
  'birthtimeMs',
  'addedAt',
  'updatedAt',
  'isMissing',
  'isInvalid',
  'mediaType',
  'media.id',
  'media.metadata.title',
  'media.metadata.titleIgnorePrefix',
  'media.metadata.subtitle',
  'media.metadata.authorName',
  'media.metadata.authorNameLF',
  'media.metadata.narratorName',
  'media.metadata.seriesName',
  'media.metadata.genres',
  'media.metadata.publishedYear',
  'media.metadata.publishedDate',
  'media.metadata.publisher',
  'media.metadata.description',
  'media.metadata.isbn',
  'media.metadata.asin',
  'media.metadata.language',
  'media.metadata.explicit',
  'media.metadata.abridged',
  'media.coverPath',
  'media.tags',
  'media.numTracks',
  'media.numAudioFiles',
  'media.numChapters',
  'media.duration',
  'media.size',
  'media.ebookFormat',
  'numFiles',
  'size'
]

const libraryItemTestData = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  ino: '9876543',
  path: '/audiobooks/Frank Herbert/Dune',
  relPath: 'Frank Herbert/Dune',
  mediaId: 'abcdef12-3456-7890-abcd-ef1234567890',
  mediaType: 'book',
  isFile: true,
  isMissing: false,
  isInvalid: false,
  mtime: new Date('2023-11-15T10:20:30.400Z'),
  ctime: new Date('2023-11-15T10:20:30.400Z'),
  birthtime: new Date('2023-11-15T10:20:30.390Z'),
  size: 987654321,
  lastScan: new Date('2024-01-10T08:15:00.000Z'),
  lastScanVersion: '3.2.0',
  title: 'Dune',
  titleIgnorePrefix: 'Dune',
  authorNamesFirstLast: 'Frank Herbert',
  authorNamesLastFirst: 'Herbert, Frank',
  createdAt: new Date('2023-11-15T10:21:00.000Z'),
  updatedAt: new Date('2024-05-15T18:30:36.940Z'),
  libraryId: 'fedcba98-7654-3210-fedc-ba9876543210',
  libraryFolderId: '11223344-5566-7788-99aa-bbccddeeff00'
};



module.exports.notificationData = {
  events: [
    {
      name: 'onPodcastEpisodeDownloaded',
      requiresLibrary: true,
      libraryMediaType: 'podcast',
      description: 'Triggered when a podcast episode is auto-downloaded',
      descriptionKey: 'NotificationOnEpisodeDownloadedDescription',
      variables: ['libraryItemId', 'libraryId', 'podcastTitle', 'podcastAuthor', 'podcastDescription', 'podcastGenres', 'episodeTitle', 'episodeSubtitle', 'episodeDescription', 'libraryName', 'episodeId', 'mediaTags'],
      defaults: {
        title: 'New {{podcastTitle}} Episode!',
        body: '{{episodeTitle}} has been added to {{libraryName}} library.'
      },
      testData: {
        libraryItemId: 'li_notification_test',
        libraryId: 'lib_test',
        libraryName: 'Podcasts',
        mediaTags: 'TestTag1, TestTag2',
        podcastTitle: 'Abs Test Podcast',
        podcastAuthor: 'Audiobookshelf',
        podcastDescription: 'Description of the Abs Test Podcast belongs here.',
        podcastGenres: 'TestGenre1, TestGenre2',
        episodeId: 'ep_notification_test',
        episodeTitle: 'Successful Test Episode',
        episodeSubtitle: 'Episode Subtitle',
        episodeDescription: 'Some description of the podcast episode.'
      }
    },
    {
      name: 'onBackupCompleted',
      requiresLibrary: false,
      description: 'Triggered when a backup is completed',
      descriptionKey: 'NotificationOnBackupCompletedDescription',
      variables: ['completionTime', 'backupPath', 'backupSize', 'backupCount', 'removedOldest'],
      defaults: {
        title: 'Backup Completed',
        body: 'Backup has been completed successfully.\n\nPath: {{backupPath}}\nSize: {{backupSize}} bytes\nCount: {{backupCount}}\nRemoved Oldest: {{removedOldest}}'
      },
      testData: {
        completionTime: '12:00 AM',
        backupPath: 'path/to/backup',
        backupSize: '1.23 MB',
        backupCount: '1',
        removedOldest: 'false'
      }
    },
    {
      name: 'onBackupFailed',
      requiresLibrary: false,
      description: 'Triggered when a backup fails',
      descriptionKey: 'NotificationOnBackupFailedDescription',
      variables: ['errorMsg'],
      defaults: {
        title: 'Backup Failed',
        body: 'Backup failed, check ABS logs for more information.\nError message: {{errorMsg}}'
      },
      testData: {
        errorMsg: 'Example error message'
      }
    },
    // Sockets - Silently crying because not using typescript

    {
      name: 'onItemAdded',
      requiresLibrary: true,
      description: 'Triggered when an item is added',
      descriptionKey: 'NotificationOnItemAddedDescription',
      variables: libraryItemVariables,
      defaults: {
        title: 'Item Added: {{media.metadata.title}}',
        body: 'Item {{media.metadata.title}} has been added.\n\nPath: {{path}}\nSize: {{size}} bytes\nLibrary ID: {{libraryId}}'
      },
      testData: libraryItemTestData
    },
    {
      name: 'onItemUpdated',
      requiresLibrary: true,
      description: 'Triggered when an item is updated',
      descriptionKey: 'NotificationOnItemUpdatedDescription',
      variables: libraryItemVariables,
      defaults: {
        title: 'Item Updated: {{media.metadata.title}}',
        body: 'Item {{media.metadata.title}} has been added.\n\nPath: {{path}}\nSize: {{size}} bytes\nLibrary ID: {{libraryId}}'
      },
      testData: libraryItemTestData
    },
    {
      name: 'onUserOnline',
      requiresLibrary: false,
      description: 'Triggered when a user comes online',
      descriptionKey: 'NotificationOnUserOnlineDescription',
      variables: [ 'id', 'username', 'type', 'session', 'lastSeen', 'createdAt'],
      defaults: {
        title: 'User Online: {{username}}',
        body: 'User {{username}} (ID: {{id}}) is now online.'
      },
    },

    // Test
    {
      name: 'onTest',
      requiresLibrary: false,
      description: 'Event for testing the notification system',
      descriptionKey: 'NotificationOnTestDescription',
      variables: ['version'],
      defaults: {
        title: 'Test Notification on Abs {{version}}',
        body: 'Test notificataion body for abs {{version}}.'
      },
      testData: {
        version: 'v' + version
      }
    }
  ]
}
