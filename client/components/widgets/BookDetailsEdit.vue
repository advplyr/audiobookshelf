<template>
  <div class="w-full h-full relative">
    <form class="w-full h-full" @submit.prevent="submitForm">
      <div id="formWrapper" class="px-4 py-6 details-form-wrapper w-full overflow-hidden overflow-y-auto">
        <div class="flex -mx-1">
          <div class="w-1/2 px-1">
            <ui-text-input-with-label ref="titleInput" v-model="details.title" label="Title" />
          </div>
          <div class="flex-grow px-1">
            <ui-text-input-with-label ref="subtitleInput" v-model="details.subtitle" label="Subtitle" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="w-3/4 px-1">
            <!-- Authors filter only contains authors in this library, use query input to query all authors -->
            <ui-multi-select-query-input ref="authorsSelect" v-model="details.authors" label="Authors" endpoint="authors/search" />
          </div>
          <div class="flex-grow px-1">
            <ui-text-input-with-label ref="publishYearInput" v-model="details.publishedYear" type="number" label="Publish Year" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="flex-grow px-1">
            <ui-multi-select-query-input ref="seriesSelect" v-model="seriesItems" text-key="displayName" label="Series" readonly show-edit @edit="editSeriesItem" @add="addNewSeries" />
          </div>
        </div>

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
          <div class="w-1/2 px-1">
            <ui-multi-select ref="narratorsSelect" v-model="details.narrators" label="Narrators" :items="narrators" />
          </div>
          <div class="w-1/4 px-1">
            <ui-text-input-with-label ref="isbnInput" v-model="details.isbn" label="ISBN" />
          </div>
          <div class="w-1/4 px-1">
            <ui-text-input-with-label ref="asinInput" v-model="details.asin" label="ASIN" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="w-1/2 px-1">
            <ui-text-input-with-label ref="publisherInput" v-model="details.publisher" label="Publisher" />
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
      </div>
    </form>

    <div v-if="showSeriesForm" class="absolute top-0 left-0 z-20 w-full h-full bg-black bg-opacity-50 rounded-lg flex items-center justify-center" @click="cancelSeriesForm">
      <div class="absolute top-0 right-0 p-4">
        <span class="material-icons text-gray-200 hover:text-white text-4xl cursor-pointer">close</span>
      </div>
      <form @submit.prevent="submitSeriesForm">
        <div class="bg-bg rounded-lg p-8" @click.stop>
          <div class="flex">
            <div class="flex-grow p-1 min-w-80">
              <ui-input-dropdown ref="newSeriesSelect" v-model="selectedSeries.name" :items="existingSeriesNames" :disabled="!selectedSeries.id.startsWith('new')" label="Series Name" />
            </div>
            <div class="w-40 p-1">
              <ui-text-input-with-label v-model="selectedSeries.sequence" label="Sequence" />
            </div>
          </div>
          <div class="flex justify-end mt-2 p-1">
            <ui-btn type="submit">Save</ui-btn>
          </div>
        </div>
      </form>
    </div>
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
      selectedSeries: {},
      showSeriesForm: false,
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
        explicit: false
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
    },
    existingSeriesNames() {
      // Only show series names not already selected
      var alreadySelectedSeriesIds = this.details.series.map((se) => se.id)
      return this.series.filter((se) => !alreadySelectedSeriesIds.includes(se.id)).map((se) => se.name)
    },
    seriesItems: {
      get() {
        return this.details.series.map((se) => {
          return {
            displayName: se.sequence ? `${se.name} #${se.sequence}` : se.name,
            ...se
          }
        })
      },
      set(val) {
        this.details.series = val
      }
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
        author: (this.details.authors || []).map((au) => au.name).join(', ')
      }
    },
    mapBatchDetails(batchDetails) {
      for (const key in batchDetails) {
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
    cancelSeriesForm() {
      this.showSeriesForm = false
    },
    editSeriesItem(series) {
      var _series = this.details.series.find((se) => se.id === series.id)
      if (!_series) return
      this.selectedSeries = {
        ..._series
      }
      this.showSeriesForm = true
    },
    addNewSeries() {
      this.selectedSeries = {
        id: `new-${Date.now()}`,
        name: '',
        sequence: ''
      }
      this.showSeriesForm = true
    },
    submitSeriesForm() {
      if (!this.selectedSeries.name) {
        this.$toast.error('Must enter a series')
        return
      }
      if (this.$refs.newSeriesSelect) {
        this.$refs.newSeriesSelect.blur()
      }
      var existingSeriesIndex = this.details.series.findIndex((se) => se.id === this.selectedSeries.id)

      var seriesSameName = this.series.find((se) => se.name.toLowerCase() === this.selectedSeries.name.toLowerCase())
      if (existingSeriesIndex < 0 && seriesSameName) {
        this.selectedSeries.id = seriesSameName.id
      }

      if (existingSeriesIndex >= 0) {
        this.details.series.splice(existingSeriesIndex, 1, { ...this.selectedSeries })
      } else {
        this.details.series.push({
          ...this.selectedSeries
        })
      }

      this.showSeriesForm = false
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
      this.newTags = [...(this.media.tags || [])]
    },
    submitForm() {
      this.$emit('submit')
    }
  },
  mounted() {}
}
</script>