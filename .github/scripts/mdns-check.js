#!/usr/bin/env node
/**
 * Independent DNS-SD client used to verify that Audiobookshelf servers are discoverable on the local network.
 * Uses dns-packet rather than ciao so the server is not verified with its own encoder.
 *
 * Usage: node .github/scripts/mdns-check.js [options]
 *   --count <n>          minimum number of servers that must be found (default 1, or 0 with only --goodbye)
 *   --name <name>        instance name that must be present (repeatable)
 *   --absent <name>      instance name that must NOT be present (repeatable). Queries for at least --settle seconds.
 *                        Needs a positive control (--name, or --count >= 1 which is the default), so receiving nothing
 *                        at all can't pass.
 *   --goodbye <name>     wait for a goodbye (RFC 6762 10.1, TTL 0) for this instance (repeatable). The instance must be
 *                        seen first, then "READY" is printed (and --ready-file written) so the caller can stop or rename
 *                        the server. Goodbyes are multicast, so this always listens on port 5353.
 *   --ready-file <file>  write this file once every --name and --goodbye instance has been seen
 *   --name-pattern <re>  every found instance name must match this regex
 *   --txt <key=value>    TXT entry every --name instance (all instances if no --name) must have (repeatable)
 *   --mode <m>           "unicast" (RFC 6762 6.7 legacy unicast, how simple clients like Roku query),
 *                        "multicast" (standard QM query from port 5353) or "both" (default unicast)
 *   --http               GET <path>status on the advertised addresses and require app=audiobookshelf
 *   --timeout <s>        give up after this many seconds (default 15)
 *   --settle <s>         minimum query time when --absent is given (default 4)
 *   --json <file>        write the discovered servers to a JSON file
 *
 * Discovery is IPv4 only like the server (ciao has no IPv6 transport), AAAA records travel inside IPv4 responses.
 *
 * Exits 0 when all expectations are met, 1 when they are not, 2 on usage or socket errors.
 */
const dgram = require('dgram')
const os = require('os')
const fs = require('fs')
const net = require('net')
const packet = require('dns-packet')

const SERVICE = '_audiobookshelf._tcp.local'
const MDNS_ADDRESS = '224.0.0.251'
const MDNS_PORT = 5353
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class UsageError extends Error {}

function parseArgs(argv) {
  const args = {
    count: null,
    names: [],
    absent: [],
    goodbye: [],
    readyFile: null,
    namePattern: null,
    txt: {},
    mode: 'unicast',
    http: false,
    timeout: 15,
    settle: 4,
    json: null
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new UsageError(`${arg} requires a value`)
      return argv[++i]
    }
    if (arg === '--count') args.count = Number(next())
    else if (arg === '--name') args.names.push(next())
    else if (arg === '--absent') args.absent.push(next())
    else if (arg === '--goodbye') args.goodbye.push(next())
    else if (arg === '--ready-file') args.readyFile = next()
    else if (arg === '--name-pattern') args.namePattern = new RegExp(next())
    else if (arg === '--txt') {
      const entry = next()
      const eq = entry.indexOf('=')
      if (eq < 1) throw new UsageError(`--txt expects key=value, got "${entry}"`)
      args.txt[entry.slice(0, eq).toLowerCase()] = entry.slice(eq + 1)
    } else if (arg === '--mode') args.mode = next()
    else if (arg === '--http') args.http = true
    else if (arg === '--timeout') args.timeout = Number(next())
    else if (arg === '--settle') args.settle = Number(next())
    else if (arg === '--json') args.json = next()
    else throw new UsageError(`Unknown argument ${arg}`)
  }
  if (!['unicast', 'multicast', 'both'].includes(args.mode)) throw new UsageError(`Invalid mode ${args.mode}`)
  if (args.count === null) args.count = !args.names.length && args.goodbye.length ? 0 : 1
  for (const [key, value] of Object.entries({ count: args.count, timeout: args.timeout, settle: args.settle })) {
    if (!Number.isFinite(value) || value < 0) throw new UsageError(`Invalid --${key} ${value}`)
  }
  if (args.absent.length && !args.names.length && args.count < 1) throw new UsageError('--absent needs a positive control: --name or --count >= 1')
  return args
}

