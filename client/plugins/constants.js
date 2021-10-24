const DownloadStatus = {
  PENDING: 0,
  READY: 1,
  EXPIRED: 2,
  FAILED: 3
}

const CoverDestination = {
  METADATA: 0,
  AUDIOBOOK: 1
}

const Constants = {
  DownloadStatus,
  CoverDestination
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

export default ({ app }, inject) => {
  inject('constants', Constants)
  inject('keynames', KeyNames)
  inject('hotkeys', Hotkeys)
}