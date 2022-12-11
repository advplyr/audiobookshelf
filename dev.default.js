// DO NOT MODIFY THIS FILE
// Copy this file to dev.js to make modifications

const Path = require('path')
module.exports.config = {
  Port: 3333, // Using port 3333 is important when running the client web app separately
  ConfigPath: Path.resolve('config'),
  MetadataPath: Path.resolve('metadata'),
  FFmpegPath: 'ffmpeg', // On Windows, use 'C:\\<path_to_ffmpeg>\\ffmpeg.exe'
  FFProbePath: 'ffprobe'
}
