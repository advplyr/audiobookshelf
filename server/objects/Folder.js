const uuidv4 = require("uuid").v4

/**
 * @openapi
 * components:
 *   schemas:
 *     oldFolderId:
 *       type: string
 *       description: The ID of folders created on server version 2.2.23 and before.
 *       format: "fol_[a-z0-9]{18}"
 *       example: fol_o78uaoeuh78h6aoeif
 *     newFolderId:
 *       type: string
 *       description: The folder ID for any folders added after 2.3.0.
 *       format: uuid
 *       example: e4bb1afb-4a4f-4dd6-8be0-e615d233185b
 *     folderId:
 *       type: string
 *       anyOf:
 *         - $ref: '#/components/schemas/oldFolderId'
 *         - $ref: '#/components/schemas/newFolderId'
 *     folder:
 *       type: object
 *       properties:
 *         id:
 *           $ref: '#/components/schemas/folderId'
 *         fullPath:
 *           description: The path on the server for the folder. (Read Only)
 *           type: string
 *           example: /podcasts
 *         libraryId:
 *           - $ref: '#/components/schemas/libraryId'
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