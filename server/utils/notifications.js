const { version } = require('../../package.json')

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
    {
      name: 'onLibraryItemAdded',
      requiresLibrary: true,
      description: 'Triggered when a new item is added to a library',
      descriptionKey: 'NotificationOnLibraryItemAddedDescription',
      variables: ['itemTitle', 'itemAuthor', 'mediaType'],
      defaults: {
        title: 'New {{mediaType}} Added!',
        body: '{{itemTitle}} by {{itemAuthor}} has been added to one of your libraries.'
      },
      testData: {
        itemTitle: 'Test Item',
        itemAuthor: 'Test Author',
        mediaType: 'Book'
      }
    },
    {
      name: 'onTest',
      requiresLibrary: false,
      description: 'Event for testing the notification system',
      descriptionKey: 'NotificationOnTestDescription',
      variables: ['version'],
      defaults: {
        title: 'New Book Added!',
        body: '{{bookTitle}} by {{bookAuthor}} has been added to {{libraryName}} library.'
      },
      testData: {
        libraryItemId: 'li_notification_test',
        libraryId: 'lib_test',
        libraryName: 'Audiobooks',
        mediaTags: 'TestTag1, TestTag2',
        bookTitle: 'Test Book',
        bookAuthor: 'Test Author',
        bookDescription: 'Description of the test book.',
        bookGenres: 'TestGenre1, TestGenre2',
        bookNarrator: 'Test Narrator'
      }
    }
  ]
}
