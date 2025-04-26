const SupportedFileTypes = {
  image: ['png', 'jpg', 'jpeg', 'webp'],
  audio: ['m4b', 'mp3', 'm4a', 'flac', 'opus', 'ogg', 'oga', 'mp4', 'aac', 'wma', 'aiff', 'aif','wav', 'webm', 'webma', 'mka', 'awb', 'caf', 'mpeg', 'mpg'],
  ebook: ['epub', 'pdf', 'mobi', 'azw3', 'cbr', 'cbz'],
  info: ['nfo'],
  text: ['txt'],
  metadata: ['opf', 'abs', 'xml', 'json']
}

const DownloadStatus = {
  PENDING: 0,
  READY: 1,
  EXPIRED: 2,
  FAILED: 3
}

const BookCoverAspectRatio = {
  STANDARD: 0,
  SQUARE: 1
}

const BookshelfView = {
  STANDARD: 0,
  DETAIL: 1,
  AUTHOR: 2 // Books shown on author page
}

const PlayMethod = {
  DIRECTPLAY: 0,
  DIRECTSTREAM: 1,
  TRANSCODE: 2,
  LOCAL: 3
}

const SleepTimerTypes = {
  COUNTDOWN: 'countdown',
  CHAPTER: 'chapter'
}

const Constants = {
  SupportedFileTypes,
  DownloadStatus,
  BookCoverAspectRatio,
  BookshelfView,
  PlayMethod,
  SleepTimerTypes
}

const KeyNames = {
  27: 'Escape',
  32: 'Space',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  76: 'KeyL',
  77: 'KeyM'
}
const Hotkeys = {
  AudioPlayer: {
    PLAY_PAUSE: 'Space',
    JUMP_FORWARD: 'ArrowRight',
    JUMP_BACKWARD: 'ArrowLeft',
    VOLUME_UP: 'ArrowUp',
    VOLUME_DOWN: 'ArrowDown',
    MUTE_UNMUTE: 'KeyM',
    SHOW_CHAPTERS: 'KeyL',
    INCREASE_PLAYBACK_RATE: 'Shift-ArrowUp',
    DECREASE_PLAYBACK_RATE: 'Shift-ArrowDown',
    CLOSE: 'Escape'
  },
  EReader: {
    NEXT_PAGE: 'ArrowRight',
    PREV_PAGE: 'ArrowLeft',
    CLOSE: 'Escape'
  },
  Modal: {
    NEXT_PAGE: 'ArrowRight',
    PREV_PAGE: 'ArrowLeft',
    CLOSE: 'Escape'
  }
}

export { Constants }
export default ({ app }, inject) => {
  inject('constants', Constants)
  inject('keynames', KeyNames)
  inject('hotkeys', Hotkeys)
}
