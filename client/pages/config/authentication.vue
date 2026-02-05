<template>
  <div id="authentication-settings">
    <app-settings-content :header-text="$strings.HeaderAuthentication">
      <div class="w-full border border-white/10 rounded-xl p-4 my-4 bg-primary/25">
        <div class="flex items-center">
          <ui-checkbox v-model="showCustomLoginMessage" checkbox-bg="bg" />
          <p class="text-lg pl-4">{{ $strings.HeaderCustomMessageOnLogin }}</p>
        </div>
        <transition name="slide">
          <div v-if="showCustomLoginMessage" class="w-full pt-4">
            <ui-rich-text-editor v-model="newAuthSettings.authLoginCustomMessage" />
          </div>
        </transition>
      </div>

      <div class="w-full border border-white/10 rounded-xl p-4 my-4 bg-primary/25">
        <div class="flex items-center">
          <ui-checkbox v-model="enableLocalAuth" checkbox-bg="bg" />
          <p class="text-lg pl-4">{{ $strings.HeaderPasswordAuthentication }}</p>
        </div>
      </div>
      <div class="w-full border border-white/10 rounded-xl p-4 my-4 bg-primary/25">
        <div class="flex items-center">
          <ui-checkbox v-model="enableOpenIDAuth" checkbox-bg="bg" />
          <p class="text-lg pl-4">{{ $strings.HeaderOpenIDConnectAuthentication }}</p>
          <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
            <a href="https://www.audiobookshelf.org/guides/oidc_authentication" target="_blank" class="inline-flex">
              <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
            </a>
          </ui-tooltip>
        </div>

        <transition name="slide">
          <div v-if="enableOpenIDAuth" class="pt-4">
            <app-oidc-settings :schema="openIDSchema" :groups="openIDGroups" :values="openIDValues" :schema-overrides="openIDSchemaOverrides" :disabled="savingSettings" @update="onOidcSettingChange" @action="onOidcAction" />
          </div>
        </transition>
      </div>
      <div class="w-full flex items-center justify-end p-4">
        <ui-btn color="bg-success" :padding-x="8" small class="text-base" :loading="savingSettings" @click="saveSettings">{{ $strings.ButtonSave }}</ui-btn>
      </div>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  async asyncData({ store, redirect, app }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
      return
    }

    const authSettings = await app.$axios.$get('/api/auth-settings').catch((error) => {
      console.error('Failed', error)
      return null
    })
    if (!authSettings) {
      redirect('/config')
      return
    }
    return {
      authSettings
    }
  },
  data() {
    return {
      enableLocalAuth: false,
      enableOpenIDAuth: false,
      showCustomLoginMessage: false,
      savingSettings: false,
      openIDSchemaOverrides: {},
      newAuthSettings: {},
      openIDValues: {}
    }
  },
  computed: {
    authMethods() {
      return this.authSettings.authActiveAuthMethods || []
    },
    openIDSchema() {
      return this.authSettings.openIDSettings?.schema || []
    },
    openIDGroups() {
      return this.authSettings.openIDSettings?.groups || []
    }
  },
  methods: {
    onOidcSettingChange({ key, value }) {
      this.$set(this.openIDValues, key, value)
    },
    onOidcAction(action) {
      if (action === 'discover') {
        this.discoverOIDC()
      }
    },
    async discoverOIDC() {
      let issuerUrl = this.openIDValues.authOpenIDIssuerURL
      if (!issuerUrl) {
        this.$toast.error('Issuer URL required')
        return
      }

      // Remove trailing slash
      if (issuerUrl.endsWith('/')) issuerUrl = issuerUrl.slice(0, -1)

      // If the full config path is on the issuer url then remove it
      if (issuerUrl.endsWith('/.well-known/openid-configuration')) {
        issuerUrl = issuerUrl.replace('/.well-known/openid-configuration', '')
        this.$set(this.openIDValues, 'authOpenIDIssuerURL', issuerUrl)
      }

      try {
        const data = await this.$axios.$post('/api/auth-settings/openid/discover', { issuerUrl })

        // Apply discovered values
        if (data.values) {
          for (const [key, value] of Object.entries(data.values)) {
            if (value !== null && value !== undefined) {
              this.$set(this.openIDValues, key, value)
            }
          }
        }

        // Apply schema overrides (e.g., supported signing algorithms)
        if (data.schemaOverrides) {
          this.openIDSchemaOverrides = data.schemaOverrides
        }
      } catch (error) {
        console.error('Failed to discover OIDC config', error)
        const errorMsg = error.response?.data?.error || error.response?.data || 'Unknown error'
        this.$toast.error(errorMsg)
      }
    },
    async saveSettings() {
      if (!this.enableLocalAuth && !this.enableOpenIDAuth) {
        this.$toast.error('Must have at least one authentication method enabled')
        return
      }

      if (!this.showCustomLoginMessage || !this.newAuthSettings.authLoginCustomMessage?.trim()) {
        this.newAuthSettings.authLoginCustomMessage = null
      }

      const authActiveAuthMethods = []
      if (this.enableLocalAuth) authActiveAuthMethods.push('local')
      if (this.enableOpenIDAuth) authActiveAuthMethods.push('openid')

      const payload = {
        authLoginCustomMessage: this.newAuthSettings.authLoginCustomMessage,
        authActiveAuthMethods,
        openIDSettings: this.openIDValues
      }

      this.savingSettings = true
      try {
        const data = await this.$axios.$patch('/api/auth-settings', payload)
        this.$store.commit('setServerSettings', data.serverSettings)
        if (data.updated) {
          this.$toast.success(this.$strings.ToastServerSettingsUpdateSuccess)
        } else {
          this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
        }
      } catch (error) {
        console.error('Failed to update server settings', error)
        if (error.response?.data?.details) {
          error.response.data.details.forEach((detail) => this.$toast.error(detail))
        } else {
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        }
      } finally {
        this.savingSettings = false
      }
    },
    init() {
      this.newAuthSettings = {
        authLoginCustomMessage: this.authSettings.authLoginCustomMessage,
        authActiveAuthMethods: this.authSettings.authActiveAuthMethods
      }

      // Initialize OIDC values from server response
      const serverValues = this.authSettings.openIDSettings?.values || {}
      this.openIDValues = {
        ...serverValues,
        authOpenIDSubfolderForRedirectURLs: serverValues.authOpenIDSubfolderForRedirectURLs === undefined ? this.$config.routerBasePath : serverValues.authOpenIDSubfolderForRedirectURLs
      }

      this.enableLocalAuth = this.authMethods.includes('local')
      this.enableOpenIDAuth = this.authMethods.includes('openid')
      this.showCustomLoginMessage = !!this.authSettings.authLoginCustomMessage
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
#authentication-settings code {
  font-size: 0.8rem;
  border-radius: 6px;
  background-color: rgb(82, 82, 82);
  color: white;
  padding: 2px 4px;
  white-space: nowrap;
}
</style>
