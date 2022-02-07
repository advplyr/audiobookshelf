const { CoverDestination, BookCoverAspectRatio, BookshelfView } = require('../utils/constants')
const Logger = require('../Logger')
const User = require('./User')

const defaultSettings = {
  oidc: {
    issuer: "",
    authorizationURL: "",
    tokenURL: "",
    userInfoURL: "",
    clientID: "",
    clientSecret: "",
    callbackURL: "/oidc/callback",
    scope: "openid email profile"  
  },
  user: {
    createNewUser: false,
    isActive: true,
    userSettings: {
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
    permissions: {
      download: false,
      update: false,
      delete: false,
      upload: false,
      accessAllLibraries: false
    }
  }
}

class SSOSettings {
  constructor(settings=defaultSettings) {
    this.id = 'sso-settings'
    this.oidc = {...settings.oidc}
    this.user = {...settings.user}
  }

  toJSON() {
    return {
      oidc: {...this.oidc},
      user: {...this.user}
    }
  }

  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      for (const setting in payload) {
        if (!this[key] || this[key][setting] === payload[key][setting]) {
          continue
        }
        this[key][setting] = payload[key][setting]
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}
module.exports = SSOSettings