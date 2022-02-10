const Logger = require('../Logger')
const User = require('./User')
const { isObject } = require('../utils')
const { difference } = require('../utils/string')

const defaultSettings = {
    createNewUser: false,
    user: {
      createNewUser: false,
      isActive: true,
      settings: {
        mobileOrderBy: 'recent',
        mobileOrderDesc: true,
        mobileFilterBy: 'all',
        orderBy: 'book.title',
        orderDesc: false,
        filterBy: 'all',
        playbackRate: 1,
        bookshelfCoverSize: 120,
        collapseSeries: false
      },
      permissions: User.getDefaultUserPermissions('guest')
    }
}

class SSOSettings {
  constructor(settings = defaultSettings) {
    this.id = 'sso-settings'
    this.user = { ...settings.user }
    this.initOIDCSettings(settings);
  }

  initOIDCSettings(settings) {
    // can't be part of default settings, because apperently process.env is not set in the beginning
    if (settings && settings.oidc) {
      this.oidc = {
        issuer: settings.oidc.issuer,
        authorizationURL: settings.oidc.authorizationURL,
        tokenURL: settings.oidc.tokenURL,
        userInfoURL: settings.oidc.userInfoURL,
        clientID: settings.oidc.clientID,
        clientSecret: settings.oidc.clientSecret,
        callbackURL: "/oidc/callback",
        scope: "openid email profile"
      }
      return
    }
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
    const tmp = {
      id: this.id,
      oidc: { ...this.oidc },
      user: { ...this.user }
    }
    return tmp
  }

  update(payload) {
    const oldTmp = JSON.stringify(this.toJSON())
    const newTmp = JSON.stringify(payload) // deep copy "for free"
    const hasUpdates = difference(oldTmp, newTmp) !== ""; // Not very efficient, but ok for small objects
    if (!hasUpdates) return hasUpdates

    payload = JSON.parse(newTmp)
    this.oidc = payload.oidc
    this.user = payload.user
    return hasUpdates
  }

  getNewUserPermissions() {
    return {
      ...this.user.permissions
    }
  }

  getOIDCSettings() {
    return {
      ...this.oidc
    }
  }
}
module.exports = SSOSettings