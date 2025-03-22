<template>
  <modals-modal ref="modal" v-model="show" name="custom-metadata-provider" :width="600" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.HeaderAddCustomMetadataProvider }}</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full flex items-center text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 overflow-y-auto overflow-x-hidden" style="min-height: 400px; max-height: 80vh">
        <div class="w-full p-8">
          <div class="flex mb-2">
            <div class="w-3/4 p-1">
              <ui-text-input-with-label v-model="newName" :label="$strings.LabelName" trim-whitespace />
            </div>
            <div class="w-1/4 p-1">
              <ui-text-input-with-label value="Book" readonly :label="$strings.LabelMediaType" />
            </div>
          </div>
          <div class="w-full mb-2 p-1">
            <ui-text-input-with-label v-model="newUrl" label="URL" trim-whitespace />
          </div>
          <div class="w-full mb-2 p-1">
            <ui-text-input-with-label v-model="newAuthHeaderValue" :label="$strings.LabelProviderAuthorizationValue" type="password" />
          </div>
          <div class="flex px-1 pt-4">
            <div class="grow" />
            <ui-btn color="bg-success" type="submit">{{ $strings.ButtonAdd }}</ui-btn>
          </div>
        </div>
      </div>
    </form>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean
  },
  data() {
    return {
      processing: false,
      newName: '',
      newUrl: '',
      newAuthHeaderValue: ''
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  methods: {
    async submitForm() {
      // Remove focus from active input
      document.activeElement?.blur?.()
      await this.$nextTick()

      if (!this.newName || !this.newUrl) {
        this.$toast.error(this.$strings.ToastProviderNameAndUrlRequired)
        return
      }

      this.processing = true
      this.$axios
        .$post('/api/custom-metadata-providers', {
          name: this.newName,
          url: this.newUrl,
          mediaType: 'book', // Currently only supporting book mediaType
          authHeaderValue: this.newAuthHeaderValue
        })
        .then((data) => {
          this.$emit('added', data.provider)
          this.$toast.success(this.$strings.ToastProviderCreatedSuccess)
          this.show = false
        })
        .catch((error) => {
          const errorMsg = error.response?.data || 'Unknown error'
          console.error('Failed to add provider', error)
          this.$toast.error(this.$strings.ToastProviderCreatedFailed + ': ' + errorMsg)
        })
        .finally(() => {
          this.processing = false
        })
    },
    init() {
      this.processing = false
      this.newName = ''
      this.newUrl = ''
      this.newAuthHeaderValue = ''
    }
  },
  mounted() {}
}
</script>
