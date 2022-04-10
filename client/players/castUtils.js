
function getMediaInfoFromTrack(libraryItem, castImage, track) {
  // https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.media.AudiobookChapterMediaMetadata
  var metadata = new chrome.cast.media.AudiobookChapterMediaMetadata()
  metadata.bookTitle = libraryItem.media.metadata.title
  metadata.chapterNumber = track.index
  metadata.chapterTitle = track.title
  metadata.images = [castImage]
  metadata.title = track.title
  metadata.subtitle = libraryItem.media.metadata.title

  var trackurl = track.fullContentUrl
  var mimeType = track.mimeType
  var mediainfo = new chrome.cast.media.MediaInfo(trackurl, mimeType)
  mediainfo.metadata = metadata
  mediainfo.itemId = track.index
  mediainfo.duration = track.duration
  return mediainfo
}

function buildCastMediaInfo(libraryItem, coverUrl, tracks) {
  const castImage = new chrome.cast.Image(coverUrl)
  return tracks.map(t => getMediaInfoFromTrack(libraryItem, castImage, t))
}

function buildCastQueueRequest(libraryItem, coverUrl, tracks, startTime) {
  var mediaInfoItems = buildCastMediaInfo(libraryItem, coverUrl, tracks)

  var containerMetadata = new chrome.cast.media.AudiobookContainerMetadata()
  containerMetadata.authors = libraryItem.media.metadata.authors.map(a => a.name)
  containerMetadata.narrators = libraryItem.media.metadata.narrators || []
  containerMetadata.publisher = libraryItem.media.metadata.publisher || undefined
  containerMetadata.title = libraryItem.media.metadata.title

  var mediaQueueItems = mediaInfoItems.map((mi) => {
    var queueItem = new chrome.cast.media.QueueItem(mi)
    return queueItem
  })

  // Find track to start playback and calculate track start offset
  var track = tracks.find(at => at.startOffset <= startTime && at.startOffset + at.duration > startTime)
  var trackStartIndex = track ? track.index - 1 : 0
  var trackStartTime = Math.floor(track ? startTime - track.startOffset : 0)

  var queueData = new chrome.cast.media.QueueData(libraryItem.id, libraryItem.media.metadata.title, '', false, mediaQueueItems, trackStartIndex, trackStartTime)
  queueData.containerMetadata = containerMetadata
  queueData.queueType = chrome.cast.media.QueueType.AUDIOBOOK
  return queueData
}

function castLoadMedia(castSession, request) {
  return new Promise((resolve) => {
    castSession.loadMedia(request)
      .then(() => resolve(true), (reason) => {
        console.error('Load media failed', reason)
        resolve(false)
      })
  })
}

function buildCastLoadRequest(libraryItem, coverUrl, tracks, startTime, autoplay, playbackRate) {
  var request = new chrome.cast.media.LoadRequest()

  request.queueData = buildCastQueueRequest(libraryItem, coverUrl, tracks, startTime)
  request.currentTime = request.queueData.startTime

  request.autoplay = autoplay
  request.playbackRate = playbackRate
  return request
}

export {
  buildCastLoadRequest,
  castLoadMedia
}