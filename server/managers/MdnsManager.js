const os = require('os')
const net = require('net')
const Path = require('path')
const fsPromises = require('fs/promises')
const { randomUUID } = require('crypto')
const Logger = require('../Logger')

/**
 * DNS-SD service type (RFC 6763 7). Clients browse for `_audiobookshelf._tcp.local.`
 */
const SERVICE_TYPE = 'audiobookshelf'
/** Used when the translated default name can't be loaded from client/strings */
const DEFAULT_NAME = 'Audiobook'
/** Hostname label for the (translated) default name, and when a name has no latin characters to derive one from */
const DEFAULT_HOSTNAME = 'audiobook'
/** The default service name is translatable: client/strings/<server language>.json */
const DEFAULT_NAME_STRING_KEY = 'LabelSettingsMdnsDefaultName'
const DEFAULT_LANGUAGE = 'en-us'
/** Latin letters that NFKD does not decompose into a base letter, transliterated for hostnames */
const HOSTNAME_TRANSLITERATION = {
  ß: 'ss',
  ẞ: 'ss',
  æ: 'ae',
  Æ: 'ae',
  ø: 'o',
  Ø: 'o',
  œ: 'oe',
  Œ: 'oe',
  ð: 'd',
  Ð: 'd',
  þ: 'th',
  Þ: 'th',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
  ħ: 'h',
  Ħ: 'h',
  ı: 'i',
  ŀ: 'l',
  Ŀ: 'l',
  ŧ: 't',
  Ŧ: 't',
  ŋ: 'ng',
  Ŋ: 'ng',
  ĸ: 'k'
}
const HOSTNAME_TRANSLITERATION_PATTERN = new RegExp(`[${Object.keys(HOSTNAME_TRANSLITERATION).join('')}]`, 'g')
/** RFC 6763 4.1.1 instance names and RFC 1035 labels are limited to 63 bytes */
const MAX_LABEL_BYTES = 63
const PROBING_WATCHDOG = 30 * 1000
/**
 * Without patchCiaoProberConflicts() ciao only reports a rename once probing "name (N)" succeeded, which never happens
 * when "name (N)" does not fit in a DNS label, so the names are checked for ciao's rename instead
 */
const RENAME_CHECK_INTERVAL = 1000
/** RFC 6762 8.1: after 15 conflicts within 10 seconds wait at least 5 seconds before each further probe */
const CONFLICT_RATE_LIMIT = { count: 15, window: 10 * 1000, delay: 5 * 1000 }
/** Same pattern ciao uses to detect names it already numbered after a conflict */
const NUMBERED_NAME_PATTERN = / \(\d+\)$/
const RETRY_DELAY_MIN = 5 * 1000
const RETRY_DELAY_MAX = 5 * 60 * 1000
/**
 * Upper bound for each step of stopping to advertise. Goodbyes are a single packet, but a hung ciao teardown must not
 * stall later settings changes, which run one at a time, or server shutdown.
 */
const STOP_TIMEOUT = 3 * 1000
/** Upper bound for waiting until a new responder has opened its sockets before shutting it down */
const RESPONDER_INIT_TIMEOUT = 1000
/**
 * Upper bound for stop() on server shutdown, including a settings change that is still being applied. Goodbyes are
 * sent within milliseconds normally. Must stay below how long service managers wait before killing the server:
 * the Windows app waits 8s after Ctrl+C, `docker stop` 10s, systemd 90s.
 */
const SHUTDOWN_TIMEOUT = 5 * 1000

/**
 * @typedef MdnsConfig
 * @property {boolean} enabled
 * @property {string} [reason] why advertising is disabled
 * @property {string} name DNS-SD service instance name
 * @property {string} hostname hostname label without ".local"
 * @property {number} port
 * @property {string[]} [interfaces] interface names or IPs to advertise on, undefined lets ciao decide.
 *   Used for the responder's sockets and to restrict the advertised addresses: ciao maps an IP to its whole interface
 * @property {boolean} disableIpv6
 * @property {Record<string, string>} txt
 */

/**
 * @typedef ServerOptions
 * @property {string|number} port
 * @property {string} [host] HOST the server listens on, an IP, a name or "unix/<socket path>"
 * @property {string} [basePath]
 * @property {string} [address] the IP address the server is bound to (server.address().address), Node binds a HOST
 *   name to the first address it resolves to
 */

/**
 * @typedef FallbackLevels which fallback is in use, 0 for the configured name, see getFallbackNames()
 * @property {number} name for the service instance name
 * @property {number} hostname for the hostname
 */

/**
 * @typedef MdnsStatus
 * @property {'disabled'|'updating'|'probing'|'advertising'|'retrying'} state 'updating' while a settings change is being applied
 * @property {string} [reason]
 * @property {string} [name] currently advertised instance name
 * @property {string} [configuredName] name from settings or MDNS_NAME, or the default name
 * @property {string} [defaultName] translated default name used when no name is set
 * @property {string} [hostname] currently advertised hostname incl. ".local"
 * @property {number} [port]
 * @property {string} [url]
 * @property {{ enabled: boolean, name: boolean }} lockedByEnv
 */

/**
 * Advertises the server on the local network with mDNS / DNS-SD (Bonjour, Avahi, Windows, Android NSD)
 * as `_audiobookshelf._tcp` so apps can discover it and users can reach it at http://<name>.local:<port>
 *
 * Name conflicts with other servers are resolved per RFC 6762 9 by switching the name that is taken (the instance
 * name, the hostname or both) to a stable fallback derived from the server id (e.g. "Audiobook 3F2A" /
 * audiobook-3f2a.local) which is persisted so servers don't swap names across restarts.
 *
 * Settings: `mdnsEnabled` and `mdnsName` in server settings (web UI). Without a name the translated default name
 * (`LabelSettingsMdnsDefaultName` in client/strings for the server language, "Audiobook" in English) is used.
 * Environment overrides:
 *  - DISABLE_MDNS=1    disable advertising (locks the UI toggle)
 *  - MDNS_NAME         service name (locks the UI field)
 *  - MDNS_PORT         port to advertise when it differs from the listen port
 *  - MDNS_INTERFACES   comma separated interface names or IPs to advertise on
 */
class MdnsManager {
  /**
   * @param {Object} [deps] injectable for tests
   * @param {{ getResponder: Function }} [deps.ciao]
   * @param {{ get: () => import('../objects/settings/ServerSettings'), save: () => Promise<any> }} [deps.settingsStore]
   * @param {() => NodeJS.Dict<os.NetworkInterfaceInfo[]>} [deps.networkInterfaces]
   * @param {NodeJS.ProcessEnv} [deps.env]
   * @param {string} [deps.stringsDir] directory of the client translation files, defaults to <appRoot>/client/strings
   */
  constructor(deps = {}) {
    this.ciao = deps.ciao || null
    this.settingsStore = deps.settingsStore || null
    this.networkInterfaces = deps.networkInterfaces || os.networkInterfaces
    this.env = deps.env || process.env
    this.stringsDir = deps.stringsDir || null
    /** @type {Promise<Set<string>>} language codes that have a file in stringsDir */
    this.availableLanguages = null
    /** @type {Map<string, Promise<string>>} translated default name per language code */
    this.defaultNames = new Map()
    /** @type {string} default name for the current server language, set by apply() */
    this.defaultName = undefined
    this.stringsWarningLogged = false

    /** @type {ServerOptions} */
    this.serverOptions = null
    this.responder = null
    this.service = null
    /** @type {MdnsConfig} */
    this.config = null
    this.configKey = null
    /** incremented on every (re)start so callbacks from replaced services are ignored */
    this.generation = 0
    this.retryTimer = null
    this.retryDelay = RETRY_DELAY_MIN
    this.probingWatchdog = null
    /** @type {number[]} times of the recent name conflicts, see scheduleConflictRetry() */
    this.conflictTimes = []
    this.dockerWarningLogged = false
    /** true when ciao renames have to be detected by checking the names, see RENAME_CHECK_INTERVAL */
    this.watchRenames = false
    /** apply() and stop() run one at a time in call order */
    this.queue = Promise.resolve()
    /** number of apply()/stop() calls that have not finished yet */
    this.pending = 0
    /** @type {Promise<void>} apply() that is waiting in the queue and has not started yet */
    this.queuedApply = null

    /** @type {MdnsStatus} */
    this.status = { state: 'disabled', reason: 'not started', lockedByEnv: this.lockedByEnv }
  }

  get lockedByEnv() {
    return {
      enabled: MdnsManager.isTruthy(this.env.DISABLE_MDNS),
      // An invalid MDNS_NAME is ignored, so it does not lock the name either
      name: !!MdnsManager.normalizeName(this.env.MDNS_NAME || '')
    }
  }

  /**
   * Resolve with the promise, or with undefined after `ms` without waiting for it any longer
   *
   * @template T
   * @param {Promise<T>} promise
   * @param {number} ms
   * @param {() => void} onTimeout
   * @returns {Promise<T|undefined>}
   */
  static withTimeout(promise, ms, onTimeout) {
    let timer
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        onTimeout()
        resolve(undefined)
      }, ms)
      timer.unref?.()
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  /**
   * @param {string} [value]
   * @returns {boolean}
   */
  static isTruthy(value) {
    return value === '1' || value?.toLowerCase() === 'true'
  }

  /**
   * Truncate a string to a maximum number of UTF-8 bytes without splitting a character.
   * Splits on grapheme clusters when Intl.Segmenter is available, so "é" written as e + combining accent
   * or an emoji sequence is never cut in half.
   *
   * @param {string} value
   * @param {number} maxBytes
   * @returns {string}
   */
  static truncateUtf8(value, maxBytes) {
    const segments = typeof Intl.Segmenter === 'function' ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (s) => s.segment) : Array.from(value)
    let result = ''
    let bytes = 0
    for (const segment of segments) {
      const segmentBytes = Buffer.byteLength(segment)
      if (bytes + segmentBytes > maxBytes) break
      result += segment
      bytes += segmentBytes
    }
    return result
  }

  /**
   * Validate and normalize a user provided service instance name
   *
   * @param {string} value
   * @returns {string|null} null if invalid
   */
  static normalizeName(value) {
    if (typeof value !== 'string') return null
    // Control characters are not allowed in instance names (RFC 6763 4.1.1)
    const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
    if (!name || Buffer.byteLength(name) > MAX_LABEL_BYTES) return null
    // Names like "Audiobook (2)" are how mDNS name conflicts are numbered. ciao treats them as already
    // renamed and rewrites the hostname to an invalid "audiobook-2-(2).local", so they are not allowed.
    if (NUMBERED_NAME_PATTERN.test(name)) return null
    return name
  }

  /**
   * Derive an LDH hostname label (RFC 1123) from a service name.
   * "Bibliothèque Familiale" -> "bibliotheque-familiale", "Straße" -> "strasse". Returns '' when nothing usable remains.
   *
   * @param {string} value
   * @returns {string}
   */
  static toHostnameLabel(value) {
    return String(value || '')
      .replace(HOSTNAME_TRANSLITERATION_PATTERN, (char) => HOSTNAME_TRANSLITERATION[char])
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\.local\.?$/, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_LABEL_BYTES)
      .replace(/-+$/, '')
  }

  /**
   * Fallback names used when the configured name is already taken on the network. Level 1 appends the first
   * characters of the server id, every further conflict appends a number:
   * "Audiobook 3F2A" / audiobook-3f2a, "Audiobook 3F2A-2" / audiobook-3f2a-2, ...
   * The name is truncated so the result always fits in a 63 byte DNS label.
   *
   * @param {string} name
   * @param {string} hostname
   * @param {string} id
   * @param {number} [level]
   * @returns {{ name: string, hostname: string }}
   */
  static getFallbackNames(name, hostname, id, level = 1) {
    const idPart = id
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase()
    const suffix = level > 1 ? `${idPart}-${level}` : idPart
    return {
      name: `${MdnsManager.truncateUtf8(name, MAX_LABEL_BYTES - suffix.length - 1).trimEnd()} ${suffix}`,
      hostname: `${hostname.slice(0, MAX_LABEL_BYTES - suffix.length - 1).replace(/-+$/, '')}-${suffix.toLowerCase()}`
    }
  }

  /**
   * @param {string} [host]
   * @returns {boolean}
   */
  static isLoopbackHost(host) {
    if (!host) return false
    const lowered = host.toLowerCase()
    return lowered === 'localhost' || lowered === '::1' || lowered.startsWith('127.')
  }

  /**
   * Docker's default address pools are carved out of 172.16.0.0/12. When every IPv4 address is in that
   * range we are most likely on a bridge network, where multicast does not reach the LAN.
   *
   * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} networkInterfaces
   * @returns {boolean}
   */
  static isLikelyDockerBridgeNetwork(networkInterfaces) {
    const ipv4 = Object.values(networkInterfaces)
      .flat()
      .filter((info) => info && !info.internal && net.isIPv4(info.address))
      .map((info) => info.address)
    if (!ipv4.length) return false
    return ipv4.every((address) => {
      const [first, second] = address.split('.').map(Number)
      return first === 172 && second >= 16 && second <= 31
    })
  }

  /**
   * @param {() => Object} load requires one of ciao's internal modules
   * @returns {Object|undefined} undefined when it can't be loaded, e.g. after a ciao update moved it
   */
  static requireCiaoInternal(load) {
    try {
      return load()
    } catch {
      return undefined
    }
  }

  /**
   * Replace `target[method]` with `createPatched(original)`, only once. Used by the ciao workarounds below.
   *
   * @param {Object} [target] e.g. a ciao class or its prototype
   * @param {string} method
   * @param {(original: Function) => Function} createPatched
   * @returns {boolean} true if the workaround is in place, false when the method does not exist
   */
  static patchMethod(target, method, createPatched) {
    const original = target?.[method]
    if (typeof original !== 'function') return false
    if (original.absPatched) return true

    const patched = createPatched(original)
    patched.absPatched = true
    target[method] = patched
    return true
  }

  /**
   * Work around a ciao bug (<= 1.3.13-beta.0): on Linux it reads interface names from `ip -o link show`
   * but keeps the "@ifN" peer suffix of veth/macvlan/ipvlan interfaces ("eth0@if12"). Those names never match
   * os.networkInterfaces(), so the interface is ignored - inside a Docker bridge or macvlan container
   * (e.g. UnRAID br0) that is the only interface and nothing gets advertised.
   * Only the parsed names are corrected so ciao keeps tracking interfaces being added and removed.
   * TODO: Remove once fixed in @homebridge/ciao
   *
   * @param {Object} [NetworkManager] ciao's NetworkManager class
   * @returns {boolean} true if the workaround is in place
   */
  static patchCiaoLinuxInterfaceNames(NetworkManager) {
    if (!NetworkManager) NetworkManager = MdnsManager.requireCiaoInternal(() => require('@homebridge/ciao/lib/NetworkManager').NetworkManager)
    return MdnsManager.patchMethod(NetworkManager, 'getLinuxNetworkInterfaces', (original) => {
      return async function (...args) {
        const names = await original.apply(this, args)
        return [...new Set(names.map((name) => name.split('@')[0]))]
      }
    })
  }

  /**
   * ciao (<= 1.3.13-beta.0) treats a conflict on the hostname and a conflict on the service instance name the same:
   * its Prober matches records against either name and then renames both. RFC 6762 9 defines a conflict per record
   * name, and the instance name (SRV/TXT owner) and the hostname (A/AAAA owner) are separate names. Two servers named
   * "Hörbuch" and "Livre audio" that both use audiobook.local only conflict on the hostname.
   *
   * ciao only renames from Prober.handleResponse(): a response to our probe, also after losing a simultaneous probe
   * tiebreak (RFC 6762 8.2) when the next probe is answered. Its other caller, checkLocalConflicts(), is about other
   * services of the same responder and this responder only ever has one. When handleResponse() renamed the service,
   * this records which of its names were in the response as `service.absConflict` ({ name, hostname }) and emits
   * 'abs-conflict' on the service right after, so MdnsManager changes only that name, before ciao probes its own
   * "name (2)" (which does not fit in a DNS label for long names). Without the patch both names change once ciao
   * reports the rename.
   * TODO: Remove once ciao reports which name conflicted
   *
   * @param {Object} [Prober] ciao's Prober class
   * @returns {boolean} true if the workaround is in place
   */
  static patchCiaoProberConflicts(Prober) {
    if (!Prober) Prober = MdnsManager.requireCiaoInternal(() => require('@homebridge/ciao/lib/responder/Prober').Prober)
    return MdnsManager.patchMethod(Prober?.prototype, 'handleResponse', (original) => {
      return function (packet, ...args) {
        const service = this.service
        let before
        try {
          const names = new Set([...packet.answers.values(), ...packet.additionals.values()].map((record) => record.getLowerCasedName()))
          before = { fqdn: service.getFQDN(), hostname: service.getHostname(), nameMatched: names.has(service.getLowerCasedFQDN()), hostnameMatched: names.has(service.getLowerCasedHostname()) }
        } catch {
          // Unexpected packet or service, ciao handles it as before
        }
        const result = original.call(this, packet, ...args)
        if (before && (service.getFQDN() !== before.fqdn || service.getHostname() !== before.hostname)) {
          // Only the first rename counts, later ones are about ciao's "name (2)"
          if (!service.absConflict && (before.nameMatched || before.hostnameMatched)) service.absConflict = { name: before.nameMatched, hostname: before.hostnameMatched }
          process.nextTick(() => service.emit('abs-conflict'))
        }
        return result
      }
    })
  }

  /**
   * Whether ciao should ignore an IPv4 packet received on its socket for `networkInterface`, see
   * patchCiaoSourceNetworkCheck(). Trade-off: a source outside the interface's network that is on the network of
   * another local interface is ignored, e.g. with a VPN on 10.0.0.0/8 a query relayed onto the LAN from 10.20.30.40.
   *
   * @param {string} address source address
   * @param {{ name: string, loopback?: boolean, ipv4?: string, ip4Netmask?: string }} networkInterface ciao's interface the socket is for
   * @param {Iterable<{ name: string, loopback?: boolean, ipv4?: string, ip4Netmask?: string }>} networkInterfaces all of ciao's interfaces
   * @returns {boolean}
   */
  static isFromOtherInterfaceNetwork(address, networkInterface, networkInterfaces) {
    const { getNetAddress } = require('@homebridge/ciao/lib/util/domain-formatter') // cached by require()
    const isOnNetwork = (info) => !!info.ipv4 && !!info.ip4Netmask && net.isIPv4(info.ipv4) && getNetAddress(address, info.ip4Netmask) === getNetAddress(info.ipv4, info.ip4Netmask)
    if (!net.isIPv4(address) || !networkInterface || networkInterface.loopback || isOnNetwork(networkInterface)) return false
    for (const other of networkInterfaces) {
      if (other.name !== networkInterface.name && !other.loopback && isOnNetwork(other)) return true
    }
    // Not from any local network (e.g. a relay that keeps the source address, an address outside the netmask), ciao decides
    return false
  }

  /**
   * ciao (<= 1.3.13-beta.0) binds one socket per interface to 0.0.0.0:5353. Linux delivers multicast to every socket
   * bound to the port (IP_MULTICAST_ALL), so a query from the LAN also arrives on the sockets for docker0, br-*,
   * VPN interfaces etc., and ciao answers it on each of them as if it came from that network. Legacy unicast queries
   * (RFC 6762 6.7, e.g. Roku) are answered by unicast, so the LAN client receives the address of every interface,
   * e.g. 172.17.0.1, and may pick an unreachable one.
   * On Linux this ignores an IPv4 packet on an interface's socket when its source is on the network of a different
   * local interface: that packet arrived on the other interface and is handled by its socket. Every other packet is
   * handled as before, multicast to 224.0.0.251 is link-local whatever its source address is (RFC 6762 11).
   * TODO: Remove once fixed in @homebridge/ciao
   *
   * @param {Object} [MDNSServer] ciao's MDNSServer class
   * @param {string} [platform]
   * @returns {boolean} true if the workaround is in place
   */
  static patchCiaoSourceNetworkCheck(MDNSServer, platform = process.platform) {
    if (platform !== 'linux') return false
    if (!MDNSServer) MDNSServer = MdnsManager.requireCiaoInternal(() => require('@homebridge/ciao/lib/MDNSServer').MDNSServer)
    return MdnsManager.patchMethod(MDNSServer?.prototype, 'handleMessage', (original) => {
      return function (name, buffer, rinfo, family, ...args) {
        if (family === 'IPv4') {
          let ignore = false
          try {
            const networkManager = this.networkManager
            ignore = MdnsManager.isFromOtherInterfaceNetwork(rinfo.address, networkManager.getInterface(name), networkManager.getInterfaceMap().values())
          } catch {
            // e.g. not initialized yet, ciao decides
          }
          if (ignore) return
        }
        return original.call(this, name, buffer, rinfo, family, ...args)
      }
    })
  }

  /**
   * Which of a service's names conflicted, as recorded by patchCiaoProberConflicts()
   *
   * @param {{ absConflict?: { name: boolean, hostname: boolean } }} service
   * @returns {{ name: boolean, hostname: boolean, determined: boolean }}
   */
  static getConflictingNames(service) {
    const conflict = service?.absConflict
    if (conflict?.name || conflict?.hostname) return { name: !!conflict.name, hostname: !!conflict.hostname, determined: true }
    return { name: true, hostname: true, determined: false }
  }

  /**
   * @param {{ name: boolean, hostname: boolean, determined: boolean }} conflict from getConflictingNames()
   * @param {string} name instance name that was probed
   * @param {string} hostname hostname label that was probed
   * @returns {string} start of the conflict log message, e.g. 'The hostname audiobook.local is'
   */
  static describeConflict(conflict, name, hostname) {
    if (!conflict.determined) return `The name "${name}" or the hostname ${hostname}.local is`
    if (conflict.name && conflict.hostname) return `The name "${name}" and the hostname ${hostname}.local are`
    if (conflict.name) return `The name "${name}" is`
    return `The hostname ${hostname}.local is`
  }

  /**
   * The addresses of an interface ciao advertises (<= 1.3.13-beta.0, NetworkManager.getCurrentNetworkInterfaces):
   * only its first IPv4 address, first link-local, first global and first unique local IPv6 address
   *
   * @param {os.NetworkInterfaceInfo[]} infos addresses of one interface from os.networkInterfaces()
   * @returns {string[]}
   */
  static getCiaoAddresses(infos) {
    const isFamily = (info, family) => info.family === `IPv${family}` || info.family === /** @type {any} */ (family)
    const first = (predicate) => infos.find(predicate)?.address
    return [first((info) => isFamily(info, 4)), first((info) => isFamily(info, 6) && info.scopeid), first((info) => isFamily(info, 6) && info.scopeid === 0 && !/^f[cd]/i.test(info.address)), first((info) => isFamily(info, 6) && info.scopeid === 0 && /^f[cd]/i.test(info.address))].filter(Boolean)
  }

  /**
   * Why ciao can't advertise one of these IP addresses: it only advertises some addresses of an interface
   * (getCiaoAddresses) and an address it does not advertise is left out, so nothing would be advertised for it
   *
   * @param {string[]} addresses IPs (and interface names, ignored) to restrict advertising to
   * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} networkInterfaces
   * @returns {string|null}
   */
  static getUnadvertisableReason(addresses, networkInterfaces) {
    for (const address of addresses.filter((entry) => net.isIP(entry))) {
      const lowered = address.toLowerCase()
      const [name, infos] = Object.entries(networkInterfaces).find(([, infos]) => infos?.some((info) => info.address.toLowerCase() === lowered)) || []
      // Not on any interface (anymore), ciao reports that when advertising
      if (!name) continue
      if (!MdnsManager.getCiaoAddresses(infos).some((ciaoAddress) => ciaoAddress.toLowerCase() === lowered)) {
        return `${address} is not the first ${net.isIPv4(address) ? 'IPv4' : 'IPv6'} address of ${name}, mDNS can only advertise that one (${MdnsManager.getCiaoAddresses(infos).join(', ')})`
      }
    }
    return null
  }

  /**
   * Build the advertising config from server options, server settings and environment
   *
   * @param {Object} params
   * @param {ServerOptions} params.serverOptions
   * @param {{ mdnsEnabled: boolean, mdnsName: string|null, mdnsServiceId: string }} params.settings mdnsName null uses the default name
   * @param {NodeJS.ProcessEnv} params.env
   * @param {string} [params.defaultName] translated default name for the server language
   * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} [params.networkInterfaces] to check addresses to restrict to
   * @returns {MdnsConfig}
   */
  static getConfig({ serverOptions, settings, env, defaultName, networkInterfaces }) {
    const { port, host, basePath, address } = serverOptions
    const customName = MdnsManager.normalizeName(env.MDNS_NAME || '') || MdnsManager.normalizeName(settings.mdnsName || '')
    const name = customName || MdnsManager.normalizeName(defaultName || '') || DEFAULT_NAME
    /** @type {MdnsConfig} */
    const config = {
      enabled: true,
      name,
      // Only names the user typed change the hostname. The translated default name changes with the server language
      // (and translation updates), the hostname must not, it is in bookmarks, app and reverse proxy configs.
      hostname: (customName && MdnsManager.toHostnameLabel(customName)) || DEFAULT_HOSTNAME,
      port: Number(env.MDNS_PORT || port),
      interfaces: undefined,
      disableIpv6: false,
      txt: {
        txtvers: '1',
        id: settings.mdnsServiceId,
        path: `${basePath || ''}/`
      }
    }
    const disable = (reason) => ({ ...config, enabled: false, reason })

    if (MdnsManager.isTruthy(env.DISABLE_MDNS)) return disable('disabled by DISABLE_MDNS environment variable')
    if (!settings.mdnsEnabled) return disable('disabled in server settings')
    if (host?.startsWith('unix/')) return disable('server is listening on a unix socket')
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) return disable(`invalid port "${env.MDNS_PORT || port}"`)

    // Addresses the server listens on, undefined when it listens on all of them
    let listenAddresses
    if (host && host !== '0.0.0.0' && host !== '::') {
      // A HOST name: the address the server resolved it to and is bound to
      listenAddresses = [net.isIP(host) ? host : address].filter((ip) => net.isIP(ip))
      if (!listenAddresses.length) return disable(`could not resolve HOST "${host}"`)
      if (listenAddresses.every((address) => MdnsManager.isLoopbackHost(address))) return disable(`server is only listening on loopback address "${host}"`)
    }

    const envInterfaces = (env.MDNS_INTERFACES || '')
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean)
    if (envInterfaces.length) {
      config.interfaces = envInterfaces
    } else if (listenAddresses) {
      // Only advertise the addresses the server is actually reachable on
      config.interfaces = listenAddresses.filter((address) => !MdnsManager.isLoopbackHost(address))
    }
    const unadvertisable = config.interfaces && networkInterfaces && MdnsManager.getUnadvertisableReason(config.interfaces, networkInterfaces)
    if (unadvertisable) return disable(unadvertisable)

    if (host === '0.0.0.0' || listenAddresses?.every((address) => net.isIPv4(address))) {
      config.disableIpv6 = true
    }

    return config
  }

  /**
   * @returns {string|null} directory of the client translation files
   */
  getStringsDir() {
    if (this.stringsDir) return this.stringsDir
    // global.appRoot is the repo root (node) or the pkg snapshot root, see index.js. Not set when running tests
    return global.appRoot ? Path.join(global.appRoot, 'client', 'strings') : null
  }

  /**
   * Language codes there is a translation file for. Only these are ever used to build a file path, so the
   * admin editable `language` setting can't be used to read other files.
   *
   * @returns {Promise<Set<string>>}
   */
  getAvailableLanguages() {
    if (!this.availableLanguages) {
      const stringsDir = this.getStringsDir()
      this.availableLanguages = (stringsDir ? fsPromises.readdir(stringsDir) : Promise.resolve([]))
        .then((files) => new Set(files.filter((file) => /^[a-z0-9-]+\.json$/i.test(file)).map((file) => file.slice(0, -'.json'.length))))
        .catch((error) => {
          if (!this.stringsWarningLogged) {
            this.stringsWarningLogged = true
            Logger.warn(`[MdnsManager] Could not read translations from "${stringsDir}", using the default name "${DEFAULT_NAME}": ${error.message}`)
          }
          // Not cached, a later call tries again
          this.availableLanguages = null
          return new Set()
        })
    }
    return this.availableLanguages
  }

  /**
   * @param {string} code language code from getAvailableLanguages()
   * @returns {Promise<string|null>} the translated default name, null if missing or not a valid name
   */
  async readDefaultName(code) {
    const filePath = Path.join(this.getStringsDir(), `${code}.json`)
    try {
      const value = JSON.parse(await fsPromises.readFile(filePath, 'utf8'))?.[DEFAULT_NAME_STRING_KEY]
      if (value === undefined) return null
      const name = MdnsManager.normalizeName(value)
      if (!name) Logger.warn(`[MdnsManager] Ignoring invalid ${DEFAULT_NAME_STRING_KEY} "${value}" in ${filePath}`)
      return name
    } catch (error) {
      Logger.debug(`[MdnsManager] Failed to read the default name from "${filePath}": ${error.message}`)
      return null
    }
  }

  /**
   * Default service name (when no name is set) in the server language, from the client translation files.
   * Falls back to English and then to "Audiobook". Cached per language, never throws.
   *
   * @param {string} [language] server language setting, e.g. "de"
   * @returns {Promise<string>}
   */
  async getDefaultName(language) {
    const languages = await this.getAvailableLanguages()
    // Translations could not be read (nothing is cached then)
    if (!languages.size) return DEFAULT_NAME
    const code = typeof language === 'string' && languages.has(language) ? language : DEFAULT_LANGUAGE
    if (!this.defaultNames.has(code)) {
      this.defaultNames.set(code, this.loadDefaultName(code, languages))
    }
    return this.defaultNames.get(code)
  }

  /**
   * @param {string} code language code to load the default name for
   * @param {Set<string>} languages from getAvailableLanguages()
   * @returns {Promise<string>} the translated name, falling back to English and then to "Audiobook"
   */
  async loadDefaultName(code, languages) {
    const name = languages.has(code) ? await this.readDefaultName(code) : null
    if (name || code === DEFAULT_LANGUAGE) return name || DEFAULT_NAME
    return this.getDefaultName(DEFAULT_LANGUAGE)
  }

  getSettingsStore() {
    if (!this.settingsStore) {
      const Database = require('../Database')
      this.settingsStore = {
        get: () => Database.serverSettings,
        save: () => Database.updateServerSettings()
      }
    }
    return this.settingsStore
  }

  /**
   * Generate and persist the stable service id on first use
   */
  async ensureServiceId() {
    const store = this.getSettingsStore()
    const settings = store.get()
    if (!settings.mdnsServiceId) {
      settings.mdnsServiceId = randomUUID()
      await store.save()
    }
    return settings.mdnsServiceId
  }

  /**
   * Start advertising once the HTTP server is listening
   *
   * @param {ServerOptions} serverOptions
   */
  async init(serverOptions) {
    this.serverOptions = serverOptions
    await this.apply()
  }

  /**
   * Run apply()/stop() one at a time so overlapping settings changes can't leave a stale service advertising
   *
   * @param {() => Promise<void>} task
   * @returns {Promise<void>}
   */
  enqueue(task) {
    this.pending++
    const run = async () => {
      try {
        await task()
      } catch (error) {
        // Callers don't await this (e.g. settings changes), so it must never reject
        Logger.error('[MdnsManager] Failed to apply mDNS settings', error)
      } finally {
        this.pending--
      }
    }
    this.queue = this.queue.then(run, run)
    return this.queue
  }

  /**
   * (Re)apply the current settings. Called on start and when mDNS settings change.
   * Never throws - mDNS problems must not affect the server. Settings changes don't need to wait for it,
   * the status is 'updating' until it is done.
   */
  apply() {
    // An apply() that has not started yet will read the latest settings anyway, so changes made in quick succession
    // (e.g. toggling repeatedly) are applied once instead of advertising and withdrawing every intermediate state
    if (!this.queuedApply) {
      this.queuedApply = this.enqueue(() => {
        this.queuedApply = null
        return this.applyNow()
      })
    }
    return this.queuedApply
  }

  async applyNow() {
    const serverOptions = this.serverOptions
    // stop() was called (also while this was waiting below), don't start advertising again
    const stopped = () => this.serverOptions !== serverOptions
    if (!serverOptions) return
    try {
      await this.ensureServiceId()
      if (stopped()) return
      const settings = this.getSettingsStore().get()
      if (this.env.MDNS_NAME?.trim() && !MdnsManager.normalizeName(this.env.MDNS_NAME)) {
        Logger.warn(`[MdnsManager] Ignoring invalid MDNS_NAME "${this.env.MDNS_NAME}": it must be 1 to 63 bytes and must not end with a number in parentheses`)
      }
      this.defaultName = await this.getDefaultName(settings.language)
      if (stopped()) return
      const config = MdnsManager.getConfig({ serverOptions, settings, env: this.env, defaultName: this.defaultName, networkInterfaces: this.networkInterfaces() })

      // A changed name (in settings, MDNS_NAME or the translated default name) or hostname gets a fresh chance at its
      // plain, non fallback form. The hostname of the default name does not change with the language.
      const resetName = settings.mdnsFallbackFor && settings.mdnsFallbackFor !== config.name
      const resetHostname = settings.mdnsHostnameFallbackFor && settings.mdnsHostnameFallbackFor !== config.hostname
      if (resetName || resetHostname) {
        if (resetName) {
          settings.mdnsFallbackFor = null
          settings.mdnsFallbackLevel = null
        }
        if (resetHostname) {
          settings.mdnsHostnameFallbackFor = null
          settings.mdnsHostnameFallbackLevel = null
        }
        await this.getSettingsStore().save()
        if (stopped()) return
      }
      const configKey = JSON.stringify(config)
      if (configKey === this.configKey && (this.service || this.retryTimer || !config.enabled)) return

      await this.stopAdvertising()
      if (stopped()) return
      this.config = config
      this.configKey = configKey
      this.retryDelay = RETRY_DELAY_MIN

      if (!config.enabled) {
        Logger.info(`[MdnsManager] Local network discovery (mDNS) is off: ${config.reason}`)
        this.setStatus({ state: 'disabled', reason: config.reason })
        return
      }

      if (global.Source === 'docker' && !this.dockerWarningLogged) {
        this.dockerWarningLogged = true
        this.logDockerNetworkHint()
      }

      this.advertise()
    } catch (error) {
      Logger.error('[MdnsManager] Failed to apply mDNS settings', error)
    }
  }

  /**
   * The network mode can't be reliably detected from inside the container, so always say what is needed
   * and only warn when the addresses are in Docker's default bridge pool
   */
  logDockerNetworkHint() {
    const message = 'mDNS discovery only reaches your local network when the container uses host networking ("network_mode: host") or a macvlan/ipvlan network (e.g. UnRAID "br0"), not the default bridge network.'
    if (MdnsManager.isLikelyDockerBridgeNetwork(this.networkInterfaces())) {
      Logger.warn(`[MdnsManager] This container appears to be on a Docker bridge network. ${message}`)
    } else {
      Logger.info(`[MdnsManager] Running in Docker: ${message}`)
    }
  }

  /**
   * @param {Partial<MdnsStatus>} status
   */
  setStatus(status) {
    // configuredName is the name from settings or MDNS_NAME, name is what is actually advertised (may be the fallback)
    this.status = { ...status, configuredName: this.config?.name, lockedByEnv: this.lockedByEnv }
  }

  /**
   * @returns {MdnsStatus}
   */
  getStatus() {
    // The default name can change with the server language without the advertised name changing
    const status = { ...this.status, defaultName: this.defaultName }
    // A settings change is still being applied, the rest of the status is from before it
    if (this.pending > 0) status.state = 'updating'
    return status
  }

  advertise() {
    const config = this.config
    const generation = ++this.generation
    const settings = this.getSettingsStore().get()
    // Start with the fallbacks this server already had to use for these names (RFC 6762 9: keep the new name)
    const level = (value) => Math.max(0, Math.floor(Number(value)) || 0)
    const levels = {
      name: settings.mdnsFallbackFor === config.name ? level(settings.mdnsFallbackLevel) : 0,
      hostname: settings.mdnsHostnameFallbackFor === config.hostname ? level(settings.mdnsHostnameFallbackLevel) : 0
    }
    this.conflictTimes = []
    this.startService(generation, levels)
  }

  /**
   * @param {number} generation
   * @param {FallbackLevels} levels
   */
  startService(generation, levels) {
    try {
      let ciao = this.ciao
      if (!ciao) {
        ciao = require('@homebridge/ciao')
        MdnsManager.patchCiaoLinuxInterfaceNames()
        this.watchRenames = !MdnsManager.patchCiaoProberConflicts()
        if (this.watchRenames) {
          Logger.debug('[MdnsManager] Could not patch ciao to tell hostname and name conflicts apart, a conflict changes both')
        }
        if (!MdnsManager.patchCiaoSourceNetworkCheck()) {
          Logger.debug('[MdnsManager] Could not patch ciao to only answer queries from the network of each interface')
        }
      }
      if (!this.responder) {
        const { interfaces } = this.config
        this.responder = ciao.getResponder(interfaces ? { interface: interfaces } : undefined)
      }
      this.createService(generation, levels)
    } catch (error) {
      this.handleAdvertiseError(generation, error)
    }
  }

  /**
   * The instance name and the hostname have their own fallback level, a conflict only changes the name that conflicted
   *
   * @param {FallbackLevels} levels
   * @returns {{ name: string, hostname: string }}
   */
  getNamesForLevels(levels) {
    const { name, hostname, txt } = this.config
    return {
      name: levels.name > 0 ? MdnsManager.getFallbackNames(name, hostname, txt.id, levels.name).name : name,
      hostname: levels.hostname > 0 ? MdnsManager.getFallbackNames(name, hostname, txt.id, levels.hostname).hostname : hostname
    }
  }

  /**
   * @param {number} generation
   * @param {FallbackLevels} levels
   */
  createService(generation, levels) {
    const config = this.config
    const { name, hostname } = this.getNamesForLevels(levels)
    const service = this.responder.createService({
      name,
      type: SERVICE_TYPE,
      port: config.port,
      hostname,
      txt: config.txt,
      disabledIpv6: config.disableIpv6,
      // ciao maps an IP in the responder's interfaces to its whole interface, this only advertises that address
      ...(config.interfaces ? { restrictedAddresses: config.interfaces } : {})
    })
    this.service = service
    const advertised = { name, hostname: `${hostname}.local`, port: config.port }
    this.setStatus({ state: 'probing', ...advertised })

    // ciao retries failed probing internally and only reports it in its debug output, make a stuck probe visible
    clearTimeout(this.probingWatchdog)
    this.probingWatchdog = setTimeout(() => {
      if (this.service !== service || this.status.state !== 'probing') return
      const reason = `still probing for a unique name after ${PROBING_WATCHDOG / 1000}s, start with DEBUG=ciao:* for details`
      Logger.warn(`[MdnsManager] "${name}" is ${reason}`)
      this.setStatus({ state: 'retrying', reason, ...advertised })
    }, PROBING_WATCHDOG)
    this.probingWatchdog.unref?.()

    // Any rename by ciao means a name is taken on the network (during probing or later), we never keep ciao's
    // "name (N)" but move on to our next fallback name which always fits in a DNS label. 'abs-conflict' comes right
    // after the rename (patchCiaoProberConflicts), the others only once ciao finished probing its own "name (N)".
    let conflictHandled = false
    const onConflict = () => {
      if (conflictHandled || generation !== this.generation || this.service !== service) return
      conflictHandled = true
      clearInterval(this.renameCheck)
      // Only the name that conflicted moves on to its next fallback (RFC 6762 9)
      const conflict = MdnsManager.getConflictingNames(service)
      const nextLevels = { name: levels.name + (conflict.name ? 1 : 0), hostname: levels.hostname + (conflict.hostname ? 1 : 0) }
      const next = this.getNamesForLevels(nextLevels)
      const taken = MdnsManager.describeConflict(conflict, name, hostname)
      Logger.warn(`[MdnsManager] ${taken} already used by another device on the network, advertising as "${next.name}" (${next.hostname}.local). Choose a different server name in settings to change it.`)
      if (conflict.determined && ((conflict.name && levels.name >= 1) || (conflict.hostname && levels.hostname >= 1))) {
        // Fallback names contain part of this server's id, so they are only taken by a server with the same id
        Logger.warn(`[MdnsManager] Another server on the network appears to use the same server id (${config.txt.id}). This happens when its config directory was copied from this server. Apps identify servers by this id, so they may not tell the two apart.`)
      }
      this.persistFallback(config, nextLevels)
      this.scheduleConflictRetry(async () => {
        // A probe cancelled by destroy() leaves ciao's responder unable to probe again (its internal promise chain
        // stays rejected and later services report success without being announced), so start a new responder
        await this.releaseService()
        if (generation === this.generation) this.startService(generation, nextLevels)
      })
    }
    service.on('abs-conflict', onConflict)
    service.on('name-change', onConflict)
    service.on('hostname-change', onConflict)
    clearInterval(this.renameCheck)
    if (this.watchRenames) {
      const initialNames = `${service.getFQDN()} ${service.getHostname()}`
      this.renameCheck = setInterval(() => {
        if (`${service.getFQDN()} ${service.getHostname()}` !== initialNames) onConflict()
      }, RENAME_CHECK_INTERVAL)
      this.renameCheck.unref?.()
    }

    service
      .advertise()
      .then(() => {
        if (generation !== this.generation || this.service !== service || conflictHandled) return
        // e.g. the address to advertise was removed from its interface, ciao then announces no address at all
        if (typeof service.allAddressRecords === 'function' && !service.allAddressRecords().length) {
          this.handleAdvertiseError(generation, new Error('there is no address to advertise on any network interface'))
          return
        }
        this.retryDelay = RETRY_DELAY_MIN
        const url = `http://${hostname}.local:${config.port}${config.txt.path}`
        this.setStatus({ state: 'advertising', ...advertised, url })
        Logger.info(`[MdnsManager] Advertising "${name}" (_${SERVICE_TYPE}._tcp) at ${url}`)
      })
      .catch((error) => {
        if (this.service !== service || conflictHandled) return
        this.handleAdvertiseError(generation, error)
      })
  }

  /**
   * Probe the next name right away, unless there were too many conflicts recently (RFC 6762 8.1)
   *
   * @param {() => void} probe
   */
  scheduleConflictRetry(probe) {
    const now = Date.now()
    this.conflictTimes = this.conflictTimes.filter((time) => now - time < CONFLICT_RATE_LIMIT.window)
    this.conflictTimes.push(now)
    if (this.conflictTimes.length < CONFLICT_RATE_LIMIT.count) return probe()
    this.startRetryTimer(CONFLICT_RATE_LIMIT.delay, probe)
  }

  /**
   * @param {number} delay
   * @param {() => void} callback
   */
  startRetryTimer(delay, callback) {
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      callback()
    }, delay)
    this.retryTimer.unref?.()
  }

  /**
   * @param {MdnsConfig} config configured name and hostname the fallbacks are for
   * @param {FallbackLevels} levels fallback levels now in use
   */
  async persistFallback(config, levels) {
    try {
      const store = this.getSettingsStore()
      const settings = store.get()
      settings.mdnsFallbackFor = levels.name ? config.name : null
      settings.mdnsFallbackLevel = levels.name || null
      settings.mdnsHostnameFallbackFor = levels.hostname ? config.hostname : null
      settings.mdnsHostnameFallbackLevel = levels.hostname || null
      await store.save()
    } catch (error) {
      Logger.error('[MdnsManager] Failed to save mDNS fallback name', error)
    }
  }

  /**
   * @param {number} generation
   * @param {Error} error
   */
  async handleAdvertiseError(generation, error) {
    if (generation !== this.generation) return
    const delay = this.retryDelay
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_DELAY_MAX)
    Logger.error(`[MdnsManager] Failed to advertise on the local network, retrying in ${Math.round(delay / 1000)}s:`, error?.message || error)
    this.setStatus({ state: 'retrying', reason: String(error?.message || error) })
    await this.releaseService()
    if (generation !== this.generation) return
    this.startRetryTimer(delay, () => {
      if (generation === this.generation) this.advertise()
    })
  }

  async releaseService() {
    const { service, responder } = this
    this.service = null
    this.responder = null
    /**
     * @param {string} what
     * @param {() => Promise<void>} fn
     * @param {() => void} [onTimeout]
     */
    const run = (what, fn, onTimeout) => {
      const promise = Promise.resolve()
        .then(fn)
        .catch((error) => Logger.error(`[MdnsManager] Failed to stop mDNS advertising (${what})`, error))
      return MdnsManager.withTimeout(promise, STOP_TIMEOUT, () => {
        Logger.warn(`[MdnsManager] Stopping mDNS advertising (${what}) did not finish within ${STOP_TIMEOUT / 1000}s, continuing`)
        onTimeout?.()
      })
    }
    // destroy() sends goodbye packets (RFC 6762 10.1) so clients drop the record right away.
    // The responder is shut down even if that fails, otherwise ciao hands the same responder out again.
    if (service) await run('service', () => service.destroy())
    if (responder) {
      await MdnsManager.waitForResponderSockets(responder)
      const forceClose = () => MdnsManager.forceCloseResponder(responder)
      await run('responder', () => responder.shutdown(), forceClose)
    }
  }

  /**
   * ciao binds a responder's sockets once it has listed the network interfaces, a few milliseconds after
   * getResponder(). A responder shut down before they are bound still binds them afterwards and never closes them
   * (ciao <= 1.3.13-beta.0), e.g. when settings change right after start. Waits for that, briefly, using ciao internals.
   *
   * @param {Object} responder ciao Responder
   * @returns {Promise<void>}
   */
  static waitForResponderSockets(responder) {
    const init = Promise.resolve()
      // Responder.promiseChain starts with binding the sockets
      .then(() => responder?.promiseChain)
      .catch(() => {})
    return MdnsManager.withTimeout(init, RESPONDER_INIT_TIMEOUT, () => {})
  }

  /**
   * Close the sockets of a responder whose shutdown() hangs. ciao's shutdown() already removed it from its responder
   * cache (so the next getResponder() creates a new one) and stopped answering for its services, but only closes
   * the sockets once the goodbyes are sent. Uses ciao internals, so it is best effort.
   *
   * @param {Object} responder ciao Responder
   */
  static forceCloseResponder(responder) {
    const server = responder?.server
    if (server?.closed) return
    if (typeof server?.shutdown === 'function') {
      try {
        server.shutdown()
        Logger.warn('[MdnsManager] Closed the sockets of the previous mDNS responder, its goodbye packets may not have been sent')
        return
      } catch (error) {
        Logger.debug(`[MdnsManager] Could not close the sockets of the previous mDNS responder: ${error?.message || error}`)
      }
    }
    Logger.warn('[MdnsManager] The previous mDNS responder could not be stopped, its sockets stay open until the server restarts and its old name may still be answered')
  }

  async stopAdvertising() {
    this.generation++
    clearTimeout(this.retryTimer)
    this.retryTimer = null
    clearTimeout(this.probingWatchdog)
    clearInterval(this.renameCheck)
    await this.releaseService()
  }

  /**
   * Stop advertising on server shutdown, sending goodbyes. Never rejects and resolves within SHUTDOWN_TIMEOUT.
   *
   * @returns {Promise<void>}
   */
  stop() {
    this.serverOptions = null
    const stopped = this.enqueue(async () => {
      this.configKey = null
      await this.stopAdvertising()
      this.setStatus({ state: 'disabled', reason: 'server stopped' })
    })
    return MdnsManager.withTimeout(stopped, SHUTDOWN_TIMEOUT, () => Logger.warn(`[MdnsManager] Stopping mDNS advertising did not finish within ${SHUTDOWN_TIMEOUT / 1000}s, continuing shutdown`))
  }
}
module.exports = MdnsManager
