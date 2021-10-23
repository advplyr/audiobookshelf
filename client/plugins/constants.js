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

const Hotkeys = {
  PLAY_PAUSE: 32, // Space
  JUMP_FORWARD: 39, // ArrowRight
  JUMP_BACKWARD: 37, // ArrowLeft
  CLOSE: 27, // ESCAPE
  VOLUME_UP: 38, // ArrowUp
  VOLUME_DOWN: 40, // ArrowDown
  MUTE: 77, // M
}

export default ({ app }, inject) => {
  inject('constants', Constants)
  inject('hotkeys', Hotkeys)
}