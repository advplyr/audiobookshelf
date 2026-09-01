<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderExternalServices" :description="$strings.MessageExternalServicesDescription">
      <form @submit.prevent="submitForm">
        <div class="flex items-center py-2">
          <ui-toggle-switch labeledBy="external-search-enabled" v-model="newSettings.externalSearchEnabled" :disabled="savingSettings" />
          <div class="pl-4">
            <span id="external-search-enabled">{{ $strings.LabelExternalSearchEnabled }}</span>
          </div>
        </div>

        <div class="flex items-center -mx-1 mb-2">
          <div class="w-full px-1">
            <ui-text-input-with-label v-model="newSettings.externalSearchUrl" :disabled="savingSettings" :label="$strings.LabelExternalSearchUrl" />
          </div>
        </div>

        <div class="flex items-center -mx-1 mb-2">
          <div class="w-full md:w-1/2 px-1">
            <ui-dropdown v-model="newSettings.externalSearchAuthType" :items="authTypes" :label="$strings.LabelExternalSearchAuthType" :disabled="savingSettings" />
          </div>
          <div v-if="newSettings.externalSearchAuthType === 'bearer'" class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label v-model="newSettings.externalSearchToken" type="password" :disabled="savingSettings" :label="$strings.LabelExternalSearchToken" />
          </div>
        </div>

        <div v-if="newSettings.externalSearchAuthType === 'basic'" class="flex items-center -mx-1 mb-2">
          <div class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label v-model="newSettings.externalSearchUsername" :disabled="savingSettings" :label="$strings.LabelUsername" />
          </div>
          <div class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label v-model="newSettings.externalSearchPassword" type="password" :disabled="savingSettings" :label="$strings.LabelPassword" />
          </div>
        </div>

        <div class="flex items-center -mx-1 mb-2">
          <div class="w-full md:w-1/2 px-1">
            <ui-dropdown v-model="newSettings.externalSearchProvider" :items="providers" :label="$strings.LabelMetadataProvider" :disabled="savingSettings" />
          </div>
          <div class="w-full md:w-1/2 px-1">
            <ui-text-input-with-label v-model="newSettings.externalSearchServerAddress" :disabled="savingSettings" :label="$strings.LabelExternalSearchServerAddress" />
            <p class="text-xs text-gray-400 mt-1">{{ $strings.LabelExternalSearchServerAddressHelp }}</p>
          </div>
        </div>

        <div class="flex items-center justify-end pt-4">
          <ui-btn v-if="hasUpdates" :disabled="savingSettings" type="button" class="mr-2" @click="resetChanges">{{ $strings.ButtonReset }}</ui-btn>
          <ui-btn :loading="savingSettings" :disabled="!hasUpdates" type="submit">{{ $strings.ButtonSave }}</ui-btn>
        </div>
      </form>

      <div v-show="loading" class="absolute top-0 left-0 w-full h-full bg-black/25 flex items-center justify-center">
        <ui-loading-indicator />
      </div>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      loading: false,
      savingSettings: false,
      settings: null,
      newSettings: {
        externalSearchEnabled: false,
        externalSearchUrl: null,
        externalSearchAuthType: 'none',
        externalSearchToken: null,
        externalSearchUsername: null,
        externalSearchPassword: null,
        externalSearchProvider: 'audible',
        externalSearchServerAddress: null
      }
    }
  },
  computed: {
    authTypes() {
      return [
        { text: this.$strings.LabelExternalSearchAuthTypeNone, value: 'none' },
        { text: this.$strings.LabelExternalSearchAuthTypeBearer, value: 'bearer' },
        { text: this.$strings.LabelExternalSearchAuthTypeBasic, value: 'basic' }
      ]
    },
    providers() {
      return this.$store.state.scanners.bookProviders || []
    },
    hasUpdates() {
      if (!this.settings) return false
      for (const key in this.newSettings) {
        if ((this.newSettings[key] || null) !== (this.settings[key] || null)) return true
      }
      return false
    }
  },
  methods: {
    resetChanges() {
      this.newSettings = { ...this.settings }
    },
    async loadSettings() {
      this.loading = true
      this.settings = await this.$axios.$get('/api/external-services').catch((error) => {
        console.error('Failed to load external service settings', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return null
      })
      this.loading = false
      if (this.settings) this.resetChanges()
    },
    async submitForm() {
      this.savingSettings = true
      const updatedSettings = await this.$axios.$patch('/api/external-services', this.newSettings).catch((error) => {
        console.error('Failed to update external service settings', error)
        this.$toast.error(error.response?.data || this.$strings.ToastFailedToUpdate)
        return null
      })
      this.savingSettings = false
      if (updatedSettings) {
        this.settings = updatedSettings
        this.resetChanges()
        this.$store.commit('setServerSettings', { ...this.$store.state.serverSettings, externalSearchEnabled: updatedSettings.externalSearchEnabled })
        this.$toast.success(this.$strings.ToastExternalServiceSettingsUpdateSuccess)
      }
    }
  },
  mounted() {
    this.$store.dispatch('scanners/fetchProviders')
    this.loadSettings()
  }
}
</script>
