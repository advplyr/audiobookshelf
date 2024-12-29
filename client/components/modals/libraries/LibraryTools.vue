<template>
  <div class="w-full h-full px-1 md:px-2 py-1 mb-4">
    <div class="w-full border border-black-200 p-4 my-8">
      <div class="flex flex-wrap items-center">
        <div>
          <p class="text-lg">{{ $strings.LabelRemoveMetadataFile }}</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">{{ $getString('LabelRemoveMetadataFileHelp', [mediaType]) }}</p>
        </div>
        <div class="flex-grow" />
        <div>
          <ui-btn class="mb-4 block" @click.stop="removeAllMetadataClick('json')">{{ $strings.LabelRemoveAllMetadataJson }}</ui-btn>
          <ui-btn @click.stop="removeAllMetadataClick('abs')">{{ $strings.LabelRemoveAllMetadataAbs }}</ui-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    library: {
      type: Object,
      default: () => null
    },
    libraryId: String,
    processing: Boolean
  },
  data() {
    return {}
  },
  computed: {
    librarySettings() {
      return this.library.settings || {}
    },
    mediaType() {
      return this.library.mediaType
    },
    isBookLibrary() {
      return this.mediaType === 'book'
    }
  },
  methods: {
    removeAllMetadataClick(ext) {
      const payload = {
        message: this.$getString('MessageConfirmRemoveMetadataFiles', [ext]),
        persistent: true,
        callback: (confirmed) => {
          if (confirmed) {
            this.removeAllMetadataInLibrary(ext)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    removeAllMetadataInLibrary(ext) {
      this.$emit('update:processing', true)
      this.$axios
        .$post(`/api/libraries/${this.libraryId}/remove-metadata?ext=${ext}`)
        .then((data) => {
          if (!data.found) {
            this.$toast.info(this.$getString('ToastMetadataFilesRemovedNoneFound', [ext]))
          } else if (!data.removed) {
            this.$toast.success(this.$getString('ToastMetadataFilesRemovedNoneRemoved', [ext]))
          } else {
            this.$toast.success(this.$getString('ToastMetadataFilesRemovedSuccess', [data.removed, ext]))
          }
        })
        .catch((error) => {
          console.error('Failed to remove metadata files', error)
          this.$toast.error(this.$getString('ToastMetadataFilesRemovedError', [ext]))
        })
        .finally(() => {
          this.$emit('update:processing', false)
        })
    }
  },
  mounted() {}
}
</script>
