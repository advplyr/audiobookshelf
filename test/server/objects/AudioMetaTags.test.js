const { expect } = require('chai')
const AudioMetaTags = require('../../../server/objects/metadata/AudioMetaTags')

describe('AudioMetaTags', () => {
  it('serializes dynamic tag fields and compares them', () => {
    const tags = new AudioMetaTags()
    tags.tagCustom = 'custom'
    expect(tags.toJSON()).to.deep.equal({ tagCustom: 'custom' })
    expect(new AudioMetaTags().isEqual(tags)).to.equal(false)
  })

  it('toJSON only returns tags that are set', () => {
    const tags = new AudioMetaTags({ tagTitle: 'A Title', tagArtist: '', tagAlbum: null })
    expect(tags.toJSON()).to.deep.equal({ tagTitle: 'A Title' })
    expect(new AudioMetaTags().toJSON()).to.deep.equal({})
  })

  it('construct normalizes missing and falsy values to null', () => {
    const tags = new AudioMetaTags({ tagTitle: 'A Title', tagArtist: '' })
    expect(tags.tagTitle).to.equal('A Title')
    expect(tags.tagArtist).to.equal(null)
    expect(tags.tagASIN).to.equal(null)
    expect(tags.tagMusicBrainzArtistId).to.equal(null)
  })

  it('setData maps file_tag_* keys from the prober to tag fields', () => {
    const tags = new AudioMetaTags()
    tags.setData({
      file_tag_album: 'Album',
      file_tag_albumsort: 'Album Sort',
      file_tag_asin: 'B000TEST',
      file_tag_overdrive_media_marker: 'marker',
      file_tag_musicbrainz_albumartistid: 'mb-aa',
      file_tag_encodedby: 'someone'
    })
    expect(tags.toJSON()).to.deep.equal({
      tagAlbum: 'Album',
      tagAlbumSort: 'Album Sort',
      tagEncodedBy: 'someone',
      tagASIN: 'B000TEST',
      tagOverdriveMediaMarker: 'marker',
      tagMusicBrainzAlbumArtistId: 'mb-aa'
    })
  })

  it('setData clears tags that are missing from the payload', () => {
    const tags = new AudioMetaTags({ tagTitle: 'Old', tagArtist: 'Old Artist' })
    tags.setData({ file_tag_title: 'New' })
    expect(tags.toJSON()).to.deep.equal({ tagTitle: 'New' })
  })

  it('updateData returns true only when something changed', () => {
    const tags = new AudioMetaTags()
    tags.setData({ file_tag_title: 'Same', file_tag_artist: 'Artist' })
    expect(tags.updateData({ file_tag_title: 'Same', file_tag_artist: 'Artist' })).to.equal(false)
    expect(tags.updateData({ file_tag_title: 'Different', file_tag_artist: 'Artist' })).to.equal(true)
    expect(tags.tagTitle).to.equal('Different')
  })

  it('updateData clears tags missing from the payload and reports the change', () => {
    const tags = new AudioMetaTags({ tagTitle: 'Title', tagArtist: 'Artist' })
    expect(tags.updateData({ file_tag_title: 'Title' })).to.equal(true)
    expect(tags.tagArtist).to.equal(null)
  })

  it('parses track and disc "number/total" strings', () => {
    const tags = new AudioMetaTags({ tagTrack: '3/10', tagDisc: '2' })
    expect(tags.trackNumAndTotal).to.deep.equal({ number: 3, total: 10 })
    expect(tags.trackNumber).to.equal(3)
    expect(tags.trackTotal).to.equal(10)
    expect(tags.discNumAndTotal).to.deep.equal({ number: 2, total: null })
    expect(tags.discNumber).to.equal(2)
    expect(tags.discTotal).to.equal(null)
  })

  it('handles missing, fractional and non numeric track values', () => {
    expect(new AudioMetaTags().trackNumAndTotal).to.deep.equal({ number: null, total: null })
    expect(new AudioMetaTags({ tagTrack: '3.7/10' }).trackNumber).to.equal(3)
    expect(new AudioMetaTags({ tagTrack: 'abc/xyz' }).trackNumAndTotal).to.deep.equal({ number: null, total: null })
    expect(new AudioMetaTags({ tagDisc: 'x/4' }).discNumAndTotal).to.deep.equal({ number: null, total: 4 })
  })

  it('clone copies set tags into an independent instance', () => {
    const tags = new AudioMetaTags({ tagTitle: 'Title', tagGenre: 'Fantasy' })
    const copy = tags.clone()
    expect(copy).to.not.equal(tags)
    expect(copy.toJSON()).to.deep.equal(tags.toJSON())
    copy.tagTitle = 'Changed'
    expect(tags.tagTitle).to.equal('Title')
  })

  it('isEqual compares tags and rejects values that are not tag objects', () => {
    const tags = new AudioMetaTags({ tagTitle: 'Title' })
    expect(tags.isEqual(new AudioMetaTags({ tagTitle: 'Title' }))).to.equal(true)
    expect(tags.isEqual(new AudioMetaTags({ tagTitle: 'Other' }))).to.equal(false)
    expect(tags.isEqual(null)).to.equal(false)
    expect(tags.isEqual({})).to.equal(false)
  })
})
