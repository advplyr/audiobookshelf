<template>
  <div>
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
      <div class="flex items-center mb-2">
        <h1 class="text-xl">SSO Provider Settings</h1>
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Issuer&nbsp;</p>
        <ui-text-input v-model="oidc.issuer" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Authorization URL&nbsp;</p>
        <ui-text-input v-model="oidc.authorizationURL" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Token URL&nbsp;</p>
        <ui-text-input v-model="oidc.tokenURL" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">User Info URL&nbsp;</p>
        <ui-text-input v-model="oidc.userInfoURL" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client ID&nbsp;</p>
        <ui-text-input v-model="oidc.clientID" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center py-2">
        <p class="pl-4 text-lg">Client Secret&nbsp;</p>
        <ui-text-input type="password" v-model="oidc.clientSecret" :disabled="updatingSSOSettings" />
      </div>

      <div class="flex items-center mb-2">
        <h1 class="text-xl">User Settings</h1>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="user.createNewUser" :disabled="updatingSSOSettings" />
        <p class="pl-4 text-lg">Create a new user on first login</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionDownload" :disabled="updatingSSOSettings || !user.createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to download</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionUpdate" :disabled="updatingSSOSettings || !user.createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to update</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionDelete" :disabled="updatingSSOSettings || !user.createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to delete</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionUpload" :disabled="updatingSSOSettings || !user.createNewUser" />
        <p class="pl-4 text-lg">The new user is allowed to upload</p>
      </div>

      <div class="flex items-center mb-2">
        <ui-toggle-switch v-model="permissionAccessAllLibraries" :disabled="updatingSSOSettings || !user.createNewUser" />
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
        issuer: '',
        authorizationURL: '',
        tokenURL: '',
        userInfoURL: '',
        clientID: '',
        clientSecret: ''
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
      updatingSSOSettings: false
    }
  },
  watch: {
    SSOSettings(newVal, oldVal) {
      console.log('SSO Settings set', newVal, oldVal)
      if (newVal && !oldVal) {
        this.initSSOSettings()
      }
    }
  },
  computed: {
    SSOSettings() {
      return this.$store.state.settings.SSOSettings
    },
    permissionDownload: {
      get() {
        return this.user.permissions.download
      },
      set(val) {
        this.user.permissions.download = val
      }
    },
    permissionUpdate: {
      get() {
        return this.user.permissions.update
      },
      set(val) {
        this.user.permissions.update = val
      }
    },
    permissionDelete: {
      get() {
        return this.user.permissions.delete
      },
      set(val) {
        this.user.permissions.delete = val
      }
    },
    permissionUpload: {
      get() {
        return this.user.permissions.upload
      },
      set(val) {
        this.user.permissions.upload = val
      }
    },
    permissionAccessAllLibraries: {
      get() {
        return this.user.permissions.accessAllLibraries
      },
      set(val) {
        this.user.permissions.accessAllLibraries = val
      }
    }
  },
  methods: {
    saveSSOSettings() {
      this.updatingSSOSettings = true
      this.$store
        .dispatch('settings/updateSSOSettings', { oidc: this.oidc, user: this.user })
        .then((payload) => {
          console.log('Update SSO settings success', payload)
          this.updatingSSOSettings = false
          this.$toast.success('SSO Settings Saved')
        })
        .catch((error) => {
          console.error('Failed to update SSO settings', error)
          this.updatingSSOSettings = false
          this.$toast.error('Failed to save SSO Settings')
        })
    },
    initSSOSettings() {
      if (!this.SSOSettings || !this.SSOSettings.user || !this.SSOSettings.oidc) {
        console.error('Invalid SSOSettings obj', this.SSOSettings)
        return
      }

      for (const key in this.SSOSettings.oidc) {
        this.oidc[key] = this.SSOSettings.oidc[key]
      }

      for (const key in this.SSOSettings.user) {
        if (typeof this.SSOSettings.user[key] === 'object' && typeof this.user[key] === 'object') {
          for (const key2 in this.SSOSettings.user[key]) {
            this.user[key][key2] = this.SSOSettings.user[key][key2]
          }
          continue
        }
        if (this.user[key] !== undefined) {
          this.user[key] = this.SSOSettings.user[key]
        }
      }
    }
  },
  mounted() {
    if (this.SSOSettings) this.initSSOSettings()
  }
}
</script>