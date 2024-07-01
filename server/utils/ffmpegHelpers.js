const axios = require('axios')
const Ffmpeg = require('../libs/fluentFfmpeg')
const fs = require('../libs/fsExtra')
const os = require('os')
const Path = require('path')
const Logger = require('../Logger')
const { filePathToPOSIX } = require('./fileUtils')

function escapeSingleQuotes(path) {
  // return path.replace(/'/g, '\'\\\'\'')
  return filePathToPOSIX(path).replace(/ /g, '\\ ').replace(/'/g, "\\'")
}

// Returns first track start time
// startTime is for streams starting an encode part-way through an audiobook
async function writeConcatFile(tracks, outputPath, startTime = 0) {
  var trackToStartWithIndex = 0
  var firstTrackStartTime = 0

  // Find first track greater than startTime
  if (startTime > 0) {
    var currTrackEnd = 0
    var startingTrack = tracks.find((t) => {
      currTrackEnd += t.duration
      return startTime < currTrackEnd
    })
    if (startingTrack) {
      firstTrackStartTime = currTrackEnd - startingTrack.duration
      trackToStartWithIndex = startingTrack.index
    }
  }

  var tracksToInclude = tracks.filter((t) => t.index >= trackToStartWithIndex)
  var trackPaths = tracksToInclude.map((t) => {
    var line = 'file ' + escapeSingleQuotes(t.metadata.path) + '\n' + `duration ${t.duration}`
    return line
  })
  var inputstr = trackPaths.join('\n\n')

  try {
    await fs.writeFile(outputPath, inputstr)
    return firstTrackStartTime
  } catch (error) {
    Logger.error(`[ffmpegHelpers] Failed to write stream concat file at "${outputPath}"`, error)
    return null
  }
}
module.exports.writeConcatFile = writeConcatFile

async function extractCoverArt(filepath, outputpath) {
  var dirname = Path.dirname(outputpath)
  await fs.ensureDir(dirname)

  return new Promise((resolve) => {
    var ffmpeg = Ffmpeg(filepath)
    ffmpeg.addOption(['-map 0:v', '-frames:v 1'])
    ffmpeg.output(outputpath)

    ffmpeg.on('start', (cmd) => {
      Logger.debug(`[FfmpegHelpers] Extract Cover Cmd: ${cmd}`)
    })
    ffmpeg.on('error', (err, stdout, stderr) => {
      Logger.error(`[FfmpegHelpers] Extract Cover Error ${err}`)
      resolve(false)
    })
    ffmpeg.on('end', () => {
      Logger.debug(`[FfmpegHelpers] Cover Art Extracted Successfully`)
      resolve(outputpath)
    })
    ffmpeg.run()
  })
}
module.exports.extractCoverArt = extractCoverArt

//This should convert based on the output file extension as well
async function resizeImage(filePath, outputPath, width, height) {
  return new Promise((resolve) => {
    var ffmpeg = Ffmpeg(filePath)
    ffmpeg.addOption(['-vf', `scale=${width || -1}:${height || -1}`])
    ffmpeg.addOutput(outputPath)
    ffmpeg.on('start', (cmd) => {
      Logger.debug(`[FfmpegHelpers] Resize Image Cmd: ${cmd}`)
    })
    ffmpeg.on('error', (err, stdout, stderr) => {
      Logger.error(`[FfmpegHelpers] Resize Image Error ${err} ${stdout} ${stderr}`)
      resolve(false)
    })
    ffmpeg.on('end', () => {
      Logger.debug(`[FfmpegHelpers] Image resized Successfully`)
      resolve(outputPath)
    })
    ffmpeg.run()
  })
}
module.exports.resizeImage = resizeImage

module.exports.downloadPodcastEpisode = (podcastEpisodeDownload) => {
  return new Promise(async (resolve) => {
    const response = await axios({
      url: podcastEpisodeDownload.url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'audiobookshelf (+https://audiobookshelf.org; like iTMS)'
      },
      timeout: 30000
    }).catch((error) => {
      Logger.error(`[ffmpegHelpers] Failed to download podcast episode with url "${podcastEpisodeDownload.url}"`, error)
      return null
    })
    if (!response) return resolve(false)

    const ffmpeg = Ffmpeg(response.data)
    ffmpeg.addOption('-loglevel debug') // Debug logs printed on error
    ffmpeg.outputOptions('-c:a', 'copy', '-map', '0:a', '-metadata', 'podcast=1')

    const podcastMetadata = podcastEpisodeDownload.libraryItem.media.metadata
    const podcastEpisode = podcastEpisodeDownload.podcastEpisode
    const finalSizeInBytes = Number(podcastEpisode.enclosure?.length || 0)

    const taggings = {
      album: podcastMetadata.title,
      'album-sort': podcastMetadata.title,
      artist: podcastMetadata.author,
      'artist-sort': podcastMetadata.author,
      comment: podcastEpisode.description,
      subtitle: podcastEpisode.subtitle,
      disc: podcastEpisode.season,
      genre: podcastMetadata.genres.length ? podcastMetadata.genres.join(';') : null,
      language: podcastMetadata.language,
      MVNM: podcastMetadata.title,
      MVIN: podcastEpisode.episode,
      track: podcastEpisode.episode,
      'series-part': podcastEpisode.episode,
      title: podcastEpisode.title,
      'title-sort': podcastEpisode.title,
      year: podcastEpisode.pubYear,
      date: podcastEpisode.pubDate,
      releasedate: podcastEpisode.pubDate,
      'itunes-id': podcastMetadata.itunesId,
      'podcast-type': podcastMetadata.type,
      'episode-type': podcastMetadata.episodeType
    }

    for (const tag in taggings) {
      if (taggings[tag]) {
        if (taggings[tag].length > 10000) {
          Logger.warn(`[ffmpegHelpers] Episode download tag "${tag}" is too long (${taggings[tag].length} characters) - trimming it down`)
          taggings[tag] = taggings[tag].slice(0, 10000)
        }
        ffmpeg.addOption('-metadata', `${tag}=${taggings[tag]}`)
      }
    }

    ffmpeg.addOutput(podcastEpisodeDownload.targetPath)

    const stderrLines = []
    ffmpeg.on('stderr', (stderrLine) => {
      if (typeof stderrLine === 'string') {
        stderrLines.push(stderrLine)
      }
    })
    ffmpeg.on('start', (cmd) => {
      Logger.debug(`[FfmpegHelpers] downloadPodcastEpisode: Cmd: ${cmd}`)
    })
    ffmpeg.on('error', (err) => {
      Logger.error(`[FfmpegHelpers] downloadPodcastEpisode: Error ${err}`)
      if (stderrLines.length) {
        Logger.error(`Full stderr dump for episode url "${podcastEpisodeDownload.url}": ${stderrLines.join('\n')}`)
      }
      resolve(false)
    })
    ffmpeg.on('progress', (progress) => {
      let progressPercent = 0
      if (finalSizeInBytes && progress.targetSize && !isNaN(progress.targetSize)) {
        const finalSizeInKb = Math.floor(finalSizeInBytes / 1000)
        progressPercent = Math.min(1, progress.targetSize / finalSizeInKb) * 100
      }
      Logger.debug(`[FfmpegHelpers] downloadPodcastEpisode: Progress estimate ${progressPercent.toFixed(0)}% (${progress?.targetSize || 'N/A'} KB) for "${podcastEpisodeDownload.url}"`)
    })
    ffmpeg.on('end', () => {
      Logger.debug(`[FfmpegHelpers] downloadPodcastEpisode: Complete`)
      resolve(podcastEpisodeDownload.targetPath)
    })
    ffmpeg.run()
  })
}

/**
 * Generates ffmetadata file content from the provided metadata object and chapters array.
 * @param {Object} metadata - The input metadata object.
 * @param {Array|null} chapters - An array of chapter objects.
 * @returns {string} - The ffmetadata file content.
 */
function generateFFMetadata(metadata, chapters) {
  let ffmetadataContent = ';FFMETADATA1\n'

  // Add global metadata
  for (const key in metadata) {
    if (metadata[key]) {
      ffmetadataContent += `${key}=${escapeFFMetadataValue(metadata[key])}\n`
    }
  }

  // Add chapters
  if (chapters) {
    chapters.forEach((chapter) => {
      ffmetadataContent += '\n[CHAPTER]\n'
      ffmetadataContent += `TIMEBASE=1/1000\n`
      ffmetadataContent += `START=${Math.floor(chapter.start * 1000)}\n`
      ffmetadataContent += `END=${Math.floor(chapter.end * 1000)}\n`
      if (chapter.title) {
        ffmetadataContent += `title=${escapeFFMetadataValue(chapter.title)}\n`
      }
    })
  }

  return ffmetadataContent
}

module.exports.generateFFMetadata = generateFFMetadata

/**
 * Adds an ffmetadata and optionally a cover image to an audio file using fluent-ffmpeg.
 * @param {string} audioFilePath - Path to the input audio file.
 * @param {string|null} coverFilePath - Path to the cover image file.
 * @param {string} metadataFilePath - Path to the ffmetadata file.
 * @param {number} track - The track number to embed in the audio file.
 * @param {string} mimeType - The MIME type of the audio file.
 */
