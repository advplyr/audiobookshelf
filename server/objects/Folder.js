const uuidv4 = require("uuid").v4

/**
 * @openapi
 * components:
 *   schemas:
 *     folder:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the folder. (Read Only)
 *           type: string
 *           example: fol_bev1zuxhb0j0s1wehr
 *         fullPath:
 *           description: The path on the server for the folder. (Read Only)
 *           type: string
 *           example: /podcasts
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the folder was added. (Read Only)
 *           type: integer
 *           example: 1650462940610
 */
class Folder {
  constructor(folder = null) {
    this.id = null
    this.fullPath = null
    this.libraryId = null
    this.addedAt = null

    if (folder) {
      this.construct(folder)
    }
  }

  construct(folder) {
    this.id = folder.id
    this.fullPath = folder.fullPath
    this.libraryId = folder.libraryId
    this.addedAt = folder.addedAt
  }

  toJSON() {
    return {
      id: this.id,
      fullPath: this.fullPath,
      libraryId: this.libraryId,
      addedAt: this.addedAt
    }
  }

  setData(data) {
    this.id = data.id || uuidv4()
    this.fullPath = data.fullPath
    this.libraryId = data.libraryId
    this.addedAt = Date.now()
  }
}
module.exports = Folder