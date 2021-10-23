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

export default ({ app }, inject) => {
  inject('constants', Constants)
  inject('keynames', KeyNames)
}