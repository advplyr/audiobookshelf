const Logger = require('../../Logger')
const uuidv4 = require("uuid").v4
const { checkNamesAreEqual, nameToLastFirst } = require('../../utils/parsers/parseNameString')

/**
 * @openapi
 * components:
 *   schemas:
 *     author:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the author.
 *           type: string
 *           example: aut_z3leimgybl7uf3y4ab
 *         asin:
 *           description: The ASIN of the author. Will be null if unknown.
 *           type: [string, 'null']
 *         name:
 *           description: The name of the author.
 *           type: string
 *           example: Terry Goodkind
 *         description:
 *           description: A description of the author. Will be null if there is none.
 *           type: [string, 'null']
 *         imagePath:
 *           description: The absolute path for the author image. Will be null if there is no image.
 *           type: [string, 'null']
 *         addedAt:
 *           $ref: '#/components/schemas/addedAt'
 *         updatedAt:
 *           $ref: '#/components/schemas/updatedAt'
 *     authorMinified:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the author.
 *           type: string
 *           example: aut_z3leimgybl7uf3y4ab
 *         name:
 *           description: The name of the author.
 *           type: string
 *           example: Terry Goodkind
 *     authorExpanded:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the author.
 *           type: string
 *           example: aut_z3leimgybl7uf3y4ab
 *         asin:
 *           description: The ASIN of the author. Will be null if unknown.
 *           type: [string, 'null']
 *         name:
 *           description: The name of the author.
 *           type: string
 *           example: Terry Goodkind
 *         description:
 *           description: A description of the author. Will be null if there is none.
 *           type: [string, 'null']
 *         imagePath:
 *           description: The absolute path for the author image. Will be null if there is no image.
 *           type: [string, 'null']
 *         addedAt:
 *           $ref: '#/components/schemas/addedAt'
 *         updatedAt:
 *           $ref: '#/components/schemas/updatedAt'
 *         numBooks:
 *           description: The number of books associated with the author in the library.
 *           type: integer
 *           example: 1
 */
class Author {
  constructor(author) {
    this.id = null
    this.asin = null
    this.name = null
    this.description = null
    this.imagePath = null
    this.addedAt = null
    this.updatedAt = null
    this.libraryId = null

    if (author) {
      this.construct(author)
    }
  }

  construct(author) {
    this.id = author.id
    this.asin = author.asin
    this.name = author.name || ''
    this.description = author.description || null
    this.imagePath = author.imagePath
    this.addedAt = author.addedAt
    this.updatedAt = author.updatedAt
    this.libraryId = author.libraryId
  }

  get lastFirst() {
    if (!this.name) return ''
    return nameToLastFirst(this.name)
  }

  toJSON() {
    return {
      id: this.id,
      asin: this.asin,
      name: this.name,
      description: this.description,
      imagePath: this.imagePath,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      libraryId: this.libraryId
    }
  }

  toJSONExpanded(numBooks = 0) {
    const json = this.toJSON()
    json.numBooks = numBooks
    return json
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name
    }
  }

  setData(data, libraryId) {
    this.id = uuidv4()
    if (!data.name) {
      Logger.error(`[Author] setData: Setting author data without a name`, data)
    }
    this.name = data.name || ''
    this.description = data.description || null
    this.asin = data.asin || null
    this.imagePath = data.imagePath || null
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
    this.libraryId = libraryId
  }

  update(payload) {
    const json = this.toJSON()
    delete json.id
    delete json.addedAt
    delete json.updatedAt
    let hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined && json[key] != payload[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  checkNameEquals(name) {
    if (!name) return false
    if (this.name === null) {
      Logger.error(`[Author] Author name is null (${this.id})`)
      return false
    }
    return checkNamesAreEqual(this.name, name)
  }
}
module.exports = Author