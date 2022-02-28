<template>
  <div ref="page" id="page-wrapper" class="page px-6 pt-6 pb-52 overflow-y-auto" :class="streamAudiobook ? 'streaming' : ''">
    <div class="border border-white border-opacity-10 max-w-7xl mx-auto mb-10 mt-5">
      <div class="flex items-center px-4 py-4 cursor-pointer" @click="openMapOptions = !openMapOptions" @mousedown.prevent @mouseup.prevent>
        <span class="material-icons">{{ openMapOptions ? 'expand_less' : 'expand_more' }}</span>

        <p class="ml-4 text-gray-200 text-lg">Map details</p>
      </div>
      <div class="overflow-hidden">
        <transition name="slide">
          <div v-if="openMapOptions" class="flex flex-wrap">
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.subtitle" />
              <ui-text-input-with-label ref="subtitleInput" v-model="batchDetails.subtitle" :disabled="!selectedBatchUsage.subtitle" label="Subtitle" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.author" />
              <ui-text-input-with-label ref="authorInput" v-model="batchDetails.author" :disabled="!selectedBatchUsage.author" label="Author" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.publishYear" />
              <ui-text-input-with-label ref="publishYearInput" v-model="batchDetails.publishYear" :disabled="!selectedBatchUsage.publishYear" label="Publish Year" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.series" />
              <ui-input-dropdown ref="seriesDropdown" v-model="batchDetails.series" :disabled="!selectedBatchUsage.series" label="Series" :items="seriesItems" @input="seriesChanged" @newItem="newSeriesItem" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.genres" />
              <ui-multi-select ref="genresSelect" v-model="batchDetails.genres" :disabled="!selectedBatchUsage.genres" label="Genres" :items="genreItems" @newItem="newGenreItem" @removedItem="removedGenreItem" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.tags" />
              <ui-multi-select ref="tagsSelect" v-model="batchDetails.tags" label="Tags" :disabled="!selectedBatchUsage.tags" :items="tagItems" @newItem="newTagItem" @removedItem="removedTagItem" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.narrator" />
              <ui-text-input-with-label ref="narratorInput" v-model="batchDetails.narrator" :disabled="!selectedBatchUsage.narrator" label="Narrator" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.publisher" />
              <ui-text-input-with-label ref="publisherInput" v-model="batchDetails.publisher" :disabled="!selectedBatchUsage.publisher" label="Publisher" class="mb-4 ml-4" />
            </div>
            <div class="flex items-center px-4 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.language" />
              <ui-text-input-with-label ref="languageInput" v-model="batchDetails.language" :disabled="!selectedBatchUsage.language" label="Language" class="mb-4 ml-4" />
            </div>

            <div class="w-full flex items-center justify-end p-4">
              <ui-btn color="success" :disabled="!hasSelectedBatchUsage" :padding-x="8" small class="text-base" :loading="isProcessing" @click="mapBatchDetails">Apply</ui-btn>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div class="flex justify-center flex-wrap">
      <template v-for="audiobook in audiobookCopies">
        <div :key="audiobook.id" class="w-full max-w-3xl border border-black-300 p-6 -ml-px -mt-px flex">
          <div class="w-32">
            <covers-book-cover :audiobook="audiobook.originalAudiobook" :width="120" :book-cover-aspect-ratio="bookCoverAspectRatio" />
          </div>
          <div class="flex-grow pl-4">
            <ui-text-input-with-label v-model="audiobook.book.title" label="Title" />

            <ui-text-input-with-label v-model="audiobook.book.subtitle" label="Subtitle" class="mt-2" />

            <div class="flex mt-2 -mx-1">
              <div class="w-3/4 px-1">
                <ui-text-input-with-label v-model="audiobook.book.author" label="Author" />
              </div>
              <div class="flex-grow px-1">
                <ui-text-input-with-label v-model="audiobook.book.publishYear" type="number" label="Publish Year" />
              </div>
            </div>

            <div class="flex mt-2 -mx-1">
              <div class="w-3/4 px-1">
                <ui-input-dropdown v-model="audiobook.book.series" label="Series" :items="seriesItems" @input="seriesChanged" @newItem="newSeriesItem" />
              </div>
              <div class="flex-grow px-1">
                <ui-text-input-with-label v-model="audiobook.book.volumeNumber" label="Volume #" />
              </div>
            </div>

            <ui-textarea-with-label v-model="audiobook.book.description" :rows="3" label="Description" class="mt-2" />

            <div class="flex mt-2 -mx-1">
              <div class="w-1/2 px-1">
                <ui-multi-select v-model="audiobook.book.genres" label="Genres" :items="genreItems" @newItem="newGenreItem" @removedItem="removedGenreItem" />
              </div>
              <div class="flex-grow px-1">
                <ui-multi-select v-model="audiobook.tags" label="Tags" :items="tagItems" @newItem="newTagItem" @removedItem="removedTagItem" />
              </div>
            </div>

            <!-- <div class="flex mt-2 -mx-1">
              <div class="w-1/2 px-1">
                <ui-text-input-with-label v-model="audiobook.book.narrator" label="Narrator" />
              </div>
            </div> -->
            <div class="flex mt-2 -mx-1">
              <div class="w-1/3 px-1">
                <ui-text-input-with-label v-model="audiobook.book.narrator" label="Narrator" />
              </div>
              <div class="w-1/3 px-1">
                <ui-text-input-with-label v-model="audiobook.book.publisher" label="Publisher" />
              </div>
              <div class="flex-grow px-1">
                <ui-text-input-with-label v-model="audiobook.book.language" label="Language" />
              </div>
            </div>

            <div class="flex mt-2 -mx-1">
              <div class="w-1/3 px-1">
                <ui-text-input-with-label v-model="audiobook.book.isbn" label="ISBN" />
              </div>
              <div class="w-1/3 px-1">
                <ui-text-input-with-label v-model="audiobook.book.asin" label="ASIN" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    <div v-show="isProcessing" class="fixed top-0 left-0 z-50 w-full h-full flex items-center justify-center bg-black bg-opacity-60">
      <ui-loading-indicator />
    </div>

    <div :class="isScrollable ? 'fixed left-0 box-shadow-lg-up bg-primary' : ''" class="w-full h-20 px-4 flex items-center border-t border-bg z-40" :style="{ bottom: streamAudiobook ? '165px' : '0px' }">
      <div class="flex-grow" />
      <ui-btn color="success" :padding-x="8" class="text-lg" :loading="isProcessing" @click.prevent="saveClick">Save</ui-btn>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, redirect, app }) {
    if (!store.state.selectedAudiobooks.length) {
      return redirect('/')
    }
    var audiobooks = await app.$axios.$post(`/api/books/batch/get`, { books: store.state.selectedAudiobooks }).catch((error) => {
      var errorMsg = error.response.data || 'Failed to get audiobooks'
      console.error(errorMsg, error)
      return []
    })
    return {
      audiobooks
    }
  },
  data() {
    return {
      isProcessing: false,
      audiobookCopies: [],
      isScrollable: false,
      newSeriesItems: [],
      newTagItems: [],
      newGenreItems: [],
      batchDetails: {
        subtitle: null,
        author: null,
        publishYear: null,
        series: null,
        genres: [],
        tags: [],
        narrator: null,
        publisher: null,
        language: null
      },
      selectedBatchUsage: {
        subtitle: false,
        author: false,
        publishYear: false,
        series: false,
        genres: false,
        tags: false,
        narrator: false,
        publisher: false,
        language: false
      },
      openMapOptions: false
    }
  },
  computed: {
    coverAspectRatio() {
      return this.$store.getters['settings/getServerSetting']('coverAspectRatio')
    },
    bookCoverAspectRatio() {
      return this.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE ? 1 : 1.6
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    genreItems() {
      return this.genres.concat(this.newGenreItems)
    },
    tagItems() {
      return this.tags.concat(this.newTagItems)
    },
    seriesItems() {
      return [...this.series, ...this.newSeriesItems]
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
    filterData() {
      return this.$store.state.libraries.filterData || {}
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    hasSelectedBatchUsage() {
      return Object.values(this.selectedBatchUsage).some((b) => !!b)
    }
  },
  methods: {
    blurBatchForm() {
      if (this.$refs.seriesDropdown && this.$refs.seriesDropdown.isFocused) {
        this.$refs.seriesDropdown.blur()
      }
      if (this.$refs.genresSelect && this.$refs.genresSelect.isFocused) {
        this.$refs.genresSelect.forceBlur()
      }
      if (this.$refs.tagsSelect && this.$refs.tagsSelect.isFocused) {
        this.$refs.tagsSelect.forceBlur()
      }

      for (const key in this.batchDetails) {
        if (this.$refs[`${key}Input`] && this.$refs[`${key}Input`].blur) {
          this.$refs[`${key}Input`].blur()
        }
      }
    },
    mapBatchDetails() {
      this.blurBatchForm()

      this.audiobookCopies = this.audiobookCopies.map((ab) => {
        for (const key in this.selectedBatchUsage) {
          if (this.selectedBatchUsage[key]) {
            if (key === 'tags') {
              ab.tags = this.batchDetails.tags
            } else {
              ab.book[key] = this.batchDetails[key]
            }
          }
        }
        return ab
      })
      this.$toast.success('Details mapped')
    },
    newTagItem(item) {
      if (item && !this.newTagItems.includes(item)) {
        this.newTagItems.push(item)
      }
    },
    removedTagItem(item) {
      // If newly added, remove if not used on any other audiobooks
      if (item && this.newTagItems.includes(item)) {
        var usedByOtherAb = this.audiobookCopies.find((ab) => {
          return ab.tags && ab.tags.includes(item)
        })
        if (!usedByOtherAb) {
          this.newTagItems = this.newTagItems.filter((t) => t !== item)
        }
      }
    },
    newGenreItem(item) {
      if (item && !this.newGenreItems.includes(item)) {
        this.newGenreItems.push(item)
      }
    },
    removedGenreItem(item) {
      // If newly added, remove if not used on any other audiobooks
      if (item && this.newGenreItems.includes(item)) {
        var usedByOtherAb = this.audiobookCopies.find((ab) => {
          return ab.book.genres && ab.book.genres.includes(item)
        })
        if (!usedByOtherAb) {
          this.newGenreItems = this.newGenreItems.filter((t) => t !== item)
        }
      }
    },
    newSeriesItem(item) {
      if (item && !this.newSeriesItems.includes(item)) {
        this.newSeriesItems.push(item)
      }
    },
    seriesChanged() {
      this.newSeriesItems = this.newSeriesItems.filter((item) => {
        return this.audiobookCopies.find((ab) => ab.book.series === item)
      })
    },
    init() {
      this.audiobookCopies = this.audiobooks.map((ab) => {
        var copy = { ...ab }
        copy.tags = [...ab.tags]
        copy.book = { ...ab.book }
        copy.book.genres = [...ab.book.genres]
        copy.originalAudiobook = ab
        return copy
      })
      this.$nextTick(() => {
        if (this.$refs.page.scrollHeight > this.$refs.page.clientHeight) {
          this.isScrollable = true
        }
      })
    },
    compareStringArrays(arr1, arr2) {
      if (!arr1 || !arr2) return false
      return arr1.join(',') !== arr2.join(',')
    },
    compareAudiobooks(newAb, origAb) {
      const bookKeysToCheck = ['title', 'subtitle', 'narrator', 'author', 'publishYear', 'series', 'volumeNumber', 'description', 'language', 'publisher', 'isbn', 'asin']
      var newBook = newAb.book
      var origBook = origAb.book
      var diffObj = {}
      for (const key in newBook) {
        if (bookKeysToCheck.includes(key)) {
          if (newBook[key] !== origBook[key]) {
            if (!diffObj.book) diffObj.book = {}
            diffObj.book[key] = newBook[key]
          }
        }
        if (key === 'genres') {
          if (this.compareStringArrays(newBook[key], origBook[key])) {
            if (!diffObj.book) diffObj.book = {}
            diffObj.book[key] = newBook[key]
          }
        }
      }
      if (newAb.tags && origAb.tags && newAb.tags.join(',') !== origAb.tags.join(',')) {
        diffObj.tags = newAb.tags
      }
      return diffObj
    },
    saveClick() {
      var updates = []
      for (let i = 0; i < this.audiobookCopies.length; i++) {
        var ab = { ...this.audiobookCopies[i] }
        var origAb = ab.originalAudiobook
        delete ab.originalAudiobook

        var res = this.compareAudiobooks(ab, origAb)
        if (res && Object.keys(res).length) {
          updates.push({
            id: ab.id,
            updates: res
          })
        }
      }
      if (!updates.length) {
        return this.$toast.warning('No updates were made')
      }

      console.log('Pushing updates', updates)
      this.isProcessing = true
      this.$axios
        .$post('/api/books/batch/update', updates)
        .then((data) => {
          this.isProcessing = false
          if (data.updates) {
            this.$toast.success(`Successfully updated ${data.updates} audiobooks`)
            this.$router.replace(`/library/${this.currentLibraryId}/bookshelf`)
          } else {
            this.$toast.warning('No updates were necessary')
          }
        })
        .catch((error) => {
          console.error('failed to batch update', error)
          this.$toast.error('Failed to batch update')
          this.isProcessing = false
        })
    },
    applyBatchUpdates() {
      this.audiobookCopies = this.audiobookCopies.map((ab) => {
        if (this.batchDetails.series) ab.book.series = this.batchDetails.series
      })
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease;
}

.slide-enter,
.slide-leave-to {
  transform: translateY(-100%);
  transition: all 150ms ease-in 0s;
}
</style>