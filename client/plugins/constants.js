const DownloadStatus = {
  PENDING: 0,
  READY: 1,
  EXPIRED: 2,
  FAILED: 3
}

const Constants = {
  DownloadStatus
}

export default ({ app }, inject) => {
  inject('constants', Constants)
}