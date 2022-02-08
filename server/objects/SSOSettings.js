const Logger = require('../Logger')
const User = require('./User')
const { isObject } = require('../utils')

const defaultSettings = {
    createNewUser: false,
    userPermissions: User.getDefaultUserPermissions('guest')
}

class SSOSettings {
  constructor(settings = defaultSettings) {
    this.id = 'sso-settings'
    this.createNewUser = !!settings.createNewUser
    this.userPermissions = { ...settings.userPermissions }
    this.initOIDCSettings();
  }

  initOIDCSettings() {
    // can't be part of default settings, because apperently process.env is not set in the beginning
    this.oidc = {
      issuer: process.env.OIDC_ISSUER || '',
      authorizationURL: process.env.OIDC_AUTHORIZATION_URL || '',
      tokenURL: process.env.OIDC_TOKEN_URL || '',
      userInfoURL: process.env.OIDC_USER_INFO_URL || '',
      clientID: process.env.OIDC_CLIENT_ID || '',
      clientSecret: process.env.OIDC_CLIENT_SECRET || '',
      callbackURL: "/oidc/callback",
      scope: "openid email profile"
    }
  }
  get isOIDCConfigured() {
    // Check required OIDC settings are set
    return !['issuer', 'authorizationURL', 'tokenURL', 'clientID', 'clientSecret'].some(key => !this.oidc[key])
  }

  toJSON() {
    return {
      id: this.id,
      oidc: { ...this.oidc },
      createNewUser: this.createNewUser,
      userPermissions: { ...this.userPermissions }
    }
  }

  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      if (isObject(payload[key])) {
        for (const setting in payload[key]) {
          if (!this[key] || this[key][setting] === payload[key][setting]) {
            continue
          }
          this[key][setting] = payload[key][setting]
          hasUpdates = true
        }
      } else if (this[key] !== undefined && this[key] !== payload[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  getNewUserPermissions() {
    return {
      ...this.userPermissions
    }
  }

  getOIDCSettings() {
    return {
      ...this.oidc
    }
  }
}
module.exports = SSOSettings