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
        <ui-text-input v-model="oidc.tokenURL" :disabled="updatingSSOSettings" @input="updateSSOIssuer" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">User Info URL&nbsp;</p>
        <ui-text-input v-model="oidc.userInfoURL" :disabled="updatingSSOSettings" @input="updateSSOIssuer" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client ID&nbsp;</p>
        <ui-text-input v-model="oidc.clientID" :disabled="updatingSSOSettings" @input="updateSSOIssuer" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client Secret&nbsp;</p>
        <ui-text-input type="password" v-model="oidc.clientSecret" :disabled="updatingSSOSettings" @input="updateSSOIssuer" />
      </div>

      <div class="flex items-center mb-2">
        <h1 class="text-xl">User Settings</h1>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissions.createNewUser" :disabled="updatingSSOSettings" @input="updateCreateNewUser" />
        <p class="pl-4 text-lg">Create a new user on first login</p>
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
      return
      this.updateSSOSettings({
        issuer: val
      })
    },
    updateAuthorizationURL(val) {
      return
      this.updateSSOSettings({
        authorizationURL: val
      })
    },
    updateCreateNewUser(val) {
      return
      this.updateSSOSettings({
        authorizationURL: val
      })
    },
    saveSSOSettings(payload) {
      console.log(this)
      this.updatingSSOSettings = true
      this.$store
        .dispatch('updateSSOSettings', payload)
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