<template>
  <modals-modal v-model="show" name="upload-image" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div class="flex items-center">
        <div class="w-40 pr-2 pt-4" style="min-width: 160px">
          <ui-file-input ref="fileInput" @change="fileUploadSelected">Upload Cover</ui-file-input>
        </div>
        <form @submit.prevent="submitForm" class="flex flex-grow">
          <ui-text-input-with-label v-model="imageUrl" label="Cover Image URL" />
          <ui-btn color="success" type="submit" :padding-x="4" class="mt-5 ml-3 w-24">Update</ui-btn>
        </form>
      </div>
      <div v-if="previewUpload" class="absolute top-0 left-0 w-full h-full z-10 bg-bg p-8">
        <p class="text-lg">Preview Cover</p>
        <span class="absolute top-4 right-4 material-symbols text-2xl cursor-pointer" @click="resetCoverPreview">close</span>
        <div class="flex justify-center py-4">
          <covers-preview-cover :src="previewUpload" :width="240" />
        </div>
        <div class="absolute bottom-0 right-0 flex py-4 px-5">
          <ui-btn :disabled="processingUpload" class="mx-2" @click="resetCoverPreview">Clear</ui-btn>
          <ui-btn :loading="processingUpload" color="success" @click="submitCoverUpload">Upload</ui-btn>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    entity: String,
    entityId: String
  },
  data() {
    return {
      imageUrl: null,
      previewUpload: null,
      processingUpload: false
    }
  },
  watch: {
    value(newVal) {
      if (newVal) this.init()
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
    init() {},
    fileUploadSelected() {
      this.previewUpload = URL.createObjectURL(file)
      this.selectedFile = file
    },
    resetCoverPreview() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.reset()
      }
      this.previewUpload = null
      this.selectedFile = null
    },
    submitCoverUpload() {
      this.processingUpload = true
      var form = new FormData()
      form.set('cover', this.selectedFile)

      this.$axios
        .$post(`/api/${this.entity}/${this.entityId}/cover`, form)
        .then((data) => {
          if (data.error) {
            this.$toast.error(data.error)
          } else {
            this.resetCoverPreview()
          }
          this.processingUpload = false
        })
        .catch((error) => {
          console.error('Failed', error)
          var errorMsg = error.response && error.response.data ? error.response.data : this.$strings.ToastUnknownError
          this.$toast.error(errorMsg)
          this.processingUpload = false
        })
    },
    async submitForm() {
      this.processingUpload = true

      var success = await this.$axios.$post(`/api/${this.entity}/${this.entityId}/cover`, { url: this.imageUrl }).catch((error) => {
        console.error('Failed to download cover from url', error)
        var errorMsg = error.response && error.response.data ? error.response.data : this.$strings.ToastUnknownError
        this.$toast.error(errorMsg)
        return false
      })

      this.processingUpload = false
    }
  }
}
</script>
