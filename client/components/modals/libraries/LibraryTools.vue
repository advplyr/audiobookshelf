<template>
  <div class="w-full h-full px-1 md:px-2 py-1 mb-4">
    <div v-if="isBookLibrary" class="w-full border border-black-200 p-4 my-8">
      <div class="flex flex-wrap items-center">
        <div>
          <p class="text-lg">Detect Missing Series With AI</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">Analyze books in this library and add missing series names and sequence values using OpenAI. Use the full re-evaluation option after editing book metadata and you want existing series assignments reconsidered.</p>
        </div>
        <div class="grow" />
        <div>
          <ui-btn class="mb-3 block" :disabled="processing || !openAIConfigured" @click.stop="detectSeriesWithAI">Detect Missing Series</ui-btn>
          <ui-btn :disabled="processing || !openAIConfigured" @click.stop="reEvaluateSeriesWithAI">Re-evaluate All Series</ui-btn>
        </div>
      </div>
      <p v-if="!openAIConfigured" class="text-sm text-yellow-400 mt-3">Configure OpenAI first in server settings.</p>
    </div>

    <div v-if="isBookLibrary" class="w-full border border-black-200 p-4 my-8">
      <div class="flex flex-wrap items-center">
        <div>
          <p class="text-lg">Dedupe Books With AI</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">Analyze likely duplicate books in this library with OpenAI, keep the best copy, and remove the duplicate items. This deletes duplicate files from disk.</p>
        </div>
        <div class="grow" />
        <div>
          <ui-btn :disabled="processing || !openAIConfigured" @click.stop="dedupeBooksWithAI">Dedupe Books</ui-btn>
        </div>
      </div>
      <p v-if="!openAIConfigured" class="text-sm text-yellow-400 mt-3">Configure OpenAI first in server settings.</p>
    </div>

    <div class="w-full border border-black-200 p-4 my-8">
      <div class="flex flex-wrap items-center">
        <div>
          <p class="text-lg">{{ $strings.LabelRemoveMetadataFile }}</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">{{ $getString('LabelRemoveMetadataFileHelp', [mediaType]) }}</p>
        </div>
        <div class="grow" />
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
    },
    openAIConfigured() {
      return !!this.$store.getters['getServerSetting']('openAIConfigured')
    }
  },
  methods: {
    detectSeriesWithAI() {
      const payload = {
        message: 'Detect missing series in this library with AI? This only fills books that currently have no series metadata.',
        callback: (confirmed) => {
          if (confirmed) {
            this.runSeriesDetection(true)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    reEvaluateSeriesWithAI() {
      const payload = {
        message: 'Re-evaluate all books in this library with AI? This can update sequence values for books that already have series metadata.',
        callback: (confirmed) => {
          if (confirmed) {
            this.runSeriesDetection(false)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    dedupeBooksWithAI() {
      const payload = {
        message: 'Deduplicate books in this library with AI? Duplicate items chosen for removal will be deleted from the database and file system.',
        callback: (confirmed) => {
          if (confirmed) {
            this.runBookDedupe()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    runSeriesDetection(onlyMissing = true) {
      this.$emit('update:processing', true)
      this.$axios
        .$post(`/api/libraries/${this.libraryId}/detect-series-with-ai?onlyMissing=${onlyMissing ? 1 : 0}`)
        .then((data) => {
          if (!data.updated) {
            this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
          } else {
            this.$toast.success(onlyMissing ? `AI added series data to ${data.updated} books` : `AI re-evaluated series data for ${data.updated} books`)
          }
        })
        .catch((error) => {
          console.error('Failed to detect series with AI', error)
          this.$toast.error(error.response?.data || this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.$emit('update:processing', false)
        })
    },
    runBookDedupe() {
      this.$emit('update:processing', true)
      this.$axios
        .$post(`/api/libraries/${this.libraryId}/dedupe-books-with-ai?hard=1`)
        .then((data) => {
          if (!data.duplicatesRemoved) {
            this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
          } else {
            this.$toast.success(`AI removed ${data.duplicatesRemoved} duplicate books`)
          }
        })
        .catch((error) => {
          console.error('Failed to dedupe books with AI', error)
          this.$toast.error(error.response?.data || this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.$emit('update:processing', false)
        })
    },
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
