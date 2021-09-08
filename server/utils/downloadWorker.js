const Ffmpeg = require('fluent-ffmpeg')

if (process.env.NODE_ENV !== 'production') {
  Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
}

const { parentPort, workerData } = require("worker_threads")
const Logger = require('../Logger')

Logger.info('[DownloadWorker] Starting Worker...')


const ffmpegCommand = Ffmpeg()
const startTime = Date.now()

workerData.inputs.forEach((inputData) => {
  ffmpegCommand.input(inputData.input)
  if (inputData.options) ffmpegCommand.inputOption(inputData.options)
})

if (workerData.options) ffmpegCommand.addOption(workerData.options)
ffmpegCommand.output(workerData.output)

var isKilled = false

async function runFfmpeg() {
  var success = await new Promise((resolve) => {
    ffmpegCommand.on('start', (command) => {
      Logger.info('[DownloadWorker] FFMPEG concat started with command: ' + command)
    })

    ffmpegCommand.on('stderr', (stdErrline) => {
      Logger.info(stdErrline)
    })

    ffmpegCommand.on('error', (err, stdout, stderr) => {
      if (err.message && err.message.includes('SIGKILL')) {
        // This is an intentional SIGKILL
        Logger.info('[DownloadWorker] User Killed singleAudio')
      } else {
        Logger.error('[DownloadWorker] Ffmpeg Err', err.message)
      }
      resolve(false)
    })

    ffmpegCommand.on('end', (stdout, stderr) => {
      Logger.info('[DownloadWorker] singleAudio ended')
      resolve(true)
    })
    ffmpegCommand.run()
  })

  var resultMessage = {
    type: 'RESULT',
    isKilled,
    elapsed: Date.now() - startTime,
    success
  }
  parentPort.postMessage(resultMessage)
}

parentPort.on('message', (message) => {
  if (message === 'STOP') {
    Logger.info('[DownloadWorker] Requested a hard stop')
    isKilled = true
    ffmpegCommand.kill()
  }
})

runFfmpeg()