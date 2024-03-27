/**
 * @openapi
 * components:
 *   schemas:
 *     audioTrack:
 *       type: object
 *       properties:
 *         index:
 *           description: The index of the audio track.
 *           type: integer
 *           example: 1
 *         startOffset:
 *           description: When in the audio file (in seconds) the track starts.
 *           type: number
 *           example: 0
 *         duration:
 *           description: The length (in seconds) of the audio track.
 *           type: number
 *           example: 33854.905
 *         title:
 *           description: The filename of the audio file the audio track belongs to.
 *           type: string
 *           example: Wizards First Rule 01.mp3
 *         contentUrl:
 *           description: The URL path of the audio file.
 *           type: string
 *           example: >-
 *               /s/item/li_8gch9ve09orgn4fdz8/Terry Goodkind - SOT Bk01 - Wizards First
 *               Rule 01.mp3
 *         mimeType:
 *           description: The MIME type of the audio file.
 *           type: string
 *           example: audio/mpeg
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 */
class AudioTrack {
  constructor() {
    this.index = null
    this.startOffset = null
    this.duration = null
    this.title = null
    this.contentUrl = null
    this.mimeType = null
    this.codec = null
    this.metadata = null
  }

  toJSON() {
    return {
      index: this.index,
      startOffset: this.startOffset,
      duration: this.duration,
      title: this.title,
      contentUrl: this.contentUrl,
      mimeType: this.mimeType,
      codec: this.codec,
      metadata: this.metadata?.toJSON() || null
    }
  }

  setData(itemId, audioFile, startOffset) {
    this.index = audioFile.index
    this.startOffset = startOffset
    this.duration = audioFile.duration
    this.title = audioFile.metadata.filename || ''

    this.contentUrl = `${global.RouterBasePath}/api/items/${itemId}/file/${audioFile.ino}`
    this.mimeType = audioFile.mimeType
    this.codec = audioFile.codec || null
    this.metadata = audioFile.metadata.clone()
  }

  setFromStream(title, duration, contentUrl) {
    this.index = 1
    this.startOffset = 0
    this.duration = duration
    this.title = title
    this.contentUrl = contentUrl
    this.mimeType = 'application/vnd.apple.mpegurl'
  }
}
module.exports = AudioTrack