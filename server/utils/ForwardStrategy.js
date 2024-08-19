const passport = require('passport')
const requestIp = require('../libs/requestIp')

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
    const ipAddress = requestIp.getClientIp(req)

    if (!username) {
      return this.fail('No username found')
    }

    if (!ipAddress) {
      return this.fail('No IP address found')
    }

    this._verify(req, username, ipAddress, (err, user) => {
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

module.exports = ForwardStrategy
