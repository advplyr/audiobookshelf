<template>
  <div ref="page" id="page-wrapper" class="page px-6 pt-6 pb-52 overflow-y-auto" :class="streamAudiobook ? 'streaming' : ''">
    <div class="flex justify-center flex-wrap">
      <template v-for="audiobook in audiobookCopies">
        <div :key="audiobook.id" class="w-full max-w-3xl border border-black-300 p-6 -ml-px -mt-px flex">
          <div class="w-32">
            <covers-book-cover :audiobook="audiobook.originalAudiobook" :width="120" />
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

            <div class="flex mt-2 -mx-1">
              <div class="w-1/2 px-1">
                <ui-text-input-with-label v-model="audiobook.book.narrator" label="Narrator" />
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
      <ui-btn color="success" :padding-x="8" class="text-lg" :loading="isProcessing" @click="saveClick">Save</ui-btn>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.state.selectedAudiobooks.length) {
      return redirect('/')
    }
    var audiobooks = store.state.audiobooks.audiobooks.filter((ab) => store.state.selectedAudiobooks.includes(ab.id))
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
      newGenreItems: []
    }
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    genres() {
      return this.$store.state.audiobooks.genres
    },
    genreItems() {
      return this.genres.concat(this.newGenreItems)
    },
    tags() {
      return this.$store.state.audiobooks.tags
    },
    tagItems() {
      return this.tags.concat(this.newTagItems)
    },
    series() {
      return this.$store.state.audiobooks.series
    },
    seriesItems() {
      return [...this.series, ...this.newSeriesItems]
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
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
    saveClick() {
      this.isProcessing = true

      this.$axios
        .$post('/api/audiobooks/update', this.audiobookCopies)
        .then((data) => {
          this.isProcessing = false
          if (data.updates) {
            this.$toast.success(`Successfully updated ${data.updates} audiobooks`)
            this.$router.replace(`/library/${this.currentLibraryId}`)
          } else {
            this.$toast.warning('No updates were necessary')
          }
        })
        .catch((error) => {
          console.error('failed to batch update', error)
          this.$toast.error('Failed to batch update')
          this.isProcessing = false
        })
    }
  },
  mounted() {
    this.init()
  }
}
</script>

