class AuthError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
    this.name = 'AuthError'
  }
}

module.exports = AuthError
