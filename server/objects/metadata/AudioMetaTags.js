class AudioMetaTags {
  constructor(metadata) {
    this.tagAlbum = null
    this.tagArtist = null
    this.tagGenre = null
    this.tagTitle = null
    this.tagSeries = null
    this.tagSeriesPart = null
    this.tagTrack = null
    this.tagDisc = null
    this.tagSubtitle = null
    this.tagAlbumArtist = null
    this.tagDate = null
    this.tagComposer = null
    this.tagPublisher = null
    this.tagComment = null
    this.tagDescription = null
    this.tagEncoder = null
    this.tagEncodedBy = null
    this.tagIsbn = null
    this.tagLanguage = null
    this.tagASIN = null
    this.tagOverdriveMediaMarker = null

    if (metadata) {
      this.construct(metadata)
    }
  }

  toJSON() {
    // Only return the tags that are actually set
    var json = {}
    for (const key in this) {
      if (key.startsWith('tag') && this[key]) {
        json[key] = this[key]
      }
    }
    return json
  }

  construct(metadata) {
    this.tagAlbum = metadata.tagAlbum || null
    this.tagArtist = metadata.tagArtist || null
    this.tagGenre = metadata.tagGenre || null
    this.tagTitle = metadata.tagTitle || null
    this.tagSeries = metadata.tagSeries || null
    this.tagSeriesPart = metadata.tagSeriesPart || null
    this.tagTrack = metadata.tagTrack || null
    this.tagDisc = metadata.tagDisc || null
    this.tagSubtitle = metadata.tagSubtitle || null
    this.tagAlbumArtist = metadata.tagAlbumArtist || null
    this.tagDate = metadata.tagDate || null
    this.tagComposer = metadata.tagComposer || null
    this.tagPublisher = metadata.tagPublisher || null
    this.tagComment = metadata.tagComment || null
    this.tagDescription = metadata.tagDescription || null
    this.tagEncoder = metadata.tagEncoder || null
    this.tagEncodedBy = metadata.tagEncodedBy || null
    this.tagIsbn = metadata.tagIsbn || null
    this.tagLanguage = metadata.tagLanguage || null
    this.tagASIN = metadata.tagASIN || null
    this.tagOverdriveMediaMarker = metadata.tagOverdriveMediaMarker || null
  }

  // Data parsed in prober.js
  setData(payload) {
    this.tagAlbum = payload.file_tag_album || null
    this.tagArtist = payload.file_tag_artist || null
    this.tagGenre = payload.file_tag_genre || null
    this.tagTitle = payload.file_tag_title || null
    this.tagSeries = payload.file_tag_series || null
    this.tagSeriesPart = payload.file_tag_seriespart || null
    this.tagTrack = payload.file_tag_track || null
    this.tagDisc = payload.file_tag_disc || null
    this.tagSubtitle = payload.file_tag_subtitle || null
    this.tagAlbumArtist = payload.file_tag_albumartist || null
    this.tagDate = payload.file_tag_date || null
    this.tagComposer = payload.file_tag_composer || null
    this.tagPublisher = payload.file_tag_publisher || null
    this.tagComment = payload.file_tag_comment || null
    this.tagDescription = payload.file_tag_description || null
    this.tagEncoder = payload.file_tag_encoder || null
    this.tagEncodedBy = payload.file_tag_encodedby || null
    this.tagIsbn = payload.file_tag_isbn || null
    this.tagLanguage = payload.file_tag_language || null
    this.tagASIN = payload.file_tag_asin || null
    this.tagOverdriveMediaMarker = payload.file_tag_overdrive_media_marker || null
  }

  updateData(payload) {
    const dataMap = {
      tagAlbum: payload.file_tag_album || null,
      tagArtist: payload.file_tag_artist || null,
      tagGenre: payload.file_tag_genre || null,
      tagTitle: payload.file_tag_title || null,
      tagSeries: payload.file_tag_series || null,
      tagSeriesPart: payload.file_tag_seriespart || null,
      tagTrack: payload.file_tag_track || null,
      tagDisc: payload.file_tag_disc || null,
      tagSubtitle: payload.file_tag_subtitle || null,
      tagAlbumArtist: payload.file_tag_albumartist || null,
      tagDate: payload.file_tag_date || null,
      tagComposer: payload.file_tag_composer || null,
      tagPublisher: payload.file_tag_publisher || null,
      tagComment: payload.file_tag_comment || null,
      tagDescription: payload.file_tag_description || null,
      tagEncoder: payload.file_tag_encoder || null,
      tagEncodedBy: payload.file_tag_encodedby || null,
      tagIsbn: payload.file_tag_isbn || null,
      tagLanguage: payload.file_tag_language || null,
      tagASIN: payload.file_tag_asin || null,
      tagOverdriveMediaMarker: payload.file_tag_overdrive_media_marker || null,
    }

    var hasUpdates = false
    for (const key in dataMap) {
      if (dataMap[key] !== this[key]) {
        this[key] = dataMap[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  clone() {
    return new AudioMetaTags(this.toJSON())
  }

  isEqual(audioFileMetadata) {
    if (!audioFileMetadata || !audioFileMetadata.toJSON) return false
    for (const key in audioFileMetadata.toJSON()) {
      if (audioFileMetadata[key] !== this[key]) return false
    }
    return true
  }
}
module.exports = AudioMetaTags