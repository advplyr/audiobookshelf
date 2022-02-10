<template>
  <div>
    <!-- <div class="h-0.5 bg-primary bg-opacity-50 w-full" /> -->

    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
      <div class="flex items-center mb-2">
        <h1 class="text-xl">SSO Provider Settings</h1>
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Issuer&nbsp;</p>
        <ui-text-input v-model="issuer" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Authorization URL&nbsp;</p>
        <ui-text-input v-model="authorizationURL" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Token URL&nbsp;</p>
        <ui-text-input v-model="tokenURL" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">User Info URL&nbsp;</p>
        <ui-text-input v-model="userInfoURL" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client ID&nbsp;</p>
        <ui-text-input v-model="clientID" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client Secret&nbsp;</p>
        <ui-text-input type="password" v-model="clientSecret" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center mb-2">
        <h1 class="text-xl">User Settings</h1>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="createNewUser" :disabled="updatingSSOSettings" />
        <p class="pl-4 text-lg">Create a new user on first login</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionDownload" :disabled="updatingSSOSettings || !createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to download</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionUpdate" :disabled="updatingSSOSettings || !createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to update</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionDelete" :disabled="updatingSSOSettings || !createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to delete</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionUpload" :disabled="updatingSSOSettings || !createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to upload</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionAccessAllLibraries" :disabled="updatingSSOSettings || !createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to access all libraries</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-btn @click="saveSSOSettings">Save</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      oidc: {
        issuer: "",
        authorizationURL: "",
        tokenURL: "",
        userInfoURL: "",
        clientID: "",
        clientSecret: "",
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
      },
      updatingSSOSettings: false,
      newSSOSettings: {}
    }
  },
  watch: {
    SSOSettings(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.newSSOSettings = { ...this.SSOSettings }
        this.initSSOSettings()
      }
    }
  },
  computed: {
    SSOSettings() {
      return this.$store.state.sso
    },

    issuer: {
      get() {
        return this.oidc.issuer
        return this.$store.state.sso.oidc.issuer
      },
      set(val) {
        this.oidc.issuer = val
        // this.$store.state.sso.oidc.issuer = val
      }
    },
    authorizationURL: {
      get() {
        return this.oidc.authorizationURL
        return this.$store.state.sso.oidc.authorizationURL
      },
      set(val) {
        this.oidc.authorizationURL = val
        // this.$store.state.sso.oidc.authorizationURL = val
      }
    },
    tokenURL: {
      get() {
        return this.oidc.tokenURL
        return this.$store.state.sso.oidc.tokenURL
      },
      set(val) {
        this.oidc.tokenURL = val
        // this.$store.state.sso.oidc.tokenURL = val
      }
    },
    userInfoURL: {
      get() {
        return this.oidc.userInfoURL
        return this.$store.state.sso.oidc.userInfoURL
      },
      set(val) {
        this.oidc.userInfoURL = val
        // this.$store.state.sso.oidc.userInfoURL = val
      },
    },
    clientID: {
      get() {
        return this.oidc.clientID
        return this.$store.state.sso.oidc.clientID
      },
      set(val) {
        this.oidc.clientID = val
        // this.$store.state.sso.oidc.clientID = val
      },
    },
    clientSecret: {
      get() {
        return this.oidc.clientSecret
        return this.$store.state.sso.oidc.clientSecret
      },
      set(val) {
        this.oidc.clientSecret = val
        // this.$store.state.sso.oidc.clientSecret = val
      },
    },
    createNewUser: {
      get() {
        return this.user.createNewUser
        return this.$store.state.sso.createNewUser
      },
      set(val) {
        this.user.createNewUser = val
        // this.$store.state.sso.createNewUser = val
      },
    },
    permissionDownload: {
      get() {
        return this.user.permissions.download
        return this.$store.state.sso.permissions.download
      },
      set(val) {
        this.user.permissions.download = val
        // this.$store.state.sso.permissions.download = val
      },
    },
    permissionUpdate: {
      get() {
        return this.user.permissions.update
        return this.$store.state.sso.permissions.update
      },
      set(val) {
        this.user.permissions.update = val
        // this.$store.state.sso.permissions.update = val
      },
    },
    permissionDelete: {
      get() {
        return this.user.permissions.delete
        return this.$store.state.sso.permissions.delete
      },
      set(val) {
        this.user.permissions.delete = val
        // this.$store.state.sso.permissions.delete = val
      },
    },
    permissionUpload: {
      get() {
        return this.user.permissions.upload
        return this.$store.state.sso.permissions.upload
      },
      set(val) {
        this.user.permissions.upload = val
        // this.$store.state.sso.permissions.upload = val
      }
    },
    permissionAccessAllLibraries: {
      get() {
        return this.user.permissions.accessAllLibraries
        return this.$store.state.sso.permissions.accessAllLibraries
      },
      set(val) {
        this.user.permissions.accessAllLibraries = val
        // this.$store.state.sso.permissions.accessAllLibraries = val
      }
    },
  },
  methods: {
    saveSSOSettings(payload) {
      this.updatingSSOSettings = true
      this.$store
        .dispatch('sso/updateSSOSettings', {oidc: this.oidc, user: this.user})
        .then((success) => {
          this.updatingSSOSettings = false
        })
        .catch((error) => {
          console.error('Failed to update SSO settings', error)
          this.updatingSSOSettings = false
        })
    },
    initSSOSettings() {
      for (const key in this.$store.state.sso.oidc) {
        this.oidc[key] = this.$store.state.sso.oidc[key]
      }

      for (const key in this.$store.state.sso.user) {
        if (typeof this.$store.state.sso.user[key] === "object" && typeof this.user[key] === "object") {
          for (const key2 in this.$store.state.sso.user[key]) {
            this.user[key][key2] = this.$store.state.sso.user[key][key2]
          }
          continue
        }
        if (this.user[key] !== undefined) {
          this.user[key] = this.$store.state.sso.user[key]
        }
      }
    },
    
  },
  mounted() {
    this.initSSOSettings()
  }
}
</script>