const Ffmpeg = require('fluent-ffmpeg')

if (process.env.FFMPEG_PATH) {
  Ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
}

const { parentPort, workerData } = require("worker_threads")

parentPort.postMessage({
  type: 'FFMPEG',
  level: 'debug',
  log: '[DownloadWorker] Starting Worker...'
})

const ffmpegCommand = Ffmpeg()
const startTime = Date.now()

workerData.inputs.forEach((inputData) => {
  ffmpegCommand.input(inputData.input)
  if (inputData.options) ffmpegCommand.inputOption(inputData.options)
})

if (workerData.options) ffmpegCommand.addOption(workerData.options)
if (workerData.outputOptions && workerData.outputOptions.length) ffmpegCommand.addOutputOption(workerData.outputOptions)
ffmpegCommand.output(workerData.output)

var isKilled = false

async function runFfmpeg() {
  var success = await new Promise((resolve) => {
    ffmpegCommand.on('start', (command) => {
      parentPort.postMessage({
        type: 'FFMPEG',
        level: 'info',
        log: '[DownloadWorker] FFMPEG concat started with command: ' + command
      })
    })

    ffmpegCommand.on('stderr', (stdErrline) => {
      parentPort.postMessage({
        type: 'FFMPEG',
        level: 'debug',
        log: '[DownloadWorker] Ffmpeg Stderr: ' + stdErrline
      })
    })

    ffmpegCommand.on('error', (err, stdout, stderr) => {
      if (err.message && err.message.includes('SIGKILL')) {
        // This is an intentional SIGKILL
        parentPort.postMessage({
          type: 'FFMPEG',
          level: 'info',
          log: '[DownloadWorker] User Killed worker'
        })
      } else {
        parentPort.postMessage({
          type: 'FFMPEG',
          level: 'error',
          log: '[DownloadWorker] Ffmpeg Err: ' + err.message
        })
      }
      resolve(false)
    })

    ffmpegCommand.on('end', (stdout, stderr) => {
      parentPort.postMessage({
        type: 'FFMPEG',
        level: 'info',
        log: '[DownloadWorker] worker ended'
      })
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
    isKilled = true
    ffmpegCommand.kill()
  }
})

runFfmpeg()