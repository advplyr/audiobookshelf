const Ffmpeg = require('fluent-ffmpeg')
const Path = require('path')
const fs = require('fs-extra')
const Logger = require('./Logger')
const { secondsToTimestamp } = require('./utils/fileUtils')

function escapeSingleQuotes(path) {
  return path.replace(/\\/g, '/').replace(/ /g, '\\ ').replace(/'/g, '\\\'')
}

function getNumSegments(audiobook, segmentLength) {
  var numSegments = Math.floor(audiobook.totalDuration / segmentLength)
  var remainingTime = audiobook.totalDuration - (numSegments * segmentLength)
  if (remainingTime > 0) numSegments++
  return numSegments
}

async function start(audiobook, startTime = 0, segmentLength = 6) {
  var testDir = Path.join(global.appRoot, 'test', audiobook.id)
  var existsAlready = await fs.pathExists(testDir)
  if (existsAlready) {
    await fs.remove(testDir).then(() => {
      Logger.info('Deleted test dir data', testDir)
    }).catch((err) => {
      Logger.error('Failed to delete test dir', err)
    })
  }

  fs.ensureDirSync(testDir)
  var concatFilePath = Path.join(testDir, 'concat.txt')
  var playlistPath = Path.join(testDir, 'output.m3u8')


  const numSegments = getNumSegments(audiobook, segmentLength)
  const segmentStartNumber = Math.floor(startTime / segmentLength)
  Logger.info(`[STREAM] START STREAM - Num Segments: ${numSegments} - Segment Start: ${segmentStartNumber}`)

  const tracks = audiobook.tracks

  const ffmpeg = Ffmpeg()

  var currTrackEnd = 0

  var startingTrack = tracks.find(t => {
    currTrackEnd += t.duration
    return startTime < currTrackEnd
  })
  var trackStartTime = currTrackEnd - startingTrack.duration
  var currInpoint = startTime - trackStartTime
  Logger.info('Starting Track Index', startingTrack.index)

  var tracksToInclude = tracks.filter(t => t.index >= startingTrack.index)
  var trackPaths = tracksToInclude.map(t => {
    var line = 'file ' + escapeSingleQuotes(t.fullPath) + '\n' + `duration ${t.duration}`
    // if (t.index === startingTrack.index) {
    // currInpoint = 60 * 5 + 4
    // line += `\ninpoint ${currInpoint}`
    // }
    return line
  })

  var inputstr = trackPaths.join('\n\n')
  await fs.writeFile(concatFilePath, inputstr)

  ffmpeg.addInput(concatFilePath)
  ffmpeg.inputFormat('concat')
  ffmpeg.inputOption('-safe 0')

  var shiftedStartTime = startTime - trackStartTime
  if (startTime > 0) {
    Logger.info(`[STREAM] Starting Stream at startTime ${secondsToTimestamp(startTime)} and Segment #${segmentStartNumber}`)
    ffmpeg.inputOption(`-ss ${shiftedStartTime}`)
    ffmpeg.inputOption('-noaccurate_seek')
  }

  ffmpeg.addOption([
    '-loglevel warning',
    '-map 0:a',
    '-c:a copy'
  ])
  ffmpeg.addOption([
    '-f hls',
    "-copyts",
    "-avoid_negative_ts disabled",
    "-max_delay 5000000",
    "-max_muxing_queue_size 2048",
    `-hls_time 6`,
    "-hls_segment_type mpegts",
    `-start_number ${segmentStartNumber}`,
    "-hls_playlist_type vod",
    "-hls_list_size 0",
    "-hls_allow_cache 0"
  ])
  var segmentFilename = Path.join(testDir, 'output-%d.ts')
  ffmpeg.addOption(`-hls_segment_filename ${segmentFilename}`)
  ffmpeg.output(playlistPath)

  ffmpeg.on('start', (command) => {
    Logger.info('[FFMPEG-START] FFMPEG transcoding started with command: ' + command)
  })
  ffmpeg.on('stderr', (stdErrline) => {
    Logger.info('[FFMPEG-STDERR]', stdErrline)
  })
  ffmpeg.on('error', (err, stdout, stderr) => {
    Logger.info('[FFMPEG-ERROR]', err)
  })
  ffmpeg.on('end', (stdout, stderr) => {
    Logger.info('[FFMPEG] Transcode ended')
  })
  ffmpeg.run()
}
module.exports.start = start