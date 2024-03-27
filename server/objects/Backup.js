const Path = require('path')
const date = require('../libs/dateAndTime')
const version = require('../../package.json').version

/**
 * @openapi
 * components:
 *   schemas:
 *     backup:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the backup. Will be the date and time when the backup was created.
 *           type: string
 *           example: 2022-11-14T0130
 *         backupMetadataCovers:
 *           description: Whether the backup includes library item covers and author images located in metadata.
 *           type: boolean
 *           example: true
 *         backupDirPath:
 *           description: The backup directory path.
 *           type: string
 *           example: /metadata/backups
 *         datePretty:
 *           description: The date and time when the backup was created in a human-readable format.
 *           type: string
 *           example: Mon, Nov 14 2022 01:30
 *         fullPath:
 *           description: The full path of the backup on the server.
 *           type: string
 *           example: /metadata/backups/2022-11-14T0130.audiobookshelf
 *         path:
 *           description: The path of the backup relative to the metadata directory.
 *           type: string
 *           example: backups/2022-11-14T0130.audiobookshelf
 *         filename:
 *           description: The filename of the backup.
 *           type: string
 *           example: 2022-11-14T0130.audiobookshelf
 *         fileSize:
 *           description: The size (in bytes) of the backup file.
 *           type: integer
 *           example: 7776983
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         serverVersion:
 *           description: The version of the server when the backup was created.
 *           type: string
 *           example: 2.2.4
 */
class Backup {
  constructor(data = null) {
    this.id = null
    this.key = null // Special key for pre-version checks
    this.datePretty = null

    this.backupDirPath = null
    this.filename = null
    this.path = null
    this.fullPath = null
    this.serverVersion = null

    this.fileSize = null
    this.createdAt = null

    if (data) {
      this.construct(data)
    }
  }

  get detailsString() {
    const details = []
    details.push(this.id)
    details.push(this.key)
    details.push(this.createdAt)
    details.push(this.serverVersion)
    return details.join('\n')
  }

  construct(data) {
    this.id = data.details[0]
    this.key = data.details[1]
    if (this.key == 1) this.key = null // v2.2.23 and below backups stored '1' here

    this.createdAt = Number(data.details[2])
    this.serverVersion = data.details[3] || null

    this.datePretty = date.format(new Date(this.createdAt), 'ddd, MMM D YYYY HH:mm')

    this.backupDirPath = Path.dirname(data.fullPath)
    this.filename = Path.basename(data.fullPath)
    this.path = Path.join('backups', this.filename)
    this.fullPath = data.fullPath
  }

  toJSON() {
    return {
      id: this.id,
      key: this.key,
      backupDirPath: this.backupDirPath,
      datePretty: this.datePretty,
      fullPath: this.fullPath,
      path: this.path,
      filename: this.filename,
      fileSize: this.fileSize,
      createdAt: this.createdAt,
      serverVersion: this.serverVersion
    }
  }

  setData(backupDirPath) {
    this.id = date.format(new Date(), 'YYYY-MM-DD[T]HHmm')
    this.key = 'sqlite'
    this.datePretty = date.format(new Date(), 'ddd, MMM D YYYY HH:mm')

    this.backupDirPath = backupDirPath

    this.filename = this.id + '.audiobookshelf'
    this.path = Path.join('backups', this.filename)
    this.fullPath = Path.join(this.backupDirPath, this.filename)

    this.serverVersion = version

    this.createdAt = Date.now()
  }
}
module.exports = Backup