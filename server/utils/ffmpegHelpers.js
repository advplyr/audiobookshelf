const axios = require('axios')
const Ffmpeg = require('../libs/fluentFfmpeg')
const fs = require('../libs/fsExtra')
const Path = require('path')
const Logger = require('../Logger')
const { filePathToPOSIX } = require('./fileUtils')

function escapeSingleQuotes(path) {
  // return path.replace(/'/g, '\'\\\'\'')
  return filePathToPOSIX(path).replace(/ /g, '\\ ').replace(/'/g, '\\\'')
}

// Returns first track start time
// startTime is for streams starting an encode part-way through an audiobook
async function writeConcatFile(tracks, outputPath, startTime = 0) {
  var trackToStartWithIndex = 0
  var firstTrackStartTime = 0

  // Find first track greater than startTime
  if (startTime > 0) {
    var currTrackEnd = 0
    var startingTrack = tracks.find(t => {
      currTrackEnd += t.duration
      return startTime < currTrackEnd
    })
    if (startingTrack) {
      firstTrackStartTime = currTrackEnd - startingTrack.duration
      trackToStartWithIndex = startingTrack.index
    }
  }

  var tracksToInclude = tracks.filter(t => t.index >= trackToStartWithIndex)
  var trackPaths = tracksToInclude.map(t => {
    var line = 'file ' + escapeSingleQuotes(t.metadata.path) + '\n' + `duration ${t.duration}`
    return line
  })
  var inputstr = trackPaths.join('\n\n')
  await fs.writeFile(outputPath, inputstr)

  return firstTrackStartTime
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
      timeout: 30000
    })

    const ffmpeg = Ffmpeg(response.data)
    ffmpeg.outputOptions([
      '-c copy',
      '-metadata',
      `album=${podcastEpisodeDownload.libraryItem?.media.metadata.title ?? ""}`, // Podcast Title
      '-metadata',
      `album-sort=${podcastEpisodeDownload.libraryItem?.media.metadata.title ?? ""}`, // Podcast Title
      '-metadata',
      `artist=${podcastEpisodeDownload.libraryItem?.media.metadata.author ?? ""}`, // Podcast Artist
      '-metadata',
      `artist-sort=${podcastEpisodeDownload.libraryItem?.media.metadata.author ?? ""}`, // Podcast Artist
      '-metadata',
      `comment=${podcastEpisodeDownload.podcastEpisode?.description ?? ""}`, // Episode Description
      '-metadata',
      `description=${podcastEpisodeDownload.podcastEpisode?.subtitle ?? ""}`, // Episode Subtitle
      '-metadata',
      `disc=${podcastEpisodeDownload.podcastEpisode?.season ?? ""}`, // Episode Season
      '-metadata',
      `genre=${podcastEpisodeDownload.libraryItem?.media.metadata.genres.join(';') ?? ""}`, // Podcast Genres
      '-metadata',
      `language=${podcastEpisodeDownload.libraryItem?.media.metadata.language ?? ""}`, // Podcast Language
      '-metadata',
      `MVNM=${podcastEpisodeDownload.libraryItem?.media.metadata.title ?? ""}`, // Podcast Title
      '-metadata',
      `MVIN=${podcastEpisodeDownload.podcastEpisode?.episode ?? ""}`, // Episode Number
      '-metadata',
      `track=${podcastEpisodeDownload.podcastEpisode?.episode ?? ""}`, // Episode Number
      '-metadata',
      `series-part=${podcastEpisodeDownload.podcastEpisode?.episode ?? ""}`, // Episode Number
      '-metadata',
      `podcast=1`,
      '-metadata',
      `title=${podcastEpisodeDownload.podcastEpisode?.title ?? ""}`, // Episode Title
      '-metadata',
      `title-sort=${podcastEpisodeDownload.podcastEpisode?.title ?? ""}`, // Episode Title
      '-metadata',
      `year=${podcastEpisodeDownload.podcastEpisode?.pubYear ?? ""}`, // Episode Pub Year
      '-metadata',
      `date=${podcastEpisodeDownload.podcastEpisode?.pubDate ?? ""}`, // Episode PubDate
      '-metadata',
      `releasedate=${podcastEpisodeDownload.podcastEpisode?.pubDate ?? ""}`, // Episode PubDate
      '-metadata',
      `itunes-id=${podcastEpisodeDownload.libraryItem?.media.metadata.itunesId ?? ""}`, // Podcast iTunes ID
      '-metadata',
      `podcast-type=${podcastEpisodeDownload.libraryItem?.media.metadata.type ?? ""}`, // Podcast Type
      '-metadata',
      `episode-type=${podcastEpisodeDownload.podcastEpisode?.episodeType ?? ""}` // Episode Type
    ])
    ffmpeg.addOutput(podcastEpisodeDownload.targetPath)

    ffmpeg.on('start', (cmd) => {
      Logger.debug(`[FfmpegHelpers] downloadPodcastEpisode: Cmd: ${cmd}`)
    })
    ffmpeg.on('error', (err, stdout, stderr) => {
      Logger.error(`[FfmpegHelpers] downloadPodcastEpisode: Error ${err} ${stdout} ${stderr}`)
      resolve(false)
    })
    ffmpeg.on('end', () => {
      Logger.debug(`[FfmpegHelpers] downloadPodcastEpisode: Complete`)
      resolve(podcastEpisodeDownload.targetPath)
    })
    ffmpeg.run()
  })
}