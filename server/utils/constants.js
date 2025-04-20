module.exports.ScanResult = {
  NOTHING: 0,
  ADDED: 1,
  UPDATED: 2,
  REMOVED: 3,
  UPTODATE: 4
}

module.exports.BookCoverAspectRatio = {
  STANDARD: 0, // 1.6:1
  SQUARE: 1
}

module.exports.BookshelfView = {
  STANDARD: 0,
  DETAIL: 1
}

module.exports.LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
  NOTE: 6
}

module.exports.PlayMethod = {
  DIRECTPLAY: 0,
  DIRECTSTREAM: 1,
  TRANSCODE: 2,
  LOCAL: 3
}

module.exports.AudioMimeType = {
  MP3: 'audio/mpeg',
  M4B: 'audio/mp4',
  M4A: 'audio/mp4',
  MP4: 'audio/mp4',
  OGG: 'audio/ogg',
  OGA: 'audio/ogg',
  OPUS: 'audio/ogg',
  AAC: 'audio/aac',
  FLAC: 'audio/flac',
  WMA: 'audio/x-ms-wma',
  AIFF: 'audio/x-aiff',
  AIF: 'audio/x-aiff',
  WEBM: 'audio/webm',
  WEBMA: 'audio/webm',
  MKA: 'audio/x-matroska',
  AWB: 'audio/amr-wb',
  CAF: 'audio/x-caf',
  MPEG: 'audio/mpeg',
  MPG: 'audio/mpeg'
}
