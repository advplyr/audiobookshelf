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

export default ({ app }, inject) => {
  inject('constants', Constants)
}