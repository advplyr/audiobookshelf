<template>
  <div>
    <!-- <div class="h-0.5 bg-primary bg-opacity-50 w-full" /> -->

    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
      <div class="flex items-center mb-2">
        <h1 class="text-xl">SSO Provider Settings</h1>
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Issuer&nbsp;</p>
        <ui-text-input v-model="oidc.issuer" :disabled="updatingSSOSettings" @input="updateSSOIssuer" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Authorization URL&nbsp;</p>
        <ui-text-input v-model="oidc.authorizationURL" :disabled="updatingSSOSettings" @input="updateAuthorizationURL" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Token URL&nbsp;</p>
        <ui-text-input v-model="oidc.tokenURL" :disabled="updatingSSOSettings" @input="updateTokenURL" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">User Info URL&nbsp;</p>
        <ui-text-input v-model="oidc.userInfoURL" :disabled="updatingSSOSettings" @input="updateUserInfoURL" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client ID&nbsp;</p>
        <ui-text-input v-model="oidc.clientID" :disabled="updatingSSOSettings" @input="updateClientID" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client Secret&nbsp;</p>
        <ui-text-input type="password" v-model="oidc.clientSecret" :disabled="updatingSSOSettings" @input="updateClientSecret" />
      </div>

      <div class="flex items-center mb-2">
        <h1 class="text-xl">User Settings</h1>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissions.createNewUser" :disabled="updatingSSOSettings" @input="updatePermissionCreateNewUser" />
        <p class="pl-4 text-lg">Create a new user on first login</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissions.download" :disabled="updatingSSOSettings || !permissions.createNewUser" @input="updatePermissionDownload" />
        <p class="pl-4 text-lg">The new user is allowed to download</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissions.update" :disabled="updatingSSOSettings || !permissions.createNewUser" @input="updatePermissionUpdate" />
        <p class="pl-4 text-lg">The new user is allowed to update</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissions.delete" :disabled="updatingSSOSettings || !permissions.createNewUser" @input="updatePermissionDelete" />
        <p class="pl-4 text-lg">The new user is allowed to delete</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissions.upload" :disabled="updatingSSOSettings || !permissions.createNewUser" @input="updatePermissionUpload" />
        <p class="pl-4 text-lg">The new user is allowed to upload</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissions.accessAllLibraries" :disabled="updatingSSOSettings || !permissions.createNewUser" @input="updatePermissionAccessAllLibraries" />
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

      permissions: {
        createNewUser: false,
        download: false,
        update: false,
        delete: false,
        upload: false,
        accessAllLibraries: false
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
      return this.$store.state.SSOSettings
    },
  },
  methods: {
    updateSSOIssuer(val) {
      this.oidc.issuer = val
    },
    updateAuthorizationURL(val) {
      this.oidc.authorizationURL = val
    },
    updateTokenURL(val) {
      this.oidc.tokenURL = val
    },
    updateUserInfoURL(val) {
      this.oidc.userInfoURL = val
    },
    updateClientID(val) {
      this.oidc.clientID = val
    },
    updateClientSecret(val) {
      this.oidc.clientSecret = val
    },
    updatePermissionCreateNewUser(val) {
      this.permissions.createNewUser = val
    },
    updatePermissionDownload(val) {
      this.permissions.createNewUser = val
    },
    updatePermissionUpdate(val) {
      this.permissions.createNewUser = val
    },
    updatePermissionDelete(val) {
      this.permissions.createNewUser = val
    },
    updatePermissionUpload(val) {
      this.permissions.createNewUser = val
    },
    updatePermissionAccessAllLibraries(val) {
      this.permissions.createNewUser = val
    },
    updatePermissionCreateNewUser(val) {
      this.permissions.createNewUser = val
    },
    saveSSOSettings(payload) {
      this.updatingSSOSettings = true
      this.$store
        .dispatch('sso/updateSSOSettings', {oidc: this.oidc, permissions: this.permissions})
        .then((success) => {
          console.log('Updated SSO Settings', success)
          this.updatingSSOSettings = false
        })
        .catch((error) => {
          console.error('Failed to update SSO settings', error)
          this.updatingSSOSettings = false
        })
    },
    initSSOSettings() {
      this.newSSOSettings = this.SSOSettings ? { ...this.SSOSettings } : {}


      this.oidc.issuer = this.newSSOSettings.issuer
      this.oidc.authorizationURL = this.newSSOSettings.authorizationURL
      this.oidc.tokenURL = this.newSSOSettings.tokenURL
      this.oidc.userInfoURL = this.newSSOSettings.userInfoURL
      this.oidc.clientID = this.newSSOSettings.clientID
      this.oidc.clientSecret = this.newSSOSettings.clientSecret
      this.updatingSSOSettings = this.newSSOSettings.updatingSSOSettings

      // this.newSSOSettings.coverDestination === this.$constants.CoverDestination.AUDIOBOOK
      // this.useSquareBookCovers = this.newSSOSettings.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE
      // this.useAlternativeBookshelfView = this.newSSOSettings.bookshelfView === this.$constants.BookshelfView.TITLES
    },
    
  },
  mounted() {
    this.initSSOSettings()
  }
}
</script>