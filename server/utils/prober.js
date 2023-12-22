const mediaInfoHelpers = require('./mediaInfoHelpers')
const ffprobe = require('../libs/nodeFfprobe')
const MediaProbeData = require('../scanner/MediaProbeData')

const Logger = require('../Logger')

function tryGrabBitRate(stream, all_streams, total_bit_rate) {
  if (!isNaN(stream.bit_rate) && stream.bit_rate) {
    return Number(stream.bit_rate)
  }
  if (!stream.tags) {
    return null
  }

  // Attempt to get bitrate from bps tags
  var bps = stream.tags.BPS || stream.tags['BPS-eng'] || stream.tags['BPS_eng']
  if (bps && !isNaN(bps)) {
    return Number(bps)
  }

  var tagDuration = stream.tags.DURATION || stream.tags['DURATION-eng'] || stream.tags['DURATION_eng']
  var tagBytes = stream.tags.NUMBER_OF_BYTES || stream.tags['NUMBER_OF_BYTES-eng'] || stream.tags['NUMBER_OF_BYTES_eng']
  if (tagDuration && tagBytes && !isNaN(tagDuration) && !isNaN(tagBytes)) {
    var bps = Math.floor((Number(tagBytes) * 8) / Number(tagDuration))
    if (bps && !isNaN(bps)) {
      return bps
    }
  }

  if (total_bit_rate && stream.codec_type === 'video') {
    var estimated_bit_rate = total_bit_rate
    all_streams.forEach((stream) => {
      if (stream.bit_rate && !isNaN(stream.bit_rate)) {
        estimated_bit_rate -= Number(stream.bit_rate)
      }
    })
    if (!all_streams.find((s) => s.codec_type === 'audio' && s.bit_rate && Number(s.bit_rate) > estimated_bit_rate)) {
      return estimated_bit_rate
    } else {
      return total_bit_rate
    }
  } else if (stream.codec_type === 'audio') {
    return 112000
  } else {
    return 0
  }
}

function tryGrabFrameRate(stream) {
  var avgFrameRate = stream.avg_frame_rate || stream.r_frame_rate
  if (!avgFrameRate) return null
  var parts = avgFrameRate.split('/')
  if (parts.length === 2) {
    avgFrameRate = Number(parts[0]) / Number(parts[1])
  } else {
    avgFrameRate = Number(parts[0])
  }
  if (!isNaN(avgFrameRate)) return avgFrameRate
  return null
}

function tryGrabSampleRate(stream) {
  var sample_rate = stream.sample_rate
  if (!isNaN(sample_rate)) return Number(sample_rate)
  return null
}

function tryGrabChannelLayout(stream) {
  var layout = stream.channel_layout
  if (!layout) return null
  return String(layout).split('(').shift()
}

function tryGrabTags(rawTagData, ...tags) {
  const { ffprobe, mediaInfo } = rawTagData

  if (!ffprobe && !mediaInfo) return null

  // Try ffprobe tags first
  if (ffprobe) {
    for (let i = 0; i < tags.length; i++) {
      const tagKey = Object.keys(ffprobe).find((t) => t.toLowerCase() === tags[i].toLowerCase())
      const value = ffprobe[tagKey]
      if (value && value.trim()) return value.trim()
    }
  }

  if (mediaInfo) {
    // Try mediainfo tags as a backup only if ffprobe doesn't return anything first...
    for (let i = 0; i < tags.length; i++) {
      const tagKey = mediaInfo.lowerCaseFields[tags[i]]
      if (tagKey) {
        const value = mediaInfo.fields[tagKey]
        if (value && value.trim()) return value.trim()
      }
    }
  }
  return null
}

function parseMediaStreamInfo(stream, all_streams, total_bit_rate) {
  var info = {
    index: stream.index,
    type: stream.codec_type,
    codec: stream.codec_name || null,
    codec_long: stream.codec_long_name || null,
    codec_time_base: stream.codec_time_base || null,
    time_base: stream.time_base || null,
    bit_rate: tryGrabBitRate(stream, all_streams, total_bit_rate),
    language: tryGrabTags(stream, 'language'),
    title: tryGrabTags(stream, 'title'),
  }
  if (stream.tags) info.tags = stream.tags

  if (info.type === 'audio' || info.type === 'subtitle') {
    var disposition = stream.disposition || {}
    info.is_default = disposition.default === 1 || disposition.default === '1'
  }

  if (info.type === 'video') {
    info.profile = stream.profile || null
    info.is_avc = stream.is_avc !== '0' && stream.is_avc !== 'false'
    info.pix_fmt = stream.pix_fmt || null
    info.frame_rate = tryGrabFrameRate(stream)
    info.width = !isNaN(stream.width) ? Number(stream.width) : null
    info.height = !isNaN(stream.height) ? Number(stream.height) : null
    info.color_range = stream.color_range || null
    info.color_space = stream.color_space || null
    info.color_transfer = stream.color_transfer || null
    info.color_primaries = stream.color_primaries || null
  } else if (stream.codec_type === 'audio') {
    info.channels = stream.channels || null
    info.sample_rate = tryGrabSampleRate(stream)
    info.channel_layout = tryGrabChannelLayout(stream)
  }

  return info
}

function isNullOrNaN(val) {
  return val === null || isNaN(val)
}

/* Example chapter object
 * {
      "id": 71,
      "time_base": "1/1000",
      "start": 80792671,
      "start_time": "80792.671000",
      "end": 81084755,
      "end_time": "81084.755000",
      "tags": {
          "title": "072"
      }
 * }
 */
function parseChapters(chapters) {
  if (!chapters) return []
  let index = 0
  return chapters.map((chap) => {
    let title = chap['TAG:title'] || chap.title || ''
    if (!title && chap.tags?.title) title = chap.tags.title

    const timebase = chap.time_base?.includes('/') ? Number(chap.time_base.split('/')[1]) : 1
    const start = !isNullOrNaN(chap.start_time) ? Number(chap.start_time) : !isNullOrNaN(chap.start) ? Number(chap.start) / timebase : 0
    const end = !isNullOrNaN(chap.end_time) ? Number(chap.end_time) : !isNullOrNaN(chap.end) ? Number(chap.end) / timebase : 0
    return {
      id: index++,
      start,
      end,
      title,
    }
  })
}

function parseTags(format, mediaInfoTags, verbose) {
  if (!format.tags) {
    return {}
  }
  if (verbose) {
    Logger.debug('ffprobe Tags', format.tags)
    Logger.debug('mediainfo Tags', mediaInfoTags.fields)
  }

  /**
   * Comment.
   */
  const rawTagData = {
    ffprobe: format.tags,
    mediaInfo: mediaInfoTags,
  }

  const tags = {
    file_tag_encoder: tryGrabTags(rawTagData, 'encoder', 'tsse', 'tss'),
    file_tag_encodedby: tryGrabTags(rawTagData, 'encoded_by', 'tenc', 'ten'),
    file_tag_title: tryGrabTags(rawTagData, 'title', 'tit2', 'tt2'),
    file_tag_titlesort: tryGrabTags(rawTagData, 'title-sort', 'tsot'),
    file_tag_subtitle: tryGrabTags(rawTagData, 'subtitle', 'tit3', 'tt3'),
    file_tag_track: tryGrabTags(rawTagData, 'track', 'trck', 'trk'),
    file_tag_disc: tryGrabTags(rawTagData, 'discnumber', 'disc', 'disk', 'tpos', 'tpa'),
    file_tag_album: tryGrabTags(rawTagData, 'album', 'talb', 'tal'),
    file_tag_albumsort: tryGrabTags(rawTagData, 'album-sort', 'tsoa'),
    file_tag_artist: tryGrabTags(rawTagData, 'artist', 'tpe1', 'tp1'),
    file_tag_artistsort: tryGrabTags(rawTagData, 'artist-sort', 'tsop'),
    file_tag_albumartist: tryGrabTags(rawTagData, 'albumartist', 'album_artist', 'tpe2'),
    file_tag_date: tryGrabTags(rawTagData, 'date', 'tyer', 'tye'),
    file_tag_composer: tryGrabTags(rawTagData, 'composer', 'tcom', 'tcm'),
    file_tag_publisher: tryGrabTags(rawTagData, 'publisher', 'tpub', 'tpb'),
    file_tag_comment: tryGrabTags(rawTagData, 'comment', 'comm', 'com'),
    file_tag_description: tryGrabTags(rawTagData, 'description', 'desc'),
    file_tag_genre: tryGrabTags(rawTagData, 'genre', 'tcon', 'tco'),
    file_tag_series: tryGrabTags(rawTagData, 'series', 'show', 'mvnm'),
    file_tag_seriespart: tryGrabTags(rawTagData, 'series-part', 'episode_id', 'mvin', 'part'),
    file_tag_isbn: tryGrabTags(rawTagData, 'isbn'), // custom
    file_tag_language: tryGrabTags(rawTagData, 'language', 'lang'),
    file_tag_asin: tryGrabTags(rawTagData, 'asin', 'audible_asin', 'cdek'), // custom
    file_tag_itunesid: tryGrabTags(rawTagData, 'itunes-id'), // custom
    file_tag_podcasttype: tryGrabTags(rawTagData, 'podcast-type'), // custom
    file_tag_episodetype: tryGrabTags(rawTagData, 'episode-type'), // custom
    file_tag_originalyear: tryGrabTags(rawTagData, 'originalyear'),
    file_tag_releasecountry: tryGrabTags(rawTagData, 'MusicBrainz Album Release Country', 'releasecountry'),
    file_tag_releasestatus: tryGrabTags(rawTagData, 'MusicBrainz Album Status', 'releasestatus', 'musicbrainz_albumstatus'),
    file_tag_releasetype: tryGrabTags(rawTagData, 'MusicBrainz Album Type', 'releasetype', 'musicbrainz_albumtype'),
    file_tag_isrc: tryGrabTags(rawTagData, 'tsrc', 'isrc'),
    file_tag_musicbrainz_trackid: tryGrabTags(rawTagData, 'MusicBrainz Release Track Id', 'musicbrainz_releasetrackid'),
    file_tag_musicbrainz_albumid: tryGrabTags(rawTagData, 'MusicBrainz Album Id', 'musicbrainz_albumid'),
    file_tag_musicbrainz_albumartistid: tryGrabTags(rawTagData, 'MusicBrainz Album Artist Id', 'musicbrainz_albumartistid'),
    file_tag_musicbrainz_artistid: tryGrabTags(rawTagData, 'MusicBrainz Artist Id', 'musicbrainz_artistid'),

    // Not sure if these are actually used yet or not
    file_tag_creation_time: tryGrabTags(rawTagData, 'creation_time'),
    file_tag_wwwaudiofile: tryGrabTags(rawTagData, 'wwwaudiofile', 'woaf', 'waf'),
    file_tag_contentgroup: tryGrabTags(rawTagData, 'contentgroup', 'tit1', 'tt1'),
    file_tag_releasetime: tryGrabTags(rawTagData, 'releasetime', 'tdrl'),
    file_tag_movementname: tryGrabTags(rawTagData, 'movementname', 'mvnm'),
    file_tag_movement: tryGrabTags(rawTagData, 'movement', 'mvin'),
    file_tag_genre1: tryGrabTags(rawTagData, 'tmp_genre1', 'genre1'),
    file_tag_genre2: tryGrabTags(rawTagData, 'tmp_genre2', 'genre2'),
    file_tag_overdrive_media_marker: tryGrabTags(rawTagData, 'OverDrive MediaMarkers'),
  }
  for (const key in tags) {
    if (!tags[key]) {
      delete tags[key]
    }
  }

  return tags
}

function getDefaultAudioStream(audioStreams) {
  if (!audioStreams || !audioStreams.length) return null
  if (audioStreams.length === 1) return audioStreams[0]
  var defaultStream = audioStreams.find((a) => a.is_default)
  if (!defaultStream) return audioStreams[0]
  return defaultStream
}

