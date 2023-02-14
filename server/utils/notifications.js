const { version } = require('../../package.json')

module.exports.notificationData = {
  events: [
    {
      name: 'onPodcastEpisodeDownloaded',
      requiresLibrary: true,
      libraryMediaType: 'podcast',
      description: 'Triggered when a podcast episode is auto-downloaded',
      variables: ['libraryItemId', 'libraryId', 'podcastTitle', 'episodeTitle', 'libraryName', 'episodeId', 'libraryTags'],
      defaults: {
        title: 'New {{podcastTitle}} Episode!',
        body: '{{episodeTitle}} has been added to {{libraryName}} library.'
      },
      testData: {
        libraryItemId: 'li_notification_test',
        libraryId: 'lib_test',
        libraryName: 'Podcasts',
        libraryTags: ['TestTag1', 'TestTag2'],
        podcastTitle: 'Abs Test Podcast',
        episodeId: 'ep_notification_test',
        episodeTitle: 'Successful Test'
      }
    },
    {
      name: 'onTest',
      requiresLibrary: false,
      description: 'Event for testing the notification system',
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
