<template>
  <modals-modal ref="modal" v-model="show" name="custom-metadata-provider" :width="600" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">Add custom metadata provider</p>
      </div>
    </template>
    <form @submit.prevent="submitForm">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 overflow-y-auto overflow-x-hidden" style="min-height: 400px; max-height: 80vh">
        <div class="w-full p-8">
          <div class="w-full mb-4">
            <ui-text-input-with-label v-model="newName" :label="$strings.LabelName" />
          </div>
          <div class="w-full mb-4">
            <ui-text-input-with-label v-model="newUrl" :label="$strings.LabelUrl" />
          </div>
          <div class="w-full mb-4">
            <ui-text-input-with-label v-model="newApiKey" :label="$strings.LabelApiKey" type="password" />
          </div>
          <div class="flex pt-4 px-2">
            <div class="flex-grow" />
            <ui-btn color="success" type="submit">{{ $strings.ButtonAdd }}</ui-btn>
          </div>
        </div>
      </div>
    </form>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
  },
  data() {
    return {
      processing: false,
      newName: "",
      newUrl: "",
      newApiKey: "",
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
    },
  },
  methods: {
    close() {
      // Force close when navigating - used in the table
      if (this.$refs.modal) this.$refs.modal.setHide()
    },
    submitForm() {
      if (!this.newName || !this.newUrl || !this.newApiKey) {
        this.$toast.error('Must add name, url and API key')
        return
      }

      this.processing = true
      this.$axios
          .$patch('/api/custom-metadata-providers/admin', {
            name: this.newName,
            url: this.newUrl,
            apiKey: this.newApiKey,
          })
          .then((data) => {
            this.processing = false
            if (data.error) {
              this.$toast.error(`Failed to add provider: ${data.error}`)
            } else {
              this.$toast.success('New provider added')
              this.show = false
            }
          })
          .catch((error) => {
            this.processing = false
            console.error('Failed to add provider', error)
            this.$toast.error('Failed to add provider')
          })
    },
    init() {
      this.processing = false
      this.newName = ""
      this.newUrl = ""
      this.newApiKey = ""
    }
  },
  mounted() {}
}
</script>
