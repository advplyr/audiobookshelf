<template>
  <div class="w-full h-full px-1 md:px-2 py-1 mb-4">
    <div class="w-full border border-black-200 p-4 my-8">
      <div class="flex flex-wrap items-center">
        <div>
          <p class="text-lg">Remove metadata files in library item folders</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">Remove all metadata.json or metadata.abs files in your {{ mediaType }} folders</p>
        </div>
        <div class="flex-grow" />
        <div>
          <ui-btn class="mb-4 block" @click.stop="removeAllMetadataClick('json')">Remove all metadata.json</ui-btn>
          <ui-btn @click.stop="removeAllMetadataClick('abs')">Remove all metadata.abs</ui-btn>
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
