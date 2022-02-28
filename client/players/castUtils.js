
function getMediaInfoFromTrack(audiobook, castImage, track) {
  // https://developers.google.com/cast/docs/reference/web_sender/chrome.cast.media.AudiobookChapterMediaMetadata
  var metadata = new chrome.cast.media.AudiobookChapterMediaMetadata()
  metadata.bookTitle = audiobook.book.title
  metadata.chapterNumber = track.index
  metadata.chapterTitle = track.title
  metadata.images = [castImage]
  metadata.title = track.title
  metadata.subtitle = audiobook.book.title

  var trackurl = track.fullContentUrl
  var mimeType = track.mimeType
  var mediainfo = new chrome.cast.media.MediaInfo(trackurl, mimeType)
  mediainfo.metadata = metadata
  mediainfo.itemId = track.index
  mediainfo.duration = track.duration
  return mediainfo
}

function buildCastMediaInfo(audiobook, coverUrl, tracks) {
  const castImage = new chrome.cast.Image(coverUrl)
  return tracks.map(t => getMediaInfoFromTrack(audiobook, castImage, t))
}

function buildCastQueueRequest(audiobook, coverUrl, tracks, startTime) {
  var mediaInfoItems = buildCastMediaInfo(audiobook, coverUrl, tracks)

  var containerMetadata = new chrome.cast.media.AudiobookContainerMetadata()
  containerMetadata.authors = [audiobook.book.authorFL]
  containerMetadata.narrators = [audiobook.book.narratorFL]
  containerMetadata.publisher = audiobook.book.publisher || undefined

  var mediaQueueItems = mediaInfoItems.map((mi) => {
    var queueItem = new chrome.cast.media.QueueItem(mi)
    return queueItem
  })

  // Find track to start playback and calculate track start offset
  var track = tracks.find(at => at.startOffset <= startTime && at.startOffset + at.duration > startTime)
  var trackStartIndex = track ? track.index - 1 : 0
  var trackStartTime = Math.floor(track ? startTime - track.startOffset : 0)

  var queueData = new chrome.cast.media.QueueData(audiobook.id, audiobook.book.title, '', false, mediaQueueItems, trackStartIndex, trackStartTime)
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

function buildCastLoadRequest(audiobook, coverUrl, tracks, startTime, autoplay, playbackRate) {
  var request = new chrome.cast.media.LoadRequest()

  request.queueData = buildCastQueueRequest(audiobook, coverUrl, tracks, startTime)
  request.currentTime = request.queueData.startTime

  request.autoplay = autoplay
  request.playbackRate = playbackRate
  return request
}

export {
  buildCastLoadRequest,
  castLoadMedia
}