const defaultSSOSettings = {
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
    permissions: {
      download: false,
      update: false,
      delete: false,
      upload: false,
      accessAllLibraries: false
    }
  }
}

export const state = () => defaultSSOSettings

export const getters = {
  getSSOIssuer: (state) => state.oidc.issuer,
  getSSOAuthorizationURL: (state) => state.oidc.authorizationURL,
  getSSOTokenURL: (state) => state.oidc.tokenURL,
  getSSOUserInfoURL: (state) => state.oidc.userInfoURL,
  getSSOClientID: (state) => state.oidc.clientID,
  getSSOClientSecret: (state) => state.oidc.clientSecret,
  getSSOCallbackURL: (state) => state.oidc.callbackURL,
  getSSOScope: (state) => state.oidc.scope,

  getUserCreateNewUser: (state) => state.user.createNewUser,
  getUserIsActive: (state) => state.user.isActive,
  getUserPermissionDownload: (state) => state.user.permissions.download,
  getUserPermissionUpdate: (state) => state.user.permissions.update,
  getUserPermissionDelete: (state) => state.user.permissions.delete,
  getUserPermissionUpload: (state) => state.user.permissions.upload,
  getUserPermissionAccessAllLibraries: (state) => state.user.permissions.accessAllLibraries,
}

export const actions = {
  updateSSOSettings({ commit }, payload) {
    var updatePayload = {
      ...payload
    }
    // Immediately update
    commit('setSSOSettings', updatePayload)
    return this.$axios.$patch('/api/SSOSettings', updatePayload).then((result) => {
      if (result.success) {
        commit('setSSOSettings', result.settings)
        return true
      } else {
        return false
      }
    }).catch((error) => {
      console.error('Failed to update sso settings', error)
      return false
    })
  },
  loadSSOSettings({ state, commit }) {

    return this.$axios.$get('/api/collections').then((collections) => {
      commit('setCollections', collections)
      return collections
    }).catch((error) => {
      console.error('Failed to get collections', error)
      return []
    })
  }
}

export const mutations = {
  setSSOSettings(state, settings) {
    if (!settings || !settings.oidc || !settings.user) return

    for (const key in settings.oidc) {
      state.oidc[key] = settings.oidc[key]
    }

    for (const key in settings.user) {
      if (typeof settings.user[key] === "object" && typeof state.user[key] === "object") {
        for (const key2 in settings.user[key]) {
          state.user[key][key2] = settings.user[key][key2]
        }
        continue
      }
      if (state.user[key] !== undefined) {
        state.user[key] = settings.user[key]
      }
    }
  },
}