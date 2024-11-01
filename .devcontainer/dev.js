// Using port 3333 is important when running the client web app separately
const Path = require('path')
module.exports.config = {
  Port: 3333,
  ConfigPath: Path.resolve('config'),
  MetadataPath: Path.resolve('metadata'),
  FFmpegPath: '/usr/bin/ffmpeg',
  FFProbePath: '/usr/bin/ffprobe',
  SkipBinariesCheck: false
}
