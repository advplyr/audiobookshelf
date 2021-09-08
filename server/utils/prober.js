var Ffmpeg = require('fluent-ffmpeg')

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
    var bps = Math.floor(Number(tagBytes) * 8 / Number(tagDuration))
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
    if (!all_streams.find(s => s.codec_type === 'audio' && s.bit_rate && Number(s.bit_rate) > estimated_bit_rate)) {
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

function tryGrabTag(stream, tag) {
  if (!stream.tags) return null
  return stream.tags[tag] || stream.tags[tag.toUpperCase()] || null
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
    language: tryGrabTag(stream, 'language'),
    title: tryGrabTag(stream, 'title')
  }

  if (info.type === 'audio' || info.type === 'subtitle') {
    var disposition = stream.disposition || {}
    info.is_default = disposition.default === 1 || disposition.default === '1'
  }

  if (info.type === 'video') {
    info.profile = stream.profile || null
    info.is_avc = (stream.is_avc !== '0' && stream.is_avc !== 'false')
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

function parseChapters(chapters) {
  if (!chapters) return []
  return chapters.map(chap => {
    var title = chap['TAG:title'] || chap.title
    var timebase = chap.time_base && chap.time_base.includes('/') ? Number(chap.time_base.split('/')[1]) : 1
    return {
      id: chap.id,
      start: !isNaN(chap.start_time) ? chap.start_time : (chap.start / timebase),
      end: chap.end_time || (chap.end / timebase),
      title
    }
  })
}

function parseProbeData(data) {
  try {
    var { format, streams, chapters } = data
    var { format_long_name, duration, size, bit_rate } = format

    var sizeBytes = !isNaN(size) ? Number(size) : null
    var sizeMb = sizeBytes !== null ? Number((sizeBytes / (1024 * 1024)).toFixed(2)) : null
    var cleanedData = {
      format: format_long_name,
      duration: !isNaN(duration) ? Number(duration) : null,
      size: sizeBytes,
      sizeMb,
      bit_rate: !isNaN(bit_rate) ? Number(bit_rate) : null,
      file_tag_encoder: tryGrabTag(format, 'encoder') || tryGrabTag(format, 'encoded_by'),
      file_tag_title: tryGrabTag(format, 'title'),
      file_tag_track: tryGrabTag(format, 'track') || tryGrabTag(format, 'trk'),
      file_tag_album: tryGrabTag(format, 'album') || tryGrabTag(format, 'tal'),
      file_tag_artist: tryGrabTag(format, 'artist') || tryGrabTag(format, 'tp1'),
      file_tag_date: tryGrabTag(format, 'date') || tryGrabTag(format, 'tye'),
      file_tag_genre: tryGrabTag(format, 'genre'),
      file_tag_creation_time: tryGrabTag(format, 'creation_time')
    }

    const cleaned_streams = streams.map(s => parseMediaStreamInfo(s, streams, cleanedData.bit_rate))
    cleanedData.video_stream = cleaned_streams.find(s => s.type === 'video')
    cleanedData.audio_streams = cleaned_streams.filter(s => s.type === 'audio')
    cleanedData.subtitle_streams = cleaned_streams.filter(s => s.type === 'subtitle')

    if (cleanedData.audio_streams.length && cleanedData.video_stream) {
      var videoBitrate = cleanedData.video_stream.bit_rate
      // If audio stream bitrate larger then video, most likely incorrect
      if (cleanedData.audio_streams.find(astream => astream.bit_rate > videoBitrate)) {
        cleanedData.video_stream.bit_rate = cleanedData.bit_rate
      }
    }

    cleanedData.chapters = parseChapters(chapters)

    return cleanedData
  } catch (error) {
    console.error('Parse failed', error)
    return null
  }
}

function probe(filepath) {
  return new Promise((resolve) => {
    Ffmpeg.ffprobe(filepath, ['-show_chapters'], (err, raw) => {
      if (err) {
        console.error(err)
        resolve(null)
      } else {
        resolve(parseProbeData(raw))
      }
    })
  })
}
module.exports = probe