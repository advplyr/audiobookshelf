//
// node-ffprobe modified for audiobookshelf
// SOURCE: https://github.com/ListenerApproved/node-ffprobe
//

const spawn = require('child_process').spawn

module.exports = (function () {
  function doProbe(file) {
    return new Promise((resolve, reject) => {
      let proc = spawn(module.exports.FFPROBE_PATH || 'ffprobe', ['-hide_banner', '-loglevel', 'fatal', '-show_error', '-show_format', '-show_streams', '-show_programs', '-show_chapters', '-show_private_data', '-print_format', 'json', file])
      let probeData = []
      let errData = []

      proc.stdout.setEncoding('utf8')
      proc.stderr.setEncoding('utf8')

      proc.stdout.on('data', function (data) { probeData.push(data) })
      proc.stderr.on('data', function (data) { errData.push(data) })

      proc.on('exit', code => { exitCode = code })
      proc.on('error', err => reject(err))
      proc.on('close', () => {
        try {
            resolve(JSON.parse(probeData.join('')))
        } catch (err) {
            reject(err);
        }
      })
    })
  }

  return doProbe
})()