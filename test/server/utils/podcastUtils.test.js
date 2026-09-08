const chai = require('chai')
const expect = chai.expect
const podcastUtils = require('../../../server/utils/podcastUtils')

describe('podcastUtils', () => {
  describe('parsePodcastRssFeedXml episode description (#5541)', () => {
    const buildXml = (itemInner) => `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <title>Test Podcast</title>
    <item>
      <title>Episode 1</title>
      <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1"/>
      ${itemInner}
    </item>
  </channel>
</rss>`

    it('falls back to itunes:summary when description and content:encoded are missing', async () => {
      const xml = buildXml('<itunes:summary>Episode notes from the iTunes summary.</itunes:summary>')
      const result = await podcastUtils.parsePodcastRssFeedXml(xml)
      const episode = result.podcast.episodes[0]
      expect(episode.description).to.include('Episode notes from the iTunes summary.')
      expect(episode.descriptionPlain).to.equal('Episode notes from the iTunes summary.')
    })

    it('prefers description over itunes:summary when both are present', async () => {
      const xml = buildXml('<description>The real description.</description><itunes:summary>The fallback summary.</itunes:summary>')
      const result = await podcastUtils.parsePodcastRssFeedXml(xml)
      const episode = result.podcast.episodes[0]
      expect(episode.descriptionPlain).to.equal('The real description.')
      expect(episode.descriptionPlain).to.not.include('fallback')
    })

    it('prefers content:encoded over itunes:summary for the html description', async () => {
      const xml = buildXml('<content:encoded><![CDATA[<p>Full HTML body.</p>]]></content:encoded><itunes:summary>The fallback summary.</itunes:summary>')
      const result = await podcastUtils.parsePodcastRssFeedXml(xml)
      const episode = result.podcast.episodes[0]
      expect(episode.description).to.include('Full HTML body.')
      expect(episode.description).to.not.include('fallback')
    })
  })
})
