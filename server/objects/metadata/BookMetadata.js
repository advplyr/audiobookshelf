const Logger = require('../../Logger')
const { areEquivalent, copyValue, getTitleIgnorePrefix, getTitlePrefixAtEnd } = require('../../utils/index')
const parseNameString = require('../../utils/parsers/parseNameString')

/**
 * @openapi
 * components:
 *   schemas:
 *     bookMetadata:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Wizards First Rule
 *         subtitle:
 *           description: The subtitle of the book. Will be null if there is no subtitle.
 *           type: [string, 'null']
 *         authors:
 *           description: The authors of the book.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/authorMinified'
 *         narrators:
 *           description: The narrators of the audiobook.
 *           type: array
 *           items:
 *             type: string
 *             example: Sam Tsoutsouvas
 *         series:
 *           description: The series the book belongs to.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/seriesSequence'
 *         genres:
 *           description: The genres of the book.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         publishedYear:
 *           description: The year the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2008'
 *         publishedDate:
 *           description: The date the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *         publisher:
 *           description: The publisher of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Brilliance Audio
 *         description:
 *           description: A description for the book. Will be null if empty.
 *           type: [string, 'null']
 *           example: >-
 *               The masterpiece that started Terry Goodkind's New York Times bestselling
 *               epic Sword of Truth In the aftermath of the brutal murder of his father,
 *               a mysterious woman, Kahlan Amnell, appears in Richard Cypher's forest
 *               sanctuary seeking help...and more. His world, his very beliefs, are
 *               shattered when ancient debts come due with thundering violence. In a
 *               dark age it takes courage to live, and more than mere courage to
 *               challenge those who hold dominion, Richard and Kahlan must take up that
 *               challenge or become the next victims. Beyond awaits a bewitching land
 *               where even the best of their hearts could betray them. Yet, Richard
 *               fears nothing so much as what secrets his sword might reveal about his
 *               own soul. Falling in love would destroy them - for reasons Richard can't
 *               imagine and Kahlan dare not say. In their darkest hour, hunted
 *               relentlessly, tormented by treachery and loss, Kahlan calls upon Richard
 *               to reach beyond his sword - to invoke within himself something more
 *               noble. Neither knows that the rules of battle have just changed...or
 *               that their time has run out. Wizard's First Rule is the beginning. One
 *               book. One Rule. Witness the birth of a legend.
 *         isbn:
 *           description: The ISBN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         asin:
 *           description: The ASIN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: B002V0QK4C
 *         language:
 *           description: The language of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         explicit:
 *           description: Whether the book has been marked as explicit.
 *           type: boolean
 *           example: false
 *     bookMetadataMinified:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Wizards First Rule
 *         titleIgnorePrefix:
 *           description: The title of the book with any prefix moved to the end.
 *           type: string
 *         subtitle:
 *           description: The subtitle of the book. Will be null if there is no subtitle.
 *           type: [string, 'null']
 *         authorName:
 *           description: The name of the book's author(s).
 *           type: string
 *           example: Terry Goodkind
 *         authorNameLF:
 *           description: The name of the book's author(s) with last names first.
 *           type: string
 *           example: Goodkind, Terry
 *         narratorName:
 *           description: The name of the audiobook's narrator(s).
 *           type: string
 *           example: Sam Tsoutsouvas
 *         seriesName:
 *           description: The name of the book's series.
 *           type: string
 *           example: Sword of Truth
 *         genres:
 *           description: The genres of the book.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         publishedYear:
 *           description: The year the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2008'
 *         publishedDate:
 *           description: The date the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *         publisher:
 *           description: The publisher of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Brilliance Audio
 *         description:
 *           description: A description for the book. Will be null if empty.
 *           type: [string, 'null']
 *           example: >-
 *               The masterpiece that started Terry Goodkind's New York Times bestselling
 *               epic Sword of Truth In the aftermath of the brutal murder of his father,
 *               a mysterious woman, Kahlan Amnell, appears in Richard Cypher's forest
 *               sanctuary seeking help...and more. His world, his very beliefs, are
 *               shattered when ancient debts come due with thundering violence. In a
 *               dark age it takes courage to live, and more than mere courage to
 *               challenge those who hold dominion, Richard and Kahlan must take up that
 *               challenge or become the next victims. Beyond awaits a bewitching land
 *               where even the best of their hearts could betray them. Yet, Richard
 *               fears nothing so much as what secrets his sword might reveal about his
 *               own soul. Falling in love would destroy them - for reasons Richard can't
 *               imagine and Kahlan dare not say. In their darkest hour, hunted
 *               relentlessly, tormented by treachery and loss, Kahlan calls upon Richard
 *               to reach beyond his sword - to invoke within himself something more
 *               noble. Neither knows that the rules of battle have just changed...or
 *               that their time has run out. Wizard's First Rule is the beginning. One
 *               book. One Rule. Witness the birth of a legend.
 *         isbn:
 *           description: The ISBN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         asin:
 *           description: The ASIN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: B002V0QK4C
 *         language:
 *           description: The language of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         explicit:
 *           description: Whether the book has been marked as explicit.
 *           type: boolean
 *           example: false
 *     bookMetadataExpanded:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Wizards First Rule
 *         titleIgnorePrefix:
 *           description: The title of the book with any prefix moved to the end.
 *           type: string
 *         subtitle:
 *           description: The subtitle of the book. Will be null if there is no subtitle.
 *           type: [string, 'null']
 *         authorName:
 *           description: The name of the book's author(s).
 *           type: string
 *           example: Terry Goodkind
 *         authorNameLF:
 *           description: The name of the book's author(s) with last names first.
 *           type: string
 *           example: Goodkind, Terry
 *         narratorName:
 *           description: The name of the audiobook's narrator(s).
 *           type: string
 *           example: Sam Tsoutsouvas
 *         seriesName:
 *           description: The name of the book's series.
 *           type: string
 *           example: Sword of Truth
 *         authors:
 *           description: The authors of the book.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/authorMinified'
 *         narrators:
 *           description: The narrators of the audiobook.
 *           type: array
 *           items:
 *             type: string
 *             example: Sam Tsoutsouvas
 *         series:
 *           description: The series the book belongs to.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/seriesSequence'
 *         genres:
 *           description: The genres of the book.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         publishedYear:
 *           description: The year the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *           example: '2008'
 *         publishedDate:
 *           description: The date the book was published. Will be null if unknown.
 *           type: [string, 'null']
 *         publisher:
 *           description: The publisher of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: Brilliance Audio
 *         description:
 *           description: A description for the book. Will be null if empty.
 *           type: [string, 'null']
 *           example: >-
 *               The masterpiece that started Terry Goodkind's New York Times bestselling
 *               epic Sword of Truth In the aftermath of the brutal murder of his father,
 *               a mysterious woman, Kahlan Amnell, appears in Richard Cypher's forest
 *               sanctuary seeking help...and more. His world, his very beliefs, are
 *               shattered when ancient debts come due with thundering violence. In a
 *               dark age it takes courage to live, and more than mere courage to
 *               challenge those who hold dominion, Richard and Kahlan must take up that
 *               challenge or become the next victims. Beyond awaits a bewitching land
 *               where even the best of their hearts could betray them. Yet, Richard
 *               fears nothing so much as what secrets his sword might reveal about his
 *               own soul. Falling in love would destroy them - for reasons Richard can't
 *               imagine and Kahlan dare not say. In their darkest hour, hunted
 *               relentlessly, tormented by treachery and loss, Kahlan calls upon Richard
 *               to reach beyond his sword - to invoke within himself something more
 *               noble. Neither knows that the rules of battle have just changed...or
 *               that their time has run out. Wizard's First Rule is the beginning. One
 *               book. One Rule. Witness the birth of a legend.
 *         isbn:
 *           description: The ISBN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         asin:
 *           description: The ASIN of the book. Will be null if unknown.
 *           type: [string, 'null']
 *           example: B002V0QK4C
 *         language:
 *           description: The language of the book. Will be null if unknown.
 *           type: [string, 'null']
 *         explicit:
 *           description: Whether the book has been marked as explicit.
 *           type: boolean
 *           example: false
 *     bookChapter:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the book chapter.
 *           type: integer
 *           example: 0
 *         start:
 *           description: When in the book (in seconds) the chapter starts.
 *           type: integer
 *           example: 0
 *         end:
 *           description: When in the book (in seconds) the chapter ends.
 *           type: number
 *           example: 6004.6675
 *         title:
 *           description: The title of the chapter.
 *           type: string
 *           example: Wizards First Rule 01
 */
class BookMetadata {
  constructor(metadata) {
    this.title = null
    this.subtitle = null
    this.authors = []
    this.narrators = []  // Array of strings
    this.series = []
    this.genres = [] // Array of strings
    this.publishedYear = null
    this.publishedDate = null
    this.publisher = null
    this.description = null
    this.isbn = null
    this.asin = null
    this.language = null
    this.explicit = false
    this.abridged = false

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.subtitle = metadata.subtitle
    this.authors = (metadata.authors?.map) ? metadata.authors.map(a => ({ ...a })) : []
    this.narrators = metadata.narrators ? [...metadata.narrators].filter(n => n) : []
    this.series = (metadata.series?.map) ? metadata.series.map(s => ({ ...s })) : []
    this.genres = metadata.genres ? [...metadata.genres] : []
    this.publishedYear = metadata.publishedYear || null
    this.publishedDate = metadata.publishedDate || null
    this.publisher = metadata.publisher
    this.description = metadata.description
    this.isbn = metadata.isbn
    this.asin = metadata.asin
    this.language = metadata.language
    this.explicit = !!metadata.explicit
    this.abridged = !!metadata.abridged
  }

  toJSON() {
    return {
      title: this.title,
      subtitle: this.subtitle,
      authors: this.authors.map(a => ({ ...a })), // Author JSONMinimal with name and id
      narrators: [...this.narrators],
      series: this.series.map(s => ({ ...s })), // Series JSONMinimal with name, id and sequence
      genres: [...this.genres],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titlePrefixAtEnd,
      subtitle: this.subtitle,
      authorName: this.authorName,
      authorNameLF: this.authorNameLF,
      narratorName: this.narratorName,
      seriesName: this.seriesName,
      genres: [...this.genres],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged
    }
  }

  toJSONExpanded() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titlePrefixAtEnd,
      subtitle: this.subtitle,
      authors: this.authors.map(a => ({ ...a })), // Author JSONMinimal with name and id
      narrators: [...this.narrators],
      series: this.series.map(s => ({ ...s })),
      genres: [...this.genres],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      authorName: this.authorName,
      authorNameLF: this.authorNameLF,
      narratorName: this.narratorName,
      seriesName: this.seriesName,
      abridged: this.abridged
    }
  }

  toJSONForMetadataFile() {
    const json = this.toJSON()
    json.authors = json.authors.map(au => au.name)
    json.series = json.series.map(se => {
      if (!se.sequence) return se.name
      return `${se.name} #${se.sequence}`
    })
    return json
  }

  clone() {
    return new BookMetadata(this.toJSON())
  }

  get titleIgnorePrefix() {
    return getTitleIgnorePrefix(this.title)
  }
  get titlePrefixAtEnd() {
    return getTitlePrefixAtEnd(this.title)
  }
  get authorName() {
    if (!this.authors.length) return ''
    return this.authors.map(au => au.name).join(', ')
  }
  get authorNameLF() { // Last, First
    if (!this.authors.length) return ''
    return this.authors.map(au => parseNameString.nameToLastFirst(au.name)).join(', ')
  }
  get seriesName() {
    if (!this.series.length) return ''
    return this.series.map(se => {
      if (!se.sequence) return se.name
      return `${se.name} #${se.sequence}`
    }).join(', ')
  }
  get firstSeriesName() {
    if (!this.series.length) return ''
    return this.series[0].name
  }
  get firstSeriesSequence() {
    if (!this.series.length) return ''
    return this.series[0].sequence
  }
  get narratorName() {
    return this.narrators.join(', ')
  }

  getSeries(seriesId) {
    return this.series.find(se => se.id == seriesId)
  }
  getSeriesSequence(seriesId) {
    const series = this.series.find(se => se.id == seriesId)
    if (!series) return null
    return series.sequence || ''
  }

  update(payload) {
    const json = this.toJSON()
    let hasUpdates = false

    for (const key in json) {
      if (payload[key] !== undefined) {
        if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[BookMetadata] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  // Updates author name
  updateAuthor(updatedAuthor) {
    const author = this.authors.find(au => au.id === updatedAuthor.id)
    if (!author || author.name == updatedAuthor.name) return false
    author.name = updatedAuthor.name
    return true
  }

  replaceAuthor(oldAuthor, newAuthor) {
    this.authors = this.authors.filter(au => au.id !== oldAuthor.id) // Remove old author
    this.authors.push({
      id: newAuthor.id,
      name: newAuthor.name
    })
  }
}
module.exports = BookMetadata
