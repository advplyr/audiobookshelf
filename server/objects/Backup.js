const Path = require('path')
const date = require('date-and-time')

class Backup {
  constructor(data = null) {
    this.id = null
    this.datePretty = null
    this.backupMetadataCovers = null

    this.backupDirPath = null
    this.filename = null
    this.path = null
    this.fullPath = null

    this.fileSize = null
    this.createdAt = null

    if (data) {
      this.construct(data)
    }
  }

  get detailsString() {
    var details = []
    details.push(this.id)
    details.push(this.backupMetadataCovers ? '1' : '0')
    details.push(this.createdAt)
    return details.join('\n')
  }

  construct(data) {
    this.id = data.details[0]
    this.backupMetadataCovers = data.details[1] === '1'
    this.createdAt = Number(data.details[2])

    this.datePretty = date.format(new Date(this.createdAt), 'ddd, MMM D YYYY HH:mm')

    this.backupDirPath = Path.dirname(data.fullPath)
    this.filename = Path.basename(data.fullPath)
    this.path = Path.join('backups', this.filename)
    this.fullPath = data.fullPath
  }

  toJSON() {
    return {
      id: this.id,
      backupMetadataCovers: this.backupMetadataCovers,
      backupDirPath: this.backupDirPath,
      datePretty: this.datePretty,
      fullPath: this.fullPath,
      path: this.path,
      filename: this.filename,
      fileSize: this.fileSize,
      createdAt: this.createdAt
    }
  }

  setData(data) {
    this.id = date.format(new Date(), 'YYYY-MM-DD[T]HHmm')
    this.datePretty = date.format(new Date(), 'ddd, MMM D YYYY HH:mm')

    this.backupMetadataCovers = data.backupMetadataCovers

    this.backupDirPath = data.backupDirPath

    this.filename = this.id + '.audiobookshelf'
    this.path = Path.join('backups', this.filename)
    this.fullPath = Path.join(this.backupDirPath, this.filename)

    this.createdAt = Date.now()
  }
}
module.exports = Backup