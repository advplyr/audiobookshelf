<template>
  <div ref="page" id="page-wrapper" class="page px-6 pt-6 pb-52 overflow-y-auto" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="border border-white border-opacity-10 max-w-7xl mx-auto mb-10 mt-5">
      <div class="flex items-center px-4 py-4 cursor-pointer" @click="openMapOptions = !openMapOptions" @mousedown.prevent @mouseup.prevent>
        <span class="material-symbols text-2xl">{{ openMapOptions ? 'expand_less' : 'expand_more' }}</span>

        <p class="ml-4 text-gray-200 text-lg">{{ $strings.HeaderMapDetails }}</p>

        <div class="flex-grow" />

        <div class="w-64 flex">
          <button class="w-32 h-8 rounded-l-md shadow-md border border-gray-600" :class="!isMapOverwrite ? 'bg-bg text-white/30' : 'bg-primary'" @click.stop.prevent="mapDetailsType = 'overwrite'">
            <p class="text-sm">{{ $strings.LabelOverwrite }}</p>
          </button>
          <button class="w-32 h-8 rounded-r-md shadow-md border border-gray-600" :class="!isMapAppend ? 'bg-bg text-white/30' : 'bg-primary'" @click.stop.prevent="mapDetailsType = 'append'">
            <p class="text-sm">{{ $strings.LabelAppend }}</p>
          </button>
        </div>
      </div>
      <div class="overflow-hidden">
        <transition name="slide">
          <div v-if="openMapOptions" class="flex flex-wrap">
            <div v-if="!isPodcastLibrary && !isMapAppend" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.subtitle" />
              <ui-text-input-with-label ref="subtitleInput" v-model="batchDetails.subtitle" :disabled="!selectedBatchUsage.subtitle" :label="$strings.LabelSubtitle" class="mb-5 ml-4" />
            </div>
            <div v-if="!isPodcastLibrary" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.authors" />
              <!-- Authors filter only contains authors in this library, uses filter data -->
              <ui-multi-select-query-input ref="authorsSelect" v-model="batchDetails.authors" :disabled="!selectedBatchUsage.authors" :label="$strings.LabelAuthors" filter-key="authors" class="mb-5 ml-4" />
            </div>
            <div v-if="!isPodcastLibrary && !isMapAppend" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.publishedYear" />
              <ui-text-input-with-label ref="publishedYearInput" v-model="batchDetails.publishedYear" :disabled="!selectedBatchUsage.publishedYear" :label="$strings.LabelPublishYear" class="mb-5 ml-4" />
            </div>
            <div v-if="!isPodcastLibrary" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.series" />
              <ui-multi-select ref="seriesSelect" v-model="batchDetails.series" :disabled="!selectedBatchUsage.series" :label="$strings.LabelSeries" :items="existingSeriesNames" @newItem="newSeriesItem" @removedItem="removedSeriesItem" class="mb-5 ml-4" />
            </div>
            <div class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.genres" />
              <ui-multi-select ref="genresSelect" v-model="batchDetails.genres" :disabled="!selectedBatchUsage.genres" :label="$strings.LabelGenres" :items="genreItems" @newItem="newGenreItem" @removedItem="removedGenreItem" class="mb-5 ml-4" />
            </div>
            <div class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.tags" />
              <ui-multi-select ref="tagsSelect" v-model="batchDetails.tags" :label="$strings.LabelTags" :disabled="!selectedBatchUsage.tags" :items="tagItems" @newItem="newTagItem" @removedItem="removedTagItem" class="mb-5 ml-4" />
            </div>
            <div v-if="!isPodcastLibrary" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.narrators" />
              <ui-multi-select ref="narratorsSelect" v-model="batchDetails.narrators" :disabled="!selectedBatchUsage.narrators" :label="$strings.LabelNarrators" :items="narratorItems" @newItem="newNarratorItem" @removedItem="removedNarratorItem" class="mb-5 ml-4" />
            </div>
            <div v-if="!isPodcastLibrary && !isMapAppend" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.publisher" />
              <ui-text-input-with-label ref="publisherInput" v-model="batchDetails.publisher" :disabled="!selectedBatchUsage.publisher" :label="$strings.LabelPublisher" class="mb-5 ml-4" />
            </div>
            <div v-if="!isMapAppend" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.language" />
              <ui-text-input-with-label ref="languageInput" v-model="batchDetails.language" :disabled="!selectedBatchUsage.language" :label="$strings.LabelLanguage" class="mb-5 ml-4" />
            </div>
            <div v-if="!isMapAppend" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.explicit" />
              <div class="ml-4">
                <ui-checkbox
                  v-model="batchDetails.explicit"
                  :label="$strings.LabelExplicit"
                  :disabled="!selectedBatchUsage.explicit"
                  :checkbox-bg="!selectedBatchUsage.explicit ? 'bg' : 'primary'"
                  :check-color="!selectedBatchUsage.explicit ? 'gray-600' : 'green-500'"
                  border-color="gray-600"
                  :label-class="!selectedBatchUsage.explicit ? 'pl-2 text-base text-gray-400 font-semibold' : 'pl-2 text-base font-semibold'"
                />
              </div>
            </div>
            <div v-if="!isPodcastLibrary && !isMapAppend" class="flex items-center px-4 h-18 w-1/2">
              <ui-checkbox v-model="selectedBatchUsage.abridged" />
              <div class="ml-4">
                <ui-checkbox
                  v-model="batchDetails.abridged"
                  :label="$strings.LabelAbridged"
                  :disabled="!selectedBatchUsage.abridged"
                  :checkbox-bg="!selectedBatchUsage.abridged ? 'bg' : 'primary'"
                  :check-color="!selectedBatchUsage.abridged ? 'gray-600' : 'green-500'"
                  border-color="gray-600"
                  :label-class="!selectedBatchUsage.abridged ? 'pl-2 text-base text-gray-400 font-semibold' : 'pl-2 text-base font-semibold'"
                />
              </div>
            </div>

            <div class="w-full flex items-center justify-end p-4">
              <ui-btn color="success" :disabled="!hasSelectedBatchUsage" :padding-x="8" small class="text-base" :loading="isProcessing" @click="mapBatchDetails">{{ $strings.ButtonApply }}</ui-btn>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div class="flex justify-center flex-wrap">
      <template v-for="libraryItem in libraryItemCopies">
        <div :key="libraryItem.id" class="w-full max-w-3xl border border-black-300 p-6 -ml-px -mt-px">
          <widgets-book-details-edit v-if="libraryItem.mediaType === 'book'" :ref="`itemForm-${libraryItem.id}`" :library-item="libraryItem" @change="handleItemChange" />
          <widgets-podcast-details-edit v-else :ref="`itemForm-${libraryItem.id}`" :library-item="libraryItem" @change="handleItemChange" />
        </div>
      </template>
    </div>
    <div v-show="isProcessing" class="fixed top-0 left-0 z-50 w-full h-full flex items-center justify-center bg-black bg-opacity-60">
      <ui-loading-indicator />
    </div>

    <div :class="isScrollable ? 'fixed left-0 box-shadow-lg-up bg-primary' : ''" class="w-full h-20 px-4 flex items-center border-t border-bg z-40" :style="{ bottom: streamLibraryItem ? '165px' : '0px' }">
      <div class="flex-grow" />
      <ui-btn color="success" :padding-x="8" class="text-lg" :loading="isProcessing" :disabled="!hasChanges" @click.prevent="saveClick">{{ $strings.ButtonSave }}</ui-btn>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, redirect, app }) {
    if (!store.state.globals.selectedMediaItems.length) {
      return redirect('/')
    }

    const libraryItemIds = store.state.globals.selectedMediaItems.map((i) => i.id)
    const libraryItems = await app.$axios
      .$post(`/api/items/batch/get`, { libraryItemIds })
      .then((res) => res.libraryItems)
      .catch((error) => {
        const errorMsg = error.response.data || 'Failed to get items'
        console.error(errorMsg, error)
        return []
      })
    return {
      mediaType: libraryItems[0].mediaType,
      libraryItems
    }
  },
  data() {
    return {
      isProcessing: false,
      libraryItemCopies: [],
      isScrollable: false,
      newTagItems: [],
      newGenreItems: [],
      newNarratorItems: [],
      mapDetailsType: 'overwrite',
      batchDetails: {
        subtitle: null,
        authors: null,
        publishedYear: null,
        series: [],
        genres: [],
        tags: [],
        narrators: [],
        publisher: null,
        language: null,
        explicit: false,
        abridged: false
      },
      selectedBatchUsage: {
        subtitle: false,
        authors: false,
        publishedYear: false,
        series: false,
        genres: false,
        tags: false,
        narrators: false,
        publisher: false,
        language: false,
        explicit: false,
        abridged: false
      },
      appendableKeys: ['authors', 'genres', 'tags', 'narrators', 'series'],
      openMapOptions: false,
      itemsWithChanges: []
    }
  },
  computed: {
    isMapOverwrite() {
      return this.mapDetailsType === 'overwrite'
    },
    isMapAppend() {
      return this.mapDetailsType === 'append'
    },
    isPodcastLibrary() {
      return this.mediaType === 'podcast'
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    genreItems() {
      return this.genres.concat(this.newGenreItems)
    },
    tagItems() {
      return this.tags.concat(this.newTagItems)
    },
    narratorItems() {
      return [...this.narrators, ...this.newNarratorItems]
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
    authors() {
      return this.filterData.authors || []
    },
    existingSeriesNames() {
      return this.series.map((se) => se.name)
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    hasSelectedBatchUsage() {
      return Object.values(this.selectedBatchUsage).some((b) => !!b)
    },
    hasChanges() {
      return this.itemsWithChanges.length > 0
    }
  },
  methods: {
    handleItemChange(itemChange) {
      if (!itemChange.hasChanges) {
        this.itemsWithChanges = this.itemsWithChanges.filter((id) => id !== itemChange.libraryItemId)
      } else if (!this.itemsWithChanges.includes(itemChange.libraryItemId)) {
        this.itemsWithChanges.push(itemChange.libraryItemId)
      }
    },
    blurBatchForm() {
      if (this.$refs.seriesSelect && this.$refs.seriesSelect.isFocused) {
        this.$refs.seriesSelect.forceBlur()
      }
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

      for (const key in this.batchDetails) {
        if (this.$refs[`${key}Input`] && this.$refs[`${key}Input`].blur) {
          this.$refs[`${key}Input`].blur()
        }
      }
    },
    mapBatchDetails() {
      this.blurBatchForm()

      const batchMapPayload = {}
      for (const key in this.selectedBatchUsage) {
        if (!this.selectedBatchUsage[key]) continue
        if (this.isMapAppend && !this.appendableKeys.includes(key)) continue

        if (key === 'series') {
          // Map string of series to series objects
          batchMapPayload[key] = this.batchDetails[key].map((seItem) => {
            const existingSeries = this.series.find((se) => se.name.toLowerCase() === seItem.toLowerCase().trim())
            if (existingSeries) {
              return existingSeries
            } else {
              return {
                id: `new-${Math.floor(Math.random() * 10000)}`,
                name: seItem
              }
            }
          })
        } else {
          batchMapPayload[key] = this.batchDetails[key]
        }
      }

      this.libraryItemCopies.forEach((li) => {
        const ref = this.getEditFormRef(li.id)
        ref.mapBatchDetails(batchMapPayload, this.mapDetailsType)
      })
      this.$toast.success('Details mapped')
    },
    newSeriesItem(item) {},
    removedSeriesItem(item) {},
    newNarratorItem(item) {},
    removedNarratorItem(item) {},
    newTagItem(item) {},
    removedTagItem(item) {},
    newGenreItem(item) {},
    removedGenreItem(item) {},
    init() {
      // TODO: Better deep cloning of library items
      this.libraryItemCopies = this.libraryItems.map((li) => {
        var copy = {
          ...li
        }
        copy.media = { ...li.media }
        if (copy.media.tags) copy.media.tags = [...copy.media.tags]
        copy.media.metadata = { ...copy.media.metadata }
        if (copy.media.metadata.authors) {
          copy.media.metadata.authors = copy.media.metadata.authors.map((au) => ({ ...au }))
        }
        if (copy.media.metadata.series) {
          copy.media.metadata.series = copy.media.metadata.series.map((se) => ({ ...se }))
        }
        if (copy.media.metadata.narrators) {
          copy.media.metadata.narrators = [...copy.media.metadata.narrators]
        }
        if (copy.media.metadata.genres) {
          copy.media.metadata.genres = [...copy.media.metadata.genres]
        }
        copy.originalLibraryItem = li
        return copy
      })
      this.$nextTick(() => {
        if (this.$refs.page.scrollHeight > this.$refs.page.clientHeight) {
          this.isScrollable = true
        }
      })
    },
    getEditFormRef(itemId) {
      var refs = this.$refs[`itemForm-${itemId}`]
      if (refs && refs.length) return refs[0]
      return null
    },
    saveClick() {
      var updates = []
      for (let i = 0; i < this.libraryItemCopies.length; i++) {
        var editForm = this.getEditFormRef(this.libraryItemCopies[i].id)
        if (!editForm) {
          throw new Error('Invalid edit form ref not found')
        }
        var details = editForm.getDetails()
        if (details.hasChanges) {
          updates.push({
            id: this.libraryItemCopies[i].id,
            mediaPayload: details.updatePayload
          })
        }
      }
      if (!updates.length) {
        return this.$toast.warning(this.$strings.ToastNoUpdatesNecessary)
      }

      console.log('Pushing updates', updates)
      this.isProcessing = true
      this.$axios
        .$post('/api/items/batch/update', updates)
        .then((data) => {
          this.isProcessing = false
          if (data.updates) {
            this.itemsWithChanges = []
            this.$toast.success(`Successfully updated ${data.updates} items`)
            this.$router.replace(`/library/${this.currentLibraryId}/bookshelf`)
          } else {
            this.$toast.warning(this.$strings.MessageNoUpdatesWereNecessary)
          }
        })
        .catch((error) => {
          console.error('failed to batch update', error)
          this.$toast.error('Failed to batch update')
          this.isProcessing = false
        })
    },
    beforeUnload(e) {
      if (!e || !this.hasChanges) return
      e.preventDefault()
      e.returnValue = ''
    }
  },
  beforeRouteLeave(to, from, next) {
    if (this.hasChanges) {
      next(false)
      window.location = to.path
    } else {
      next()
    }
  },
  mounted() {
    this.init()

    window.addEventListener('beforeunload', this.beforeUnload)
  },
  beforeDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnload)
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
