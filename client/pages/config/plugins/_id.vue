<template>
  <div>
    <app-settings-content :header-text="`Plugin: ${pluginManifest.name}`">
      <template #header-prefix>
        <nuxt-link to="/config/plugins" class="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center mr-2">
          <span class="material-symbols text-2xl">arrow_back</span>
        </nuxt-link>
      </template>
      <template #header-items>
        <ui-tooltip v-if="pluginManifest.documentationUrl" :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a :href="pluginManifest.documentationUrl" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>

        <div class="flex-grow" />

        <a v-if="repositoryUrl" :href="repositoryUrl" target="_blank" class="abs-btn outline-none rounded-md shadow-md relative border border-gray-600 text-center bg-primary text-white px-4 py-1 text-sm inline-flex items-center space-x-2"><span>Source</span><span class="material-symbols text-base">open_in_new</span> </a>
      </template>

      <div class="py-4">
        <p v-if="configDescription" class="mb-4">{{ configDescription }}</p>

        <form v-if="configFormFields.length" @submit.prevent="handleFormSubmit">
          <template v-for="field in configFormFields">
            <div :key="field.name" class="flex items-center mb-4">
              <label :for="field.name" class="w-1/3 text-gray-200">{{ field.label }}</label>
              <div class="w-2/3">
                <input :id="field.name" :type="field.type" :placeholder="field.placeholder" class="w-full bg-bg border border-white border-opacity-20 rounded-md p-2 text-gray-200" />
              </div>
            </div>
          </template>

          <div class="flex justify-end">
            <ui-btn class="bg-primary bg-opacity-70 text-white rounded-md p-2" :loading="processing" type="submit">{{ $strings.ButtonSave }}</ui-btn>
          </div>
        </form>
      </div>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  async asyncData({ store, redirect, params, app }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
    const pluginConfigData = await app.$axios.$get(`/api/plugins/${params.id}/config`).catch((error) => {
      console.error('Failed to get plugin config', error)
      return null
    })
    if (!pluginConfigData) {
      redirect('/config/plugins')
    }
    const pluginManifest = store.state.plugins.find((plugin) => plugin.id === params.id)
    if (!pluginManifest) {
      redirect('/config/plugins')
    }
    return {
      pluginManifest,
      pluginConfig: pluginConfigData.config
    }
  },
  data() {
    return {
      processing: false
    }
  },
  computed: {
    pluginManifestConfig() {
      return this.pluginManifest.config
    },
    pluginLocalization() {
      return this.pluginManifest.localization || {}
    },
    localizedStrings() {
      const localeKey = this.$languageCodes.current
      if (!localeKey) return {}
      return this.pluginLocalization[localeKey] || {}
    },
    configDescription() {
      if (this.pluginManifestConfig.descriptionKey && this.localizedStrings[this.pluginManifestConfig.descriptionKey]) {
        return this.localizedStrings[this.pluginManifestConfig.descriptionKey]
      }

      return this.pluginManifestConfig.description
    },
    configFormFields() {
      return this.pluginManifestConfig.formFields || []
    },
    repositoryUrl() {
      return this.pluginManifest.repositoryUrl
    }
  },
  methods: {
    getFormData() {
      const formData = {}
      this.configFormFields.forEach((field) => {
        if (field.type === 'checkbox') {
          formData[field.name] = document.getElementById(field.name).checked
        } else {
          formData[field.name] = document.getElementById(field.name).value
        }
      })
      return formData
    },
    handleFormSubmit() {
      const formData = this.getFormData()
      console.log('Form data', formData)

      const payload = {
        config: formData
      }

      this.processing = true

      this.$axios
        .$post(`/api/plugins/${this.pluginManifest.id}/config`, payload)
        .then(() => {
          console.log('Plugin configuration saved')
        })
        .catch((error) => {
          const errorMsg = error.response?.data || 'Error saving plugin configuration'
          console.error('Failed to save config:', error)
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.processing = false
        })
    },
    initializeForm() {
      if (!this.pluginConfig) return
      this.configFormFields.forEach((field) => {
        if (this.pluginConfig[field.name] === undefined) {
          return
        }

        const value = this.pluginConfig[field.name]
        if (field.type === 'checkbox') {
          document.getElementById(field.name).checked = value
        } else {
          document.getElementById(field.name).value = value
        }
      })
    }
  },
  mounted() {
    console.log('Plugin manifest', this.pluginManifest, 'config', this.pluginConfig)
    this.initializeForm()
  },
  beforeDestroy() {}
}
</script>
