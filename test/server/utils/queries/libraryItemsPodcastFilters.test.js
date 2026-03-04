const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../../server/Database')
const libraryItemsPodcastFilters = require('../../../../server/utils/queries/libraryItemsPodcastFilters')

describe('libraryItemsPodcastFilters dialect behavior', () => {
  let originalSequelize
  let originalServerSettings

  beforeEach(() => {
    originalSequelize = Database.sequelize
    originalServerSettings = global.ServerSettings
    global.ServerSettings = { sortingIgnorePrefix: false }
  })

  afterEach(() => {
    Database.sequelize = originalSequelize
    global.ServerSettings = originalServerSettings
    sinon.restore()
  })

  it('should build postgres json tag permission predicate', () => {
    Database.sequelize = { getDialect: () => 'postgres' }

    const { podcastWhere, replacements } = libraryItemsPodcastFilters.getUserPermissionPodcastWhereQuery({
      canAccessExplicitContent: true,
      permissions: {
        accessAllTags: false,
        itemTagsSelected: ['fiction'],
        selectedTagsNotAccessible: false
      }
    })

    expect(replacements.userTagsSelected).to.deep.equal(['fiction'])
    expect(podcastWhere[0].attribute.val).to.include('jsonb_array_elements_text')
  })

  it('should build sqlite no-case author sort expression', () => {
    Database.sequelize = { getDialect: () => 'sqlite' }

    const order = libraryItemsPodcastFilters.getOrder('media.metadata.author', false)

    expect(order[0][0].val).to.include('podcast.author COLLATE NOCASE')
  })

  it('should build postgres lower author sort expression', () => {
    Database.sequelize = { getDialect: () => 'postgres' }

    const order = libraryItemsPodcastFilters.getOrder('media.metadata.author', false)

    expect(order[0][0].val).to.include('LOWER(podcast.author)')
  })

  it('should use postgres json duration extraction in podcast stats query', async () => {
    const queryStub = sinon.stub()
    queryStub.onFirstCall().resolves([[{ totalSize: 1000 }]])
    queryStub.onSecondCall().resolves([[{ totalDuration: '12.3', totalItems: '4', numAudioFiles: '9' }]])

    Database.sequelize = {
      getDialect: () => 'postgres',
      query: queryStub
    }

    const result = await libraryItemsPodcastFilters.getPodcastLibraryStats('library-1')

    expect(queryStub.secondCall.args[0]).to.include('NULLIF(pe.audioFile::jsonb #>>')
    expect(result).to.deep.equal({
      totalSize: 1000,
      totalDuration: '12.3',
      numAudioFiles: '9',
      totalItems: '4'
    })
  })
})
