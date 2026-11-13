const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const path = require('path')

const prober = require('../../../server/utils/prober')

describe('prober', () => {
  let dir
  let argsFile
  let previousFfprobePath

  // A stand-in ffprobe that records its arguments and prints the probe of an M4B whose
  // series is only in the MP4 movement atoms, as ffprobe reports them with -export_all
  beforeEach(function () {
    if (process.platform === 'win32') this.skip()
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abs-prober-'))
    argsFile = path.join(dir, 'args.json')
    const output = {
      format: {
        format_long_name: 'QuickTime / MOV',
        duration: '1.0',
        size: '9970',
        bit_rate: '79760',
        tags: { album: 'Galaktogon 3', '[169]mvn': 'Galaktogon', '[169]mvi': '3' }
      },
      streams: [{ index: 0, codec_type: 'audio', codec_name: 'aac', bit_rate: '69000', channels: 1, sample_rate: '44100' }],
      chapters: []
    }
    const fakeFfprobe = path.join(dir, 'ffprobe')
    fs.writeFileSync(fakeFfprobe, `#!/usr/bin/env node\nrequire('fs').writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)))\nprocess.stdout.write(${JSON.stringify(JSON.stringify(output))})\n`, { mode: 0o755 })
    previousFfprobePath = process.env.FFPROBE_PATH
    process.env.FFPROBE_PATH = fakeFfprobe
  })

  afterEach(() => {
    if (previousFfprobePath === undefined) delete process.env.FFPROBE_PATH
    else process.env.FFPROBE_PATH = previousFfprobePath
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('asks ffprobe for unrecognized MP4 atoms', async () => {
    await prober.probe('/books/Galaktogon 3.m4b')

    const args = JSON.parse(fs.readFileSync(argsFile, 'utf8'))
    expect(args[args.indexOf('-export_all') + 1]).to.equal('1')
  })

  it('reads the MP4 movement atoms as series and series sequence', async () => {
    const probeData = await prober.probe('/books/Galaktogon 3.m4b')

    expect(probeData.error).to.be.undefined
    expect(probeData.audioMetaTags.tagSeries).to.equal('Galaktogon')
    expect(probeData.audioMetaTags.tagSeriesPart).to.equal('3')
  })
})
