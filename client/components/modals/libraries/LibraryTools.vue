<template>
  <div class="w-full h-full px-1 md:px-4 py-1 mb-4">
    <ui-btn class="mb-4" @click.stop="removeAllMetadataClick('json')">Remove all metadata.json files in library item folders</ui-btn>
    <ui-btn @click.stop="removeAllMetadataClick('abs')">Remove all metadata.abs files in library item folders</ui-btn>
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
        message: `Are you sure you want to remove all metadata.${ext} files in your library item folders?`,
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
            this.$toast.info(`No metadata.${ext} files were found in library`)
          } else if (!data.removed) {
            this.$toast.success(`No metadata.${ext} files removed`)
          } else {
            this.$toast.success(`Successfully removed ${data.removed} metadata.${ext} files`)
          }
        })
        .catch((error) => {
          console.error('Failed to remove metadata files', error)
          this.$toast.error('Failed to remove metadata files')
        })
        .finally(() => {
          this.$emit('update:processing', false)
        })
    }
  },
  mounted() {}
}
</script>