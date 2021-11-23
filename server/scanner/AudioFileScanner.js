const AudioFile = require('../objects/AudioFile')
const AudioProbeData = require('./AudioProbeData')

const prober = require('../utils/prober')
const Logger = require('../Logger')

class AudioFileScanner {
  constructor() { }

  async scan(audioFileData, verbose = false) {
    var probeData = await prober.probe2(audioFileData.fullPath, verbose)
    if (probeData.error) {
      Logger.error(`[AudioFileScanner] ${probeData.error} : "${audioFileData.fullPath}"`)
      return null
    }

    var audioFile = new AudioFile()
    // TODO: Build audio file
    return audioFile
  }
}
module.exports = new AudioFileScanner()