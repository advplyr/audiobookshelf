<template>
  <div class="w-full h-full relative">
    <form class="w-full h-full px-4 py-6" @submit.prevent="submitForm">
      <div class="flex -mx-1">
        <div class="w-1/2 px-1">
          <ui-text-input-with-label ref="titleInput" v-model="details.title" label="Title" />
        </div>
        <div class="flex-grow px-1">
          <ui-text-input-with-label ref="authorInput" v-model="details.author" label="Author" />
        </div>
      </div>

      <ui-text-input-with-label ref="feedUrlInput" v-model="details.feedUrl" label="RSS Feed URL" class="mt-2" />

      <ui-textarea-with-label ref="descriptionInput" v-model="details.description" :rows="3" label="Description" class="mt-2" />

      <div class="flex mt-2 -mx-1">
        <div class="w-1/2 px-1">
          <ui-multi-select ref="genresSelect" v-model="details.genres" label="Genres" :items="genres" />
        </div>
        <div class="flex-grow px-1">
          <ui-multi-select ref="tagsSelect" v-model="newTags" label="Tags" :items="tags" />
        </div>
      </div>

      <div class="flex mt-2 -mx-1">
        <div class="w-1/4 px-1">
          <ui-text-input-with-label ref="releaseDateInput" v-model="details.releaseDate" label="Release Date" />
        </div>
        <div class="w-1/4 px-1">
          <ui-text-input-with-label ref="itunesIdInput" v-model="details.itunesId" label="iTunes ID" />
        </div>
        <div class="w-1/4 px-1">
          <ui-text-input-with-label ref="languageInput" v-model="details.language" label="Language" />
        </div>
        <div class="flex-grow px-1 pt-6">
          <div class="flex justify-center">
            <ui-checkbox v-model="details.explicit" label="Explicit" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
          </div>
        </div>
      </div>

      <div class="flex-grow px-1 pt-6">
        <ui-checkbox v-model="autoDownloadEpisodes" label="Auto Download New Episodes" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
      </div>
    </form>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      details: {
        title: null,
        author: null,
        description: null,
        releaseDate: null,
        genres: [],
        feedUrl: null,
        imageUrl: null,
        itunesPageUrl: null,
        itunesId: null,
        itunesArtistId: null,
        explicit: false,
        language: null
      },
      autoDownloadEpisodes: false,
      newTags: []
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    genres() {
      return this.filterData.genres || []
    },
    tags() {
      return this.filterData.tags || []
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    }
  },
  methods: {
    getDetails() {
      this.forceBlur()
      return this.checkForChanges()
    },
    getTitleAndAuthorName() {
      this.forceBlur()
      return {
        title: this.details.title,
        author: this.details.author
      }
    },
    mapBatchDetails(batchDetails) {
      for (const key in batchDetails) {
        if (key === 'tags') {
          this.newTags = [...batchDetails.tags]
        } else if (key === 'genres') {
          this.details[key] = [...batchDetails[key]]
        } else {
          this.details[key] = batchDetails[key]
        }
      }
    },
    forceBlur() {
      if (this.$refs.titleInput) this.$refs.titleInput.blur()
      if (this.$refs.authorInput) this.$refs.authorInput.blur()
      if (this.$refs.releaseDateInput) this.$refs.releaseDateInput.blur()
      if (this.$refs.descriptionInput) this.$refs.descriptionInput.blur()
      if (this.$refs.feedUrlInput) this.$refs.feedUrlInput.blur()
      if (this.$refs.itunesIdInput) this.$refs.itunesIdInput.blur()
      if (this.$refs.languageInput) this.$refs.languageInput.blur()

      if (this.$refs.genresSelect && this.$refs.genresSelect.isFocused) {
        this.$refs.genresSelect.forceBlur()
      }
      if (this.$refs.tagsSelect && this.$refs.tagsSelect.isFocused) {
        this.$refs.tagsSelect.forceBlur()
      }
    },
    stringArrayEqual(array1, array2) {
      // return false if different
      if (array1.length !== array2.length) return false
      for (var item of array1) {
        if (!array2.includes(item)) return false
      }
      return true
    },
    objectArrayEqual(array1, array2) {
      const isIterable = (value) => {
        return Symbol.iterator in Object(value)
      }
      if (!isIterable(array1) || !isIterable(array2)) {
        console.error(array1, array2)
        throw new Error('Invalid arrays passed in')
      }

      // array of objects with id key
      if (array1.length !== array2.length) return false

      for (var item of array1) {
        var matchingItem = array2.find((a) => a.id === item.id)
        if (!matchingItem) return false
        for (var key in item) {
          if (item[key] !== matchingItem[key]) {
            // console.log('Object array item keys changed', key, item[key], matchingItem[key])
            return false
          }
        }
      }
      return true
    },
    checkForChanges() {
      var metadata = {}
      for (const key in this.details) {
        var newValue = this.details[key]
        var oldValue = this.mediaMetadata[key]
        // Key cleared out or key first populated
        if ((!newValue && oldValue) || (newValue && !oldValue)) {
          metadata[key] = newValue
        } else if (key === 'genres') {
          // Check array of strings
          if (!this.stringArrayEqual(newValue, oldValue)) {
            metadata[key] = [...newValue]
          }
        } else if (newValue && newValue != oldValue) {
          // Intentional !=
          metadata[key] = newValue
        }
      }
      var updatePayload = {}
      if (!!Object.keys(metadata).length) updatePayload.metadata = metadata

      if (!this.stringArrayEqual(this.newTags, this.media.tags || [])) {
        updatePayload.tags = [...this.newTags]
      }

      if (this.media.autoDownloadEpisodes !== this.autoDownloadEpisodes) {
        updatePayload.autoDownloadEpisodes = !!this.autoDownloadEpisodes
      }

      return {
        updatePayload,
        hasChanges: !!Object.keys(updatePayload).length
      }
    },
    init() {
      this.details.title = this.mediaMetadata.title
      this.details.author = this.mediaMetadata.author || ''
      this.details.description = this.mediaMetadata.description || ''
      this.details.releaseDate = this.mediaMetadata.releaseDate || ''
      this.details.genres = [...(this.mediaMetadata.genres || [])]
      this.details.feedUrl = this.mediaMetadata.feedUrl || ''
      this.details.imageUrl = this.mediaMetadata.imageUrl || ''
      this.details.itunesPageUrl = this.mediaMetadata.itunesPageUrl || ''
      this.details.itunesId = this.mediaMetadata.itunesId || ''
      this.details.itunesArtistId = this.mediaMetadata.itunesArtistId || ''
      this.details.language = this.mediaMetadata.language || ''
      this.details.explicit = !!this.mediaMetadata.explicit

      this.autoDownloadEpisodes = !!this.media.autoDownloadEpisodes
      this.newTags = [...(this.media.tags || [])]
    },
    submitForm() {
      this.$emit('submit')
    }
  },
  mounted() {}
}
</script>