const { expect } = require('chai')
const PodcastEpisodeDownload = require('../../../server/objects/PodcastEpisodeDownload')

const libraryItem = {
  id: 'podcast-item',
  libraryId: 'podcast-library',
  path: '/podcasts/example',
  media: { title: 'Example Podcast' }
}

function createEpisode(url) {
  return {
    title: 'Example Episode',
    enclosure: { url, type: 'audio/mpeg' }
  }
}

describe('PodcastEpisodeDownload', () => {
  describe('setData', () => {
    ;[
      ['a normal URL', 'https://example.com/episode.mp3', 'https://example.com/episode.mp3'],
      ['spaces', 'https://example.com/episode name.mp3', 'https://example.com/episode%20name.mp3'],
      ['an existing valid escape', 'https://example.com/episode%20name.mp3', 'https://example.com/episode%20name.mp3'],
      ['an encoded query string', 'https://example.com/episode.mp3?next=a%2Fb', 'https://example.com/episode.mp3?next=a%2Fb'],
      ['Unicode characters', 'https://example.com/音频.mp3', 'https://example.com/%E9%9F%B3%E9%A2%91.mp3']
    ].forEach(([description, url, expectedUrl]) => {
      it(`normalizes ${description}`, () => {
        const download = new PodcastEpisodeDownload()

        download.setData(createEpisode(url), libraryItem, false, libraryItem.libraryId)

        expect(download.url).to.equal(expectedUrl)
      })
    })

    ;[
      ['an invalid percent escape', 'https://example.com/episode%ZZ.mp3'],
      ['mixed valid and invalid percent escapes', 'https://example.com/episode%20name%ZZ.mp3'],
      ['a trailing percent sign', 'https://example.com/episode%.mp3'],
      ['incomplete UTF-8 percent encoding', 'https://example.com/episode%E0%A4.mp3'],
      ['the issue %DE sequence', 'https://example.com/?dt=%25%DElivery_time%25%25'],
      ['the issue %CA sequence', 'https://example.com/?ord=%25%CAchebuster%25%25']
    ].forEach(([description, url]) => {
      it(`rejects ${description}`, () => {
        const download = new PodcastEpisodeDownload()

        expect(() => download.setData(createEpisode(url), libraryItem, false, libraryItem.libraryId)).to.throw(URIError, 'URI malformed')
      })
    })
  })
})
