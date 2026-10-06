const chai = require('chai')
const expect = chai.expect
const audioFileScanner = require('../../../server/scanner/AudioFileScanner')

describe('AudioFileScanner abridged metadata', () => {
  let originalGetBookChaptersFromAudioFiles

  beforeEach(() => {
    originalGetBookChaptersFromAudioFiles = audioFileScanner.getBookChaptersFromAudioFiles
    audioFileScanner.getBookChaptersFromAudioFiles = () => []
  })

  afterEach(() => {
    audioFileScanner.getBookChaptersFromAudioFiles = originalGetBookChaptersFromAudioFiles
  })

  it('sets abridged true from ABRIDGED=Yes', () => {
    const audioFiles = [
      {
        metaTags: {
          tagAbridged: 'Yes'
        }
      }
    ]
    const bookMetadata = {}

    audioFileScanner.setBookMetadataFromAudioMetaTags('Test Book', audioFiles, bookMetadata, {})

    expect(bookMetadata.abridged).to.be.true
  })

  it('sets abridged false from FORMAT=Unabridged', () => {
    const audioFiles = [
      {
        metaTags: {
          tagFormat: 'Unabridged'
        }
      }
    ]
    const bookMetadata = {
      abridged: true
    }

    audioFileScanner.setBookMetadataFromAudioMetaTags('Test Book', audioFiles, bookMetadata, {})

    expect(bookMetadata.abridged).to.be.false
  })

  it('parses supported ABRIDGED values', () => {
    const trueValues = ['1', 'True', 'Yes']
    const falseValues = ['0', 'False', 'No']

    trueValues.forEach((value) => {
      const bookMetadata = {}
      const audioFiles = [
        {
          metaTags: {
            tagAbridged: value
          }
        }
      ]

      audioFileScanner.setBookMetadataFromAudioMetaTags('Test Book', audioFiles, bookMetadata, {})

      expect(bookMetadata.abridged).to.be.true
    })

    falseValues.forEach((value) => {
      const bookMetadata = {}
      const audioFiles = [
        {
          metaTags: {
            tagAbridged: value
          }
        }
      ]

      audioFileScanner.setBookMetadataFromAudioMetaTags('Test Book', audioFiles, bookMetadata, {})

      expect(bookMetadata.abridged).to.be.false
    })
  })

  it('parses Abridged and Unabridged FORMAT values', () => {
    const abridgedMetadata = {}
    audioFileScanner.setBookMetadataFromAudioMetaTags(
      'Test Book',
      [
        {
          metaTags: {
            tagFormat: 'Abridged'
          }
        }
      ],
      abridgedMetadata,
      {}
    )

    expect(abridgedMetadata.abridged).to.be.true

    const unabridgedMetadata = {}
    audioFileScanner.setBookMetadataFromAudioMetaTags(
      'Test Book',
      [
        {
          metaTags: {
            tagFormat: 'Unabridged'
          }
        }
      ],
      unabridgedMetadata,
      {}
    )

    expect(unabridgedMetadata.abridged).to.be.false
  })
  it('does not set abridged when ABRIDGED and FORMAT conflict', () => {
    const audioFiles = [
      {
        metaTags: {
          tagAbridged: 'Yes',
          tagFormat: 'Unabridged'
        }
      }
    ]
    const bookMetadata = {}

    audioFileScanner.setBookMetadataFromAudioMetaTags('Test Book', audioFiles, bookMetadata, {})

    expect(bookMetadata.abridged).to.be.undefined
  })
})