async function addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType) {
  const isMp4 = mimeType === 'audio/mp4'
  const isMp3 = mimeType === 'audio/mpeg'

  const audioFileDir = Path.dirname(audioFilePath)
  const audioFileExt = Path.extname(audioFilePath)
  const audioFileBaseName = Path.basename(audioFilePath, audioFileExt)
  const tempFilePath = Path.join(audioFileDir, `${audioFileBaseName}.tmp${audioFileExt}`)

  return new Promise((resolve) => {
    let ffmpeg = Ffmpeg()
    ffmpeg.input(audioFilePath).input(metadataFilePath).outputOptions([
      '-map 0:a', // map audio stream from input file
      '-map_metadata 1', // map metadata tags from metadata file first
      '-map_metadata 0', // add additional metadata tags from input file
      '-map_chapters 1', // map chapters from metadata file
      '-c copy' // copy streams
    ])

    if (track && !isNaN(track)) {
      ffmpeg.outputOptions(['-metadata track=' + track])
    }

    if (isMp4) {
      ffmpeg.outputOptions([
        '-f mp4' // force output format to mp4
      ])
    } else if (isMp3) {
      ffmpeg.outputOptions([
        '-id3v2_version 3' // set ID3v2 version to 3
      ])
    }

    if (coverFilePath) {
      ffmpeg.input(coverFilePath).outputOptions([
        '-map 2:v', // map video stream from cover image file
        '-disposition:v:0 attached_pic', // set cover image as attached picture
        '-metadata:s:v',
        'title=Cover', // add title metadata to cover image stream
        '-metadata:s:v',
        'comment=Cover' // add comment metadata to cover image stream
      ])
    } else {
      ffmpeg.outputOptions([
        '-map 0:v?' // retain video stream from input file if exists
      ])
    }

    ffmpeg
      .output(tempFilePath)
      .on('start', function (commandLine) {
        Logger.debug('[ffmpegHelpers] Spawned Ffmpeg with command: ' + commandLine)
      })
      .on('end', (stdout, stderr) => {
        Logger.debug('[ffmpegHelpers] ffmpeg stdout:', stdout)
        Logger.debug('[ffmpegHelpers] ffmpeg stderr:', stderr)
        fs.copyFileSync(tempFilePath, audioFilePath)
        fs.unlinkSync(tempFilePath)
        resolve(true)
      })
      .on('error', (err, stdout, stderr) => {
        Logger.error('Error adding cover image and metadata:', err)
        Logger.error('ffmpeg stdout:', stdout)
        Logger.error('ffmpeg stderr:', stderr)
        resolve(false)
      })

    ffmpeg.run()
  })
}

module.exports.addCoverAndMetadataToFile = addCoverAndMetadataToFile

function escapeFFMetadataValue(value) {
  return value.replace(/([;=\n\\#])/g, '\\$1')
}

function getFFMetadataObject(libraryItem, audioFilesLength) {
  const metadata = libraryItem.media.metadata

  const ffmetadata = {
    title: metadata.title,
    artist: metadata.authorName,
    album_artist: metadata.authorName,
    album: (metadata.title || '') + (metadata.subtitle ? `: ${metadata.subtitle}` : ''),
    TIT3: metadata.subtitle, // mp3 only
    genre: metadata.genres?.join('; '),
    date: metadata.publishedYear,
    comment: metadata.description,
    description: metadata.description,
    composer: metadata.narratorName,
    copyright: metadata.publisher,
    publisher: metadata.publisher, // mp3 only
    TRACKTOTAL: `${audioFilesLength}`, // mp3 only
    grouping: metadata.series?.map((s) => s.name + (s.sequence ? ` #${s.sequence}` : '')).join(', ')
  }

  Object.keys(ffmetadata).forEach((key) => {
    if (!ffmetadata[key]) {
      delete ffmetadata[key]
    }
  })

  return ffmetadata
}

module.exports.getFFMetadataObject = getFFMetadataObject
