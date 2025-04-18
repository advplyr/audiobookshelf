const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.20.0-improve-author-sort-queries')

const normalizeWhitespaceAndBackticks = (str) => str.replace(/\s+/g, ' ').trim().replace(/`/g, '')

describe('Migration v2.20.0-improve-author-sort-queries', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      mediaId: { type: DataTypes.INTEGER, allowNull: false },
      mediaType: { type: DataTypes.STRING, allowNull: false },
      libraryId: { type: DataTypes.INTEGER, allowNull: false }
    })

    await queryInterface.createTable('authors', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      lastFirst: { type: DataTypes.STRING, allowNull: false }
    })

    await queryInterface.createTable('bookAuthors', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      bookId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'libraryItems', key: 'id', onDelete: 'CASCADE' } },
      authorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'authors', key: 'id', onDelete: 'CASCADE' } },
      createdAt: { type: DataTypes.DATE, allowNull: false }
    })

    await queryInterface.createTable('podcastEpisodes', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true }
    })

    await queryInterface.bulkInsert('libraryItems', [
      { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1 },
      { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1 }
    ])

    await queryInterface.bulkInsert('authors', [
      { id: 1, name: 'John Doe', lastFirst: 'Doe, John' },
      { id: 2, name: 'Jane Smith', lastFirst: 'Smith, Jane' },
      { id: 3, name: 'John Smith', lastFirst: 'Smith, John' }
    ])

    await queryInterface.bulkInsert('bookAuthors', [
      { id: 1, bookId: 1, authorId: 1, createdAt: '2025-01-01 00:00:00.000 +00:00' },
      { id: 2, bookId: 2, authorId: 2, createdAt: '2025-01-02 00:00:00.000 +00:00' },
      { id: 3, bookId: 1, authorId: 3, createdAt: '2024-12-31 00:00:00.000 +00:00' }
    ])

    await queryInterface.bulkInsert('podcastEpisodes', [
      { id: 1, publishedAt: '2025-01-01 00:00:00.000 +00:00' },
      { id: 2, publishedAt: '2025-01-02 00:00:00.000 +00:00' },
      { id: 3, publishedAt: '2025-01-03 00:00:00.000 +00:00' }
    ])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should add the authorNamesFirstLast and authorNamesLastFirst columns to the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const libraryItems = await queryInterface.describeTable('libraryItems')
      expect(libraryItems.authorNamesFirstLast).to.exist
      expect(libraryItems.authorNamesLastFirst).to.exist
    })

    it('should populate the authorNamesFirstLast and authorNamesLastFirst columns with the author names for each libraryItem', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'John Smith, John Doe', authorNamesLastFirst: 'Smith, John, Doe, John' },
        { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'Jane Smith', authorNamesLastFirst: 'Smith, Jane' }
      ])
    })

    it('should create triggers to update the authorNamesFirstLast and authorNamesLastFirst columns when the corresponding bookAuthors and authors records are updated', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_insert'`)
      expect(count).to.equal(1)

      const [[{ sql }]] = await queryInterface.sequelize.query(`SELECT sql FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_insert'`)
      expect(normalizeWhitespaceAndBackticks(sql)).to.equal(
        normalizeWhitespaceAndBackticks(`
          CREATE TRIGGER update_library_items_author_names_on_book_authors_insert
            AFTER insert ON bookAuthors
            FOR EACH ROW
            BEGIN
              UPDATE libraryItems
                SET (authorNamesFirstLast, authorNamesLastFirst) = (
                  SELECT GROUP_CONCAT(authors.name, ', ' ORDER BY bookAuthors.createdAt ASC), GROUP_CONCAT(authors.lastFirst, ', ' ORDER BY bookAuthors.createdAt ASC)
                  FROM authors JOIN bookAuthors ON authors.id = bookAuthors.authorId
                  WHERE bookAuthors.bookId = NEW.bookId
                )
              WHERE mediaId = NEW.bookId;
            END
        `)
      )

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_delete'`)
      expect(count2).to.equal(1)

      const [[{ sql: sql2 }]] = await queryInterface.sequelize.query(`SELECT sql FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_delete'`)
      expect(normalizeWhitespaceAndBackticks(sql2)).to.equal(
        normalizeWhitespaceAndBackticks(`
          CREATE TRIGGER update_library_items_author_names_on_book_authors_delete
            AFTER delete ON bookAuthors
            FOR EACH ROW
            BEGIN
              UPDATE libraryItems
                SET (authorNamesFirstLast, authorNamesLastFirst) = (
                  SELECT GROUP_CONCAT(authors.name, ', ' ORDER BY bookAuthors.createdAt ASC), GROUP_CONCAT(authors.lastFirst, ', ' ORDER BY bookAuthors.createdAt ASC)
                  FROM authors JOIN bookAuthors ON authors.id = bookAuthors.authorId
                  WHERE bookAuthors.bookId = OLD.bookId
                )
              WHERE mediaId = OLD.bookId;
            END
        `)
      )

      const [[{ count: count3 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_authors_update'`)
      expect(count3).to.equal(1)

      const [[{ sql: sql3 }]] = await queryInterface.sequelize.query(`SELECT sql FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_authors_update'`)
      expect(normalizeWhitespaceAndBackticks(sql3)).to.equal(
        normalizeWhitespaceAndBackticks(`
          CREATE TRIGGER update_library_items_author_names_on_authors_update
            AFTER UPDATE OF name ON authors
            FOR EACH ROW
            BEGIN
              UPDATE libraryItems
                SET (authorNamesFirstLast, authorNamesLastFirst) = (
                  SELECT GROUP_CONCAT(authors.name, ', ' ORDER BY bookAuthors.createdAt ASC), GROUP_CONCAT(authors.lastFirst, ', ' ORDER BY bookAuthors.createdAt ASC)
                  FROM authors JOIN bookAuthors ON authors.id = bookAuthors.authorId
                  WHERE bookAuthors.bookId = libraryItems.mediaId
                )
              WHERE mediaId IN (SELECT bookId FROM bookAuthors WHERE authorId = NEW.id);
            END
        `)
      )
    })

    it('should create indexes on the authorNamesFirstLast and authorNamesLastFirst columns', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_first_last'`)
      expect(count).to.equal(1)

      const [[{ sql }]] = await queryInterface.sequelize.query(`SELECT sql FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_first_last'`)
      expect(normalizeWhitespaceAndBackticks(sql)).to.equal(
        normalizeWhitespaceAndBackticks(`
          CREATE INDEX library_items_library_id_media_type_author_names_first_last ON libraryItems (libraryId, mediaType, authorNamesFirstLast COLLATE NOCASE)
        `)
      )

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_last_first'`)
      expect(count2).to.equal(1)

      const [[{ sql: sql2 }]] = await queryInterface.sequelize.query(`SELECT sql FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_last_first'`)
      expect(normalizeWhitespaceAndBackticks(sql2)).to.equal(
        normalizeWhitespaceAndBackticks(`
          CREATE INDEX library_items_library_id_media_type_author_names_last_first ON libraryItems (libraryId, mediaType, authorNamesLastFirst COLLATE NOCASE)
        `)
      )
    })

    it('should trigger after update on authors', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      // update author name
      await queryInterface.sequelize.query(`UPDATE authors SET (name, lastFirst) = ('John Wayne', 'Wayne, John') WHERE id = 1`)

      // check that the libraryItems table was updated
      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'John Smith, John Wayne', authorNamesLastFirst: 'Smith, John, Wayne, John' },
        { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'Jane Smith', authorNamesLastFirst: 'Smith, Jane' }
      ])
    })

    it('should trigger after insert on bookAuthors', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      // insert a new author
      await queryInterface.sequelize.query(`INSERT INTO authors (id, name, lastFirst) VALUES (4, 'John Wayne', 'Wayne, John')`)

      // insert a new bookAuthor
      await queryInterface.sequelize.query(`INSERT INTO bookAuthors (id, bookId, authorId, createdAt) VALUES (4, 1, 4, '2025-01-04 00:00:00.000 +00:00')`)

      // check that the libraryItems table was updated
      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'John Smith, John Doe, John Wayne', authorNamesLastFirst: 'Smith, John, Doe, John, Wayne, John' },
        { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'Jane Smith', authorNamesLastFirst: 'Smith, Jane' }
      ])
    })

    it('should trigger after delete on bookAuthors', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      // delete a bookAuthor
      await queryInterface.sequelize.query(`DELETE FROM bookAuthors WHERE id = 1`)

      // check that the libraryItems table was updated
      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'John Smith', authorNamesLastFirst: 'Smith, John' },
        { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'Jane Smith', authorNamesLastFirst: 'Smith, Jane' }
      ])
    })

    it('should add an index on publishedAt to the podcastEpisodes table', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='podcast_episodes_published_at'`)
      expect(count).to.equal(1)

      const [[{ sql }]] = await queryInterface.sequelize.query(`SELECT sql FROM sqlite_master WHERE type='index' AND name='podcast_episodes_published_at'`)
      expect(normalizeWhitespaceAndBackticks(sql)).to.equal(
        normalizeWhitespaceAndBackticks(`
          CREATE INDEX podcast_episodes_published_at ON podcastEpisodes (publishedAt)
        `)
      )
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      const libraryItemsTable = await queryInterface.describeTable('libraryItems')
      expect(libraryItemsTable.authorNamesFirstLast).to.exist
      expect(libraryItemsTable.authorNamesLastFirst).to.exist

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_insert'`)
      expect(count).to.equal(1)

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_delete'`)
      expect(count2).to.equal(1)

      const [[{ count: count3 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_authors_update'`)
      expect(count3).to.equal(1)

      const [[{ count: count4 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_first_last'`)
      expect(count4).to.equal(1)

      const [[{ count: count5 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_last_first'`)
      expect(count5).to.equal(1)

      const [[{ count: count6 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='podcast_episodes_published_at'`)
      expect(count6).to.equal(1)

      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'John Smith, John Doe', authorNamesLastFirst: 'Smith, John, Doe, John' },
        { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1, authorNamesFirstLast: 'Jane Smith', authorNamesLastFirst: 'Smith, Jane' }
      ])
    })
  })

  describe('down', () => {
    it('should remove the authorNamesFirstLast and authorNamesLastFirst columns from the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const libraryItemsTable = await queryInterface.describeTable('libraryItems')
      expect(libraryItemsTable.authorNamesFirstLast).to.not.exist
      expect(libraryItemsTable.authorNamesLastFirst).to.not.exist

      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1 },
        { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1 }
      ])
    })

    it('should remove the triggers from the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_insert'`)
      expect(count).to.equal(0)

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_delete'`)
      expect(count2).to.equal(0)

      const [[{ count: count3 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_authors_update'`)
      expect(count3).to.equal(0)
    })

    it('should remove the indexes from the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_first_last'`)
      expect(count).to.equal(0)

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_last_first'`)
      expect(count2).to.equal(0)
    })

    it('should remove the index on publishedAt from the podcastEpisodes table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='podcast_episodes_published_at'`)
      expect(count).to.equal(0)
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const libraryItemsTable = await queryInterface.describeTable('libraryItems')
      expect(libraryItemsTable.authorNamesFirstLast).to.not.exist
      expect(libraryItemsTable.authorNamesLastFirst).to.not.exist

      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, mediaType: 'book', libraryId: 1 },
        { id: 2, mediaId: 2, mediaType: 'book', libraryId: 1 }
      ])

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_insert'`)
      expect(count).to.equal(0)

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_book_authors_delete'`)
      expect(count2).to.equal(0)

      const [[{ count: count3 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_author_names_on_authors_update'`)
      expect(count3).to.equal(0)

      const [[{ count: count4 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_first_last'`)
      expect(count4).to.equal(0)

      const [[{ count: count5 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_author_names_last_first'`)
      expect(count5).to.equal(0)

      const [[{ count: count6 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='podcast_episodes_published_at'`)
      expect(count6).to.equal(0)
    })
  })
})