/** IPv4 addresses of interfaces to send queries on: every external interface plus loopback (same machine) */
function getQueryInterfaces() {
  const addresses = []
  for (const infos of Object.values(os.networkInterfaces())) {
    for (const info of infos || []) {
      if (info.family === 'IPv4' || info.family === 4) addresses.push(info.address)
    }
  }
  return addresses
}

/** "My Server._audiobookshelf._tcp.local" -> "My Server" */
function instanceName(fqdn) {
  return fqdn.slice(0, -(SERVICE.length + 1))
}

class Browser {
  constructor() {
    /** @type {Map<string, { name: string, host?: string, port?: number, txt?: Record<string, string>, addresses: Set<string>, via: Set<string> }>} */
    this.instances = new Map()
    /** @type {Map<string, Set<string>>} */
    this.hostAddresses = new Map()
    /** @type {Set<string>} lowercased instance names a goodbye was received for */
    this.goodbyes = new Set()
    /** @type {Set<string>} lowercased instance names seen alive at some point */
    this.seen = new Set()
  }

  instance(fqdn) {
    const key = fqdn.toLowerCase()
    if (!this.instances.has(key)) {
      this.instances.set(key, { name: instanceName(fqdn), addresses: new Set(), via: new Set() })
    }
    return this.instances.get(key)
  }

  goodbye(fqdn, rinfo) {
    const name = instanceName(fqdn)
    if (!this.goodbyes.has(name.toLowerCase())) console.log(`  goodbye received for "${name}" from ${rinfo.address}`)
    this.goodbyes.add(name.toLowerCase())
    // RFC 6762 10.1: TTL 0 means the record is going away, so the instance must no longer be reported
    this.instances.delete(fqdn.toLowerCase())
  }

  /**
   * @param {Buffer} buf
   * @param {dgram.RemoteInfo} rinfo
   * @param {string} via how the response was received, "unicast" or "multicast"
   */
  handle(buf, rinfo, via) {
    let message
    try {
      message = packet.decode(buf)
    } catch {
      return
    }
    if (message.type !== 'response') return
    const records = [...(message.answers || []), ...(message.additionals || [])]
    for (const r of records) {
      if (r.type !== 'PTR' || r.name.toLowerCase() !== SERVICE || !r.data.toLowerCase().endsWith(`.${SERVICE}`)) continue
      if (r.ttl === 0) this.goodbye(r.data, rinfo)
      else this.instance(r.data).via.add(via)
    }
    for (const r of records) {
      const key = r.name.toLowerCase()
      if (r.type === 'SRV' && r.ttl === 0 && key.endsWith(`.${SERVICE}`)) this.goodbye(r.name, rinfo)
      else if (r.type === 'SRV' && this.instances.has(key)) Object.assign(this.instances.get(key), { host: r.data.target, port: r.data.port })
      else if (r.type === 'TXT' && this.instances.has(key) && r.ttl > 0) {
        const txt = {}
        for (const entry of r.data) {
          const str = Buffer.from(entry).toString('utf8')
          const eq = str.indexOf('=')
          if (eq > 0) txt[str.slice(0, eq).toLowerCase()] = str.slice(eq + 1)
        }
        this.instances.get(key).txt = txt
      } else if (r.type === 'A' || r.type === 'AAAA') {
        if (!this.hostAddresses.has(key)) this.hostAddresses.set(key, new Set())
        if (r.ttl > 0) this.hostAddresses.get(key).add(r.data)
        else this.hostAddresses.get(key).delete(r.data)
      }
    }
    for (const instance of this.instances.values()) {
      const addresses = instance.host && this.hostAddresses.get(instance.host.toLowerCase())
      // addresses are re-derived on every response so A/AAAA goodbyes are reflected
      if (addresses) instance.addresses = new Set(addresses)
    }
    for (const instance of this.complete()) this.seen.add(instance.name.toLowerCase())
  }

