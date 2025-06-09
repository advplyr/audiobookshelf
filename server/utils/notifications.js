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
      name: 'onRSSFeedFailed',
      requiresLibrary: true,
      description: 'Triggered when the RSS feed request fails for an automatic episode download',
      descriptionKey: 'NotificationOnRSSFeedFailedDescription',
      variables: ['feedUrl', 'numFailed', 'title'],
      defaults: {
        title: 'RSS Feed Request Failed',
        body: 'Failed to request RSS feed for {{title}}.\nFeed URL: {{feedUrl}}\nNumber of failed attempts: {{numFailed}}'
      },
      testData: {
        title: 'Test RSS Feed',
        feedUrl: 'https://example.com/rss',
        numFailed: 3
      }
    },
    {
      name: 'onRSSFeedDisabled',
      requiresLibrary: true,
      description: 'Triggered when automatic episode downloads are disabled due to too many failed attempts',
      descriptionKey: 'NotificationOnRSSFeedDisabledDescription',
      variables: ['feedUrl', 'numFailed', 'title'],
      defaults: {
        title: 'Podcast Episode Download Schedule Disabled',
        body: 'Automatic episode downloads for {{title}} have been disabled due to too many failed RSS feed requests.\nFeed URL: {{feedUrl}}\nNumber of failed attempts: {{numFailed}}'
      },
      testData: {
        title: 'Test RSS Feed',
        feedUrl: 'https://example.com/rss',
        numFailed: 5
      }
    },
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
