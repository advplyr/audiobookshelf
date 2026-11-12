//
// node-ffprobe modified for audiobookshelf
// SOURCE: https://github.com/ListenerApproved/node-ffprobe
//

import { spawn } from 'node:child_process'

interface Probe {
  (file: string): Promise<unknown>
  FFPROBE_PATH?: string
}

declare const module: { exports: Probe }

const ffprobe: Probe = (function () {
  function doProbe(file: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let proc = spawn(module.exports.FFPROBE_PATH || 'ffprobe', ['-hide_banner', '-loglevel', 'fatal', '-show_error', '-show_format', '-show_streams', '-show_programs', '-show_chapters', '-show_private_data', '-print_format', 'json', file])
      const probeData: string[] = []
      const errData: string[] = []

      proc.stdout.setEncoding('utf8')
      proc.stderr.setEncoding('utf8')

      proc.stdout.on('data', function (data: string) {
        probeData.push(data)
      })
      proc.stderr.on('data', function (data: string) {
        errData.push(data)
      })

      proc.on('error', (err) => reject(err))
      proc.on('close', () => {
        try {
          // The application interprets the probe's JSON output.
          const result: unknown = JSON.parse(probeData.join(''))
          resolve(result)
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse ffprobe output', { cause: err }))
        }
      })
    })
  }

  return doProbe
})()

export = ffprobe
