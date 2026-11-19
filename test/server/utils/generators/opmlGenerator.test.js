const { expect } = require('chai')

const opmlGenerator = require('../../../../server/utils/generators/opmlGenerator')

describe('opmlGenerator', () => {
  it('escapes attribute values once', () => {
    const opml = opmlGenerator.generate([{ title: "Conan O'Brien & Co", feedURL: 'https://feeds.example.com/rss?show=c&format=mp3' }], false)

    expect(opml).to.include('text="Conan O&apos;Brien &amp; Co"')
    expect(opml).to.include('xmlUrl="https://feeds.example.com/rss?show=c&amp;format=mp3"')
  })
})