function parseProbeData(data, mediaInfoTags, verbose = false) {
  try {
    const { format, streams, chapters } = data

    const sizeBytes = !isNaN(format.size) ? Number(format.size) : null
    const sizeMb = sizeBytes !== null ? Number((sizeBytes / (1024 * 1024)).toFixed(2)) : null

    let cleanedData = {
      format: format.format_long_name || format.name || 'Unknown',
      duration: !isNaN(format.duration) ? Number(format.duration) : null,
      size: sizeBytes,
      sizeMb,
      bit_rate: !isNaN(format.bit_rate) ? Number(format.bit_rate) : null,
      tags: parseTags(format, mediaInfoTags, verbose),
    }
    if (verbose && format.tags) {
      cleanedData.rawProbeTags = format.tags
      cleanedData.rawMediaInfoTags = mediaInfoTags.fields
    }

    const cleaned_streams = streams.map((s) => parseMediaStreamInfo(s, streams, cleanedData.bit_rate))
    cleanedData.video_stream = cleaned_streams.find((s) => s.type === 'video')
    const audioStreams = cleaned_streams.filter((s) => s.type === 'audio')
    cleanedData.audio_stream = getDefaultAudioStream(audioStreams)

    if (cleanedData.audio_stream && cleanedData.video_stream) {
      const videoBitrate = cleanedData.video_stream.bit_rate
      // If audio stream bitrate larger then video, most likely incorrect
      if (cleanedData.audio_stream.bit_rate > videoBitrate) {
        cleanedData.video_stream.bit_rate = cleanedData.bit_rate
      }
    }

    // If format does not have tags, check audio stream (https://github.com/advplyr/audiobookshelf/issues/256)
    if (!format.tags && cleanedData.audio_stream && cleanedData.audio_stream.tags) {
      cleanedData = {
        ...cleanedData,
        tags: parseTags(cleanedData.audio_stream, mediaInfoTags, verbose),
      }
    }

    cleanedData.chapters = parseChapters(chapters)

    return cleanedData
  } catch (error) {
    console.error('Parse failed', error)
    return null
  }
}

/**
 * Run ffprobe on audio filepath
 * @param {string} filepath
 * @param {boolean} [verbose=false]
 * @returns {Promise<import('../scanner/MediaProbeData')|{error:string}>}
 */
async function probe(filepath, verbose = false) {
  if (process.env.FFPROBE_PATH) {
    ffprobe.FFPROBE_PATH = process.env.FFPROBE_PATH
  }

  let unparsedProbeData
  try {
    const rawProbe = await ffprobe(filepath)
    if (rawProbe.error) {
      return {
        error: raw.error.string,
      }
    }
    unparsedProbeData = rawProbe
  } catch (error) {
    return {
      error: error,
    }
  }

  let mediaInfoTags
  try {
    let rawMediaInfo = await mediaInfoHelpers.mediaInfoDump(filepath)
    mediaInfoTags = mediaInfoHelpers.extractTags(rawMediaInfo)
  } catch (error) {
    // Currently mediainfo will not throw, but keeping this here for posterity
    return {
      error: error.toString(),
    }
  }

  const rawProbeData = parseProbeData(unparsedProbeData, mediaInfoTags, verbose)
  if (!rawProbeData || (!rawProbeData.audio_stream && !rawProbeData.video_stream)) {
    return {
      error: rawProbeData ? 'Invalid media file: no audio or video streams found' : 'Probe Failed',
    }
  } else {
    const probeData = new MediaProbeData()
    probeData.setData(rawProbeData)
    return probeData
  }
}
module.exports.probe = probe

/**
 * Ffprobe for audio file path
 *
 * @param {string} filepath
 * @returns {Object} ffprobe json output
 */
function rawProbe(filepath) {
  if (process.env.FFPROBE_PATH) {
    ffprobe.FFPROBE_PATH = process.env.FFPROBE_PATH
  }

  return ffprobe(filepath).catch((err) => {
    return {
      error: err,
    }
  })
}
module.exports.rawProbe = rawProbe
