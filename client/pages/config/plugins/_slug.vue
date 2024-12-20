<template>
  <div>
    <app-settings-content :header-text="`Plugin: ${plugin.name}`">
      <template #header-prefix>
        <nuxt-link to="/config/plugins" class="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center mr-2">
          <span class="material-symbols text-2xl">arrow_back</span>
        </nuxt-link>
      </template>
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
      </template>

      <div class="py-4">
        <p class="mb-4">{{ configDescription }}</p>

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
  asyncData({ store, redirect, params }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
    const plugin = store.state.plugins.find((plugin) => plugin.slug === params.slug)
    if (!plugin) {
      redirect('/config/plugins')
    }
    return {
      plugin
    }
  },
  data() {
    return {
      processing: false
    }
  },
  computed: {
    pluginConfig() {
      return this.plugin.config
    },
    pluginLocalization() {
      return this.plugin.localization || {}
    },
    localizedStrings() {
      const localeKey = this.$languageCodes.current
      if (!localeKey) return {}
      return this.pluginLocalization[localeKey] || {}
    },
    configDescription() {
      if (this.pluginConfig.descriptionKey && this.localizedStrings[this.pluginConfig.descriptionKey]) {
        return this.localizedStrings[this.pluginConfig.descriptionKey]
      }

      return this.pluginConfig.description
    },
    configFormFields() {
      return this.pluginConfig.formFields || []
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
        pluginSlug: this.plugin.slug,
        config: formData
      }

      this.processing = true

      this.$axios
        .$post(`/api/plugins/config`, payload)
        .then(() => {
          console.log('Plugin configuration saved')
        })
        .catch((error) => {
          console.error('Error saving plugin configuration', error)
          this.$toast.error('Error saving plugin configuration')
        })
        .finally(() => {
          this.processing = false
        })
    }
  },
  mounted() {
    console.log('Plugin', this.plugin)
  },
  beforeDestroy() {}
}
</script>
