/**
 * @openapi
 * components:
 *   schemas:
 *     audioBookmark:
 *       type: object
 *       properties:
 *         libraryItemId:
 *           description: The ID of the library item the bookmark is for.
 *           type: string
 *           example: li_8gch9ve09orgn4fdz8
 *         title:
 *           description: The title of the bookmark.
 *           type: string
 *           example: the good part
 *         time:
 *           description: The time (in seconds) the bookmark is at in the book.
 *           type: integer
 *           example: 16
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 */
class AudioBookmark {
  constructor(bookmark) {
    this.libraryItemId = null
    this.title = null
    this.time = null
    this.createdAt = null

    if (bookmark) {
      this.construct(bookmark)
    }
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      title: this.title || '',
      time: this.time,
      createdAt: this.createdAt
    }
  }

  construct(bookmark) {
    this.libraryItemId = bookmark.libraryItemId
    this.title = bookmark.title || ''
    this.time = bookmark.time || 0
    this.createdAt = bookmark.createdAt
  }

  setData(libraryItemId, time, title) {
    this.libraryItemId = libraryItemId
    this.title = title
    this.time = time
    this.createdAt = Date.now()
  }
}
module.exports = AudioBookmark