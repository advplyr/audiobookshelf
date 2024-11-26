<template>
  <div class="w-full h-full relative">
    <form class="w-full h-full px-2 md:px-4 py-6" @submit.prevent="submitForm">
      <div class="flex flex-wrap -mx-1">
        <div class="w-full md:w-1/2 px-1">
          <ui-text-input-with-label ref="titleInput" v-model="details.title" :label="$strings.LabelTitle" @input="handleInputChange" />
        </div>
        <div class="flex-grow px-1 mt-2 md:mt-0">
          <ui-text-input-with-label ref="subtitleInput" v-model="details.subtitle" :label="$strings.LabelSubtitle" @input="handleInputChange" />
        </div>
      </div>

      <div class="flex flex-wrap mt-2 -mx-1">
        <div class="w-full md:w-3/4 px-1">
          <!-- Authors filter only contains authors in this library, uses filter data -->
          <ui-multi-select-query-input ref="authorsSelect" v-model="details.authors" :label="$strings.LabelAuthors" filter-key="authors" @input="handleInputChange" />
        </div>
        <div class="flex-grow px-1 mt-2 md:mt-0">
          <ui-text-input-with-label ref="publishYearInput" v-model="details.publishedYear" type="number" :label="$strings.LabelPublishYear" @input="handleInputChange" />
        </div>
      </div>

      <div class="flex mt-2 -mx-1">
        <div class="flex-grow px-1">
          <widgets-series-input-widget v-model="details.series" @input="handleInputChange" />
        </div>
      </div>

      <ui-textarea-with-label ref="descriptionInput" v-model="details.description" :rows="3" :label="$strings.LabelDescription" class="mt-2" @input="handleInputChange" />

      <div class="flex flex-wrap mt-2 -mx-1">
        <div class="w-full md:w-1/2 px-1">
          <ui-multi-select ref="genresSelect" v-model="details.genres" :label="$strings.LabelGenres" :items="genres" @input="handleInputChange" />
        </div>
        <div class="flex-grow px-1 mt-2 md:mt-0">
          <ui-multi-select ref="tagsSelect" v-model="newTags" :label="$strings.LabelTags" :items="tags" @input="handleInputChange" />
        </div>
      </div>

      <div class="flex flex-wrap mt-2 -mx-1">
        <div class="w-full md:w-1/2 px-1">
          <ui-multi-select ref="narratorsSelect" v-model="details.narrators" :label="$strings.LabelNarrators" :items="narrators" @input="handleInputChange" />
        </div>
        <div class="w-1/2 md:w-1/4 px-1 mt-2 md:mt-0">
          <ui-text-input-with-label ref="isbnInput" v-model="details.isbn" label="ISBN" @input="handleInputChange" />
        </div>
        <div class="w-1/2 md:w-1/4 px-1 mt-2 md:mt-0">
          <ui-text-input-with-label ref="asinInput" v-model="details.asin" label="ASIN" @input="handleInputChange" />
        </div>
      </div>

      <div class="flex flex-wrap mt-2 -mx-1">
        <div class="w-full md:w-1/4 px-1">
          <ui-text-input-with-label ref="publisherInput" v-model="details.publisher" :label="$strings.LabelPublisher" @input="handleInputChange" />
        </div>
        <div class="w-1/2 md:w-1/4 px-1 mt-2 md:mt-0">
          <ui-text-input-with-label ref="languageInput" v-model="details.language" :label="$strings.LabelLanguage" @input="handleInputChange" />
        </div>
        <div class="flex-grow px-1 pt-6 mt-2 md:mt-0">
          <div class="flex justify-center">
            <ui-checkbox v-model="details.explicit" :label="$strings.LabelExplicit" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" @input="handleInputChange" />
          </div>
        </div>
        <div class="flex-grow px-1 pt-6 mt-2 md:mt-0">
          <div class="flex justify-center">
            <ui-checkbox v-model="details.abridged" :label="$strings.LabelAbridged" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" @input="handleInputChange" />
          </div>
        </div>
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
        subtitle: null,
        description: null,
        authors: [],
        narrators: [],
        series: [],
        publishedYear: null,
        publisher: null,
        language: null,
        isbn: null,
        asin: null,
        genres: [],
        explicit: false,
        abridged: false
      },
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
    series() {
      return this.filterData.series || []
    },
    narrators() {
      return this.filterData.narrators || []
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    }
  },
  methods: {
    handleInputChange() {
      this.$emit('change', {
        libraryItemId: this.libraryItem.id,
        hasChanges: this.checkForChanges().hasChanges
      })
    },
    getDetails() {
      this.forceBlur()
      return this.checkForChanges()
    },
    getTitleAndAuthorName() {
      this.forceBlur()
      return {
        title: this.details.title,
        author: (this.details.authors || []).map((au) => au.name).join(', ')
      }
    },
    mapBatchDetails(batchDetails, mapType = 'overwrite') {
      for (const key in batchDetails) {
        if (mapType === 'append') {
          if (key === 'tags') {
            // Concat and remove dupes
            this.newTags = [...new Set(this.newTags.concat(batchDetails.tags))]
          } else if (key === 'genres' || key === 'narrators') {
            // Concat and remove dupes
            this.details[key] = [...new Set(this.details[key].concat(batchDetails[key]))]
          } else if (key === 'authors' || key === 'series') {
            batchDetails[key].forEach((detail) => {
              const existingDetail = this.details[key].find((_d) => _d.name.toLowerCase() == detail.name.toLowerCase().trim() || _d.id == detail.id)
              if (!existingDetail) {
                this.details[key].push({ ...detail })
              }
            })
          }
        } else {
          if (key === 'tags') {
            this.newTags = [...batchDetails.tags]
          } else if (key === 'genres' || key === 'narrators') {
            this.details[key] = [...batchDetails[key]]
          } else if (key === 'authors' || key === 'series') {
            this.details[key] = batchDetails[key].map((i) => ({ ...i }))
          } else {
            this.details[key] = batchDetails[key]
          }
        }
      }
      this.handleInputChange()
    },
    forceBlur() {
      if (this.$refs.titleInput) this.$refs.titleInput.blur()
      if (this.$refs.subtitleInput) this.$refs.subtitleInput.blur()
      if (this.$refs.publishYearInput) this.$refs.publishYearInput.blur()
      if (this.$refs.descriptionInput) this.$refs.descriptionInput.blur()
      if (this.$refs.isbnInput) this.$refs.isbnInput.blur()
      if (this.$refs.asinInput) this.$refs.asinInput.blur()
      if (this.$refs.publisherInput) this.$refs.publisherInput.blur()
      if (this.$refs.languageInput) this.$refs.languageInput.blur()

      if (this.$refs.authorsSelect && this.$refs.authorsSelect.isFocused) {
        this.$refs.authorsSelect.forceBlur()
      }
      if (this.$refs.narratorsSelect && this.$refs.narratorsSelect.isFocused) {
        this.$refs.narratorsSelect.forceBlur()
      }
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

      for (let i = 0; i < array1.length; i++) {
        const item1 = array1[i]
        const item2 = array2[i]
        if (!item1 || !item2) return false

        for (const key in item1) {
          if (item1[key] !== item2[key]) {
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
        } else if (key === 'narrators' || key === 'genres') {
          // Check array of strings
          if (!this.stringArrayEqual(newValue, oldValue)) {
            metadata[key] = [...newValue]
          }
        } else if (key === 'authors' || key === 'series') {
          if (!this.objectArrayEqual(newValue, oldValue)) {
            metadata[key] = newValue.map((v) => ({ ...v }))
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
      return {
        updatePayload,
        hasChanges: !!Object.keys(updatePayload).length
      }
    },
    init() {
      this.details.title = this.mediaMetadata.title
      this.details.subtitle = this.mediaMetadata.subtitle
      this.details.description = this.mediaMetadata.description
      this.details.authors = (this.mediaMetadata.authors || []).map((se) => ({ ...se }))
      this.details.narrators = [...(this.mediaMetadata.narrators || [])]
      this.details.genres = [...(this.mediaMetadata.genres || [])]
      this.details.series = (this.mediaMetadata.series || []).map((se) => ({ ...se }))
      this.details.publishedYear = this.mediaMetadata.publishedYear
      this.details.publisher = this.mediaMetadata.publisher || null
      this.details.language = this.mediaMetadata.language || null
      this.details.isbn = this.mediaMetadata.isbn || null
      this.details.asin = this.mediaMetadata.asin || null
      this.details.explicit = !!this.mediaMetadata.explicit
      this.details.abridged = !!this.mediaMetadata.abridged
      this.newTags = [...(this.media.tags || [])]
    },
    submitForm() {
      this.$emit('submit')
    }
  },
  mounted() {}
}
</script>
