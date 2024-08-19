const passport = require('passport')
const requestIp = require('../libs/requestIp')

function ipToBinary(ip) {
  if (ip === '::1') {
    ip = '127.0.0.1'
  }
  return ip
    .split('.')
    .map(Number)
    .map((num) => num.toString(2).padStart(8, '0'))
    .join('')
}

function binaryToIp(binary) {
  return binary
    .match(/.{8}/g)
    .map((bin) => parseInt(bin, 2))
    .join('.')
}

function cidrToMask(cidr) {
  const mask = Array(32).fill('0')
  for (let i = 0; i < cidr; i++) {
    mask[i] = '1'
  }
  return mask
    .join('')
    .match(/.{8}/g)
    .map((bin) => parseInt(bin, 2))
    .join('.')
}

/**
 * Checks if an IP address falls within a given CIDR range.
 * If no range is provided, it assumes the CIDR + range are in the "0.0.0.0/0" format.
 *
 * @param {string} ip - The IP address to check. Can be either IPv4 or IPv6.
 * @param {string} cidr - The CIDR notation specifying the network. If `range` is not provided, this value represents the network IP and CIDR in "IP/CIDR" format.
 * @param {string} [range] - The IP address representing the range or network. Optional. If not provided, the function assumes "0.0.0.0/0" as the default range.
 * @returns {boolean} `true` if the IP address is within the given CIDR range; otherwise, `false`.
 */
function ipInRange(ip, cidr, range) {
  // if no range is provided, assume the cidr + range are in the "0.0.0.0/0" format
  if (!range) {
    let [rangeIp, rangeCidr] = cidr.split('/')
    if (!rangeCidr) {
      rangeCidr = '0' // if no cidr is provided, assume 0 (exact match)
    }
    return ipInRange(ip, rangeCidr, rangeIp)
  }
  const mask = cidrToMask(cidr)
  const ipBin = ipToBinary(ip)
  const maskBin = ipToBinary(mask)
  const rangeBin = ipToBinary(range)

  // Apply the mask to the IP and range
  const ipNetwork = ipBin.substring(0, maskBin.length)
  const rangeNetwork = rangeBin.substring(0, maskBin.length)

  return ipNetwork === rangeNetwork
}

class ForwardStrategy extends passport.Strategy {
  /**
   * Creates a new ForwardStrategy instance.
   * A ForwardStrategy instance authenticates requests based on the contents of the `X-Forwarded-User` header
   *
   * @param {Function} verify The function to call to verify the user.
   */
  constructor(options, verify) {
    super()
    // if verify is not provided, assume the first argument is the verify function
    if (!verify && typeof options === 'function') {
      verify = options
    } else if (!verify) {
      throw new TypeError('ForwardStrategy requires a verify callback')
    }
    this.name = 'forward'
    this._verify = verify
    this._header = options.header || 'x-forwarded-user'
  }

  /**
   * Authenticate request based on the contents of the `X-Forwarded-User` header.
   * @param {*} req The request to authenticate.
   * @returns {void} Calls `success`, `fail`, or `error` based on the result of the authentication.
   */
  authenticate(req) {
    const username = req.headers[this._header]
    const ip = requestIp.getClientIp(req)
    if (!username) {
      return this.fail('No username found')
    }

    this._verify(req, username, ip, (err, user) => {
      if (err) {
        return this.error(err)
      }
      if (!user) {
        return this.fail('No user found')
      }
      this.success(user)
    })
  }
}

module.exports = {
  ForwardStrategy,
  ipInRange
}