  complete() {
    return [...this.instances.values()].filter((i) => i.host && i.port && i.txt && i.addresses.size)
  }
}

// One-shot PTR query for the service type. The id is ignored for multicast queries (RFC 6762 18.1)
const QUERY = packet.encode({ type: 'query', id: 1, questions: [{ name: SERVICE, type: 'PTR' }] })

function bind(socket, port, address) {
  return new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.bind(port, address, () => {
      socket.removeListener('error', reject)
      resolve()
    })
  })
}

async function openSockets(browser, args) {
  const sockets = []
  const interfaces = getQueryInterfaces()
  const sendMulticast = args.mode === 'multicast' || args.mode === 'both'

  if (args.mode === 'unicast' || args.mode === 'both') {
    // Legacy unicast (RFC 6762 6.7): query from an ephemeral port, responders reply directly to us
    for (const address of interfaces) {
      const socket = dgram.createSocket('udp4')
      socket.on('message', (buf, rinfo) => browser.handle(buf, rinfo, 'unicast'))
      socket.on('error', (error) => console.error(`unicast socket error on ${address}: ${error.message}`))
      try {
        await bind(socket, 0)
        socket.setMulticastInterface(address)
        socket.setMulticastLoopback(true)
      } catch (error) {
        console.warn(`  skipping ${address} for unicast queries: ${error.message}`)
        socket.close()
        continue
      }
      sockets.push({ socket, send: () => socket.send(QUERY, MDNS_PORT, MDNS_ADDRESS, () => {}) })
    }
  }

  // goodbyes are only ever multicast, so listen on 5353 whenever they are expected
  if (sendMulticast || args.goodbye.length) {
    // Standard query from port 5353, responses and goodbyes are multicast to the group.
    // reuseAddr lets this share the port with the OS responder (avahi, mDNSResponder, Windows) and the server itself
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    socket.on('message', (buf, rinfo) => browser.handle(buf, rinfo, 'multicast'))
    socket.on('error', (error) => console.error(`multicast socket error: ${error.message}`))
    await bind(socket, MDNS_PORT)
    socket.setMulticastLoopback(true)
    let memberships = 0
    for (const address of interfaces) {
      try {
        socket.addMembership(MDNS_ADDRESS, address)
        memberships++
      } catch (error) {
        console.warn(`  could not join ${MDNS_ADDRESS} on ${address}: ${error.message}`)
      }
    }
    if (!memberships) throw new Error(`Could not join ${MDNS_ADDRESS} on any interface`)
    sockets.push({
      socket,
      send: () => {
        if (!sendMulticast) return
        for (const address of interfaces) {
          try {
            socket.setMulticastInterface(address)
            socket.send(QUERY, MDNS_PORT, MDNS_ADDRESS, () => {})
          } catch {}
        }
      }
    })
  }
  return sockets
}

async function checkHttp(instance) {
  const errors = []
  for (const address of [...instance.addresses].filter((a) => net.isIPv4(a))) {
    const url = `http://${address}:${instance.port}${instance.txt.path || '/'}status`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      const json = await res.json()
      if (json.app === 'audiobookshelf') return { ok: true, url }
      errors.push(`${url}: unexpected response`)
    } catch (error) {
      errors.push(`${url}: ${error.cause?.message || error.message}`)
    }
  }
  return { ok: false, errors }
}

function validate(browser, args, elapsed) {
  const instances = browser.complete()
  const problems = []
  const has = (name) => instances.some((i) => i.name.toLowerCase() === name.toLowerCase())
  if (instances.length < args.count) problems.push(`expected at least ${args.count} server(s), found ${instances.length}`)
  for (const name of args.names) {
    if (!has(name)) problems.push(`instance "${name}" not found`)
  }
  for (const name of args.absent) {
    if (has(name)) problems.push(`instance "${name}" is still advertised`)
  }
  if (args.absent.length && elapsed < args.settle * 1000) problems.push(`queried for less than ${args.settle}s`)
  for (const name of args.goodbye) {
    if (!browser.seen.has(name.toLowerCase())) problems.push(`instance "${name}" was never seen, so its goodbye can't be verified`)
    else if (!browser.goodbyes.has(name.toLowerCase())) problems.push(`no goodbye (TTL 0) received for "${name}"`)
  }
  for (const i of instances) {
    if (args.namePattern && !args.namePattern.test(i.name)) problems.push(`"${i.name}" does not match ${args.namePattern}`)
    if (i.txt.txtvers !== '1') problems.push(`"${i.name}" TXT txtvers is "${i.txt.txtvers}", expected "1"`)
    if (!UUID_PATTERN.test(i.txt.id || '')) problems.push(`"${i.name}" TXT id "${i.txt.id}" is not a UUID`)
    if (!i.txt.path?.startsWith('/') || !i.txt.path.endsWith('/')) problems.push(`"${i.name}" TXT path "${i.txt.path}" must start and end with "/"`)
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.local\.?$/.test(i.host)) problems.push(`"${i.name}" hostname "${i.host}" is not a valid LDH .local hostname`)
    if (!args.names.length || args.names.some((n) => n.toLowerCase() === i.name.toLowerCase())) {
      for (const [key, value] of Object.entries(args.txt)) {
        if (i.txt[key] !== value) problems.push(`"${i.name}" TXT ${key} is "${i.txt[key]}", expected "${value}"`)
      }
    }
  }
  const unique = (label, getValue) => {
    const values = instances.map(getValue)
    if (new Set(values).size !== values.length) problems.push(`${label} are not unique: ${values.join(', ')}`)
  }
  unique('instance names', (i) => i.name.toLowerCase())
  unique('hostnames', (i) => i.host.toLowerCase())
  unique('TXT ids', (i) => i.txt.id)
  return problems
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const browser = new Browser()
  const sockets = await openSockets(browser, args)
  if (!sockets.length) throw new Error('Could not open any query socket')

  const start = Date.now()
  const deadline = start + args.timeout * 1000
  const waitingFor = [...args.names, ...args.goodbye]
  let ready = !waitingFor.length
  let problems = []
  while (Date.now() < deadline) {
    sockets.forEach((s) => s.send())
    await new Promise((resolve) => setTimeout(resolve, 1000))
    if (!ready && waitingFor.every((name) => browser.seen.has(name.toLowerCase()))) {
      ready = true
      if (args.readyFile) fs.writeFileSync(args.readyFile, `${Date.now()}\n`)
      console.log(`READY: found ${waitingFor.map((n) => `"${n}"`).join(', ')} after ${((Date.now() - start) / 1000).toFixed(1)}s`)
    }
    problems = validate(browser, args, Date.now() - start)
    if (!problems.length) break
  }
  sockets.forEach((s) => s.socket.close())

  const instances = browser.complete()
  console.log(`Found ${instances.length} Audiobookshelf server(s) after ${((Date.now() - start) / 1000).toFixed(1)}s:`)
  for (const i of instances) {
    console.log(`  "${i.name}" -> ${i.host}:${i.port} [${[...i.addresses].join(', ')}] txt=${JSON.stringify(i.txt)} via ${[...i.via].join('+')}`)
  }
  if (browser.goodbyes.size) console.log(`Goodbyes received for: ${[...browser.goodbyes].join(', ')}`)

  if (args.http) {
    for (const i of instances) {
      const result = await checkHttp(i)
      if (result.ok) console.log(`  HTTP OK ${result.url}`)
      else problems.push(`"${i.name}" HTTP check failed: ${result.errors.join('; ')}`)
    }
  }

  if (args.json) {
    const servers = instances.map((i) => ({ ...i, addresses: [...i.addresses], via: [...i.via] }))
    fs.writeFileSync(args.json, JSON.stringify(servers, null, 2))
  }

  if (problems.length) {
    console.error('FAILED:')
    problems.forEach((p) => console.error(`  - ${p}`))
    process.exit(1)
  }
  console.log('OK')
}

main().catch((error) => {
  console.error(error instanceof UsageError ? `Usage error: ${error.message}` : error)
  process.exit(2)
})
