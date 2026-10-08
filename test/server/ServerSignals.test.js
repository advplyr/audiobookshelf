const { expect } = require('chai')
const { spawn } = require('child_process')
const Path = require('path')

/**
 * Runs Server.initProcessEventListeners() in a child process with a stub MdnsManager, without starting the server
 * argv: <path to Server.js> <mode>, mode "pid1" makes re-raising the signal have no effect like for PID 1 in Docker
 */
const HARNESS = `
const Path = require('path')
const Server = require(process.argv[1])
// Server.stop() with everything but mDNS stubbed
require(Path.join(Path.dirname(process.argv[1]), 'Watcher')).close = () => console.log('WATCHER_CLOSED')
require(Path.join(Path.dirname(process.argv[1]), 'SocketAuthority')).close = async () => console.log('SOCKETS_CLOSED')
const fake = {
  mdnsManager: { stop: async () => console.log('MDNS_STOPPED') },
  server: { close: (callback) => callback() },
  stop: Server.prototype.stop
}
if (process.argv[2] === 'pid1') process.kill = () => true
Server.prototype.initProcessEventListeners.call(fake)
setInterval(() => {}, 1000)
console.log('READY')
`

/**
 * @param {NodeJS.Signals} signal
 * @param {string} [mode]
 * @returns {Promise<{ code: number|null, signal: string|null, output: string }>}
 */
const runAndSignal = (signal, mode = '') =>
  new Promise((resolve, reject) => {
    // Tests run from dist-server/test/server
    const serverPath = Path.resolve(__dirname, '../../server/Server.js')
    const child = spawn(process.execPath, ['-e', HARNESS, serverPath, mode], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let sent = false
    const onData = (data) => {
      output += data
      if (!sent && output.includes('READY')) {
        sent = true
        child.kill(signal)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (data) => (output += data))
    child.on('error', reject)
    child.on('exit', (code, exitSignal) => resolve({ code, signal: exitSignal, output }))
  })

describe('Server signal handling', function () {
  // Loading Server.js and its dependencies in a new process takes a moment
  this.timeout(30000)

  if (process.platform === 'win32') return

  it('should send mDNS goodbyes on SIGTERM, then terminate by the signal', async () => {
    const result = await runAndSignal('SIGTERM')
    expect(result.output).to.include('MDNS_STOPPED')
    expect(result.output).to.not.include('WATCHER_CLOSED')
    expect(result.signal).to.equal('SIGTERM')
  })

  it('should exit with 143 when re-raising SIGTERM has no effect (PID 1 without an init process)', async () => {
    const result = await runAndSignal('SIGTERM', 'pid1')
    expect(result.output).to.include('MDNS_STOPPED')
    expect(result).to.include({ code: 143, signal: null })
  })

  it('should stop the server on SIGINT (Ctrl+C, also sent by the Windows app), mDNS first', async () => {
    const result = await runAndSignal('SIGINT')
    const order = result.output.split('\n').filter((line) => /^(MDNS_STOPPED|WATCHER_CLOSED|SOCKETS_CLOSED)$/.test(line))
    expect(order).to.deep.equal(['MDNS_STOPPED', 'WATCHER_CLOSED', 'SOCKETS_CLOSED'])
    expect(result).to.include({ code: 0, signal: null })
  })
})
