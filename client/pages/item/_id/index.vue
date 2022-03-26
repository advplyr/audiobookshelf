<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full h-full overflow-y-auto px-2 py-6 md:p-8">
      <div class="flex flex-col md:flex-row max-w-6xl mx-auto">
        <div class="w-full flex justify-center md:block md:w-52" style="min-width: 208px">
          <div class="relative" style="height: fit-content">
            <covers-book-cover :library-item="libraryItem" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />

            <!-- Item Progress Bar -->
            <div class="absolute bottom-0 left-0 h-1.5 bg-yellow-400 shadow-sm z-10" :class="userIsFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: 208 * progressPercent + 'px' }"></div>

            <!-- Item Cover Overlay -->
            <div class="absolute top-0 left-0 w-full h-full z-10 bg-black bg-opacity-30 opacity-0 hover:opacity-100 transition-opacity" @mousedown.prevent @mouseup.prevent>
              <div v-show="showPlayButton && !streaming" class="h-full flex items-center justify-center pointer-events-none">
                <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto cursor-pointer" @click.stop.prevent="startStream">
                  <span class="material-icons text-4xl">play_circle_filled</span>
                </div>
              </div>

              <span class="absolute bottom-2.5 right-2.5 z-10 material-icons text-lg cursor-pointer text-white text-opacity-75 hover:text-opacity-100 hover:scale-110 transform duration-200" @click="showEditCover">edit</span>
            </div>
          </div>
        </div>
        <div class="flex-grow px-2 py-6 md:py-0 md:px-10">
          <div class="flex justify-center">
            <div class="mb-4">
              <div class="flex sm:items-end flex-col sm:flex-row">
                <h1 class="text-2xl md:text-3xl font-sans">
                  {{ title }}
                </h1>
                <p v-if="bookSubtitle" class="sm:ml-4 text-gray-400 text-xl md:text-2xl">{{ bookSubtitle }}</p>
              </div>

              <p v-if="isPodcast" class="mb-2 mt-0.5 text-gray-200 text-lg md:text-xl">by {{ podcastAuthor }}</p>
              <p v-else-if="authorsList.length" class="mb-2 mt-0.5 text-gray-200 text-lg md:text-xl">
                by <nuxt-link v-for="(author, index) in authorsList" :key="index" :to="`/library/${libraryId}/bookshelf?filter=authors.${$encode(author)}`" class="hover:underline">{{ author }}<span v-if="index < authorsList.length - 1">,&nbsp;</span></nuxt-link>
              </p>
              <p v-else class="mb-2 mt-0.5 text-gray-200 text-xl">by Unknown</p>

              <nuxt-link v-for="_series in seriesList" :key="_series.id" :to="`/library/${libraryId}/series/${_series.id}}`" class="hover:underline font-sans text-gray-300 text-lg leading-7"> {{ _series.text }}</nuxt-link>

              <div v-if="narrator" class="flex py-0.5 mt-4">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Narrated By</span>
                </div>
                <div>
                  <template v-for="(narrator, index) in narrators">
                    <nuxt-link :key="narrator" :to="`/library/${libraryId}/bookshelf?filter=narrators.${$encode(narrator)}`" class="hover:underline">{{ narrator }}</nuxt-link
                    ><span :key="index" v-if="index < narrators.length - 1">,&nbsp;</span>
                  </template>
                </div>
              </div>
              <div v-if="publishedYear" class="flex py-0.5">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Publish Year</span>
                </div>
                <div>
                  {{ publishedYear }}
                </div>
              </div>
              <div class="flex py-0.5" v-if="genres.length">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Genres</span>
                </div>
                <div>
                  <template v-for="(genre, index) in genres">
                    <nuxt-link :key="genre" :to="`/library/${libraryId}/bookshelf?filter=genres.${$encode(genre)}`" class="hover:underline">{{ genre }}</nuxt-link
                    ><span :key="index" v-if="index < genres.length - 1">,&nbsp;</span>
                  </template>
                </div>
              </div>
              <div v-if="tracks.length" class="flex py-0.5">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Duration</span>
                </div>
                <div>
                  {{ durationPretty }}
                </div>
              </div>
              <div class="flex py-0.5">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Size</span>
                </div>
                <div>
                  {{ sizePretty }}
                </div>
              </div>
            </div>
            <div class="hidden md:block flex-grow" />
          </div>

          <!-- Alerts -->
          <div v-show="showExperimentalReadAlert" class="bg-error p-4 rounded-xl flex items-center">
            <span class="material-icons text-2xl">warning_amber</span>
            <p class="ml-4">Book has no audio tracks but has valid ebook files. The e-reader is experimental and can be turned on in config.</p>
          </div>

          <!-- Progress -->
          <div v-if="progressPercent > 0" class="px-4 py-2 mt-4 bg-primary text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0" :class="resettingProgress ? 'opacity-25' : ''">
            <p v-if="progressPercent < 1" class="leading-6">Your Progress: {{ Math.round(progressPercent * 100) }}%</p>
            <p v-else class="text-xs">Finished {{ $formatDate(userProgressFinishedAt, 'MM/dd/yyyy') }}</p>
            <p v-if="progressPercent < 1" class="text-gray-200 text-xs">{{ $elapsedPretty(userTimeRemaining) }} remaining</p>
            <p class="text-gray-400 text-xs pt-1">Started {{ $formatDate(userProgressStartedAt, 'MM/dd/yyyy') }}</p>

            <div v-if="!resettingProgress" class="absolute -top-1.5 -right-1.5 p-1 w-5 h-5 rounded-full bg-bg hover:bg-error border border-primary flex items-center justify-center cursor-pointer" @click.stop="clearProgressClick">
              <span class="material-icons text-sm">close</span>
            </div>
          </div>

          <div class="flex items-center justify-center md:justify-start pt-4">
            <ui-btn v-if="showPlayButton" :disabled="streaming" color="success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="startStream">
              <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">play_arrow</span>
              {{ streaming ? 'Streaming' : 'Play' }}
            </ui-btn>
            <ui-btn v-else-if="isMissing || isInvalid" color="error" :padding-x="4" small class="flex items-center h-9 mr-2">
              <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">error</span>
              {{ isMissing ? 'Missing' : 'Incomplete' }}
            </ui-btn>

            <ui-btn v-if="showExperimentalFeatures && ebooks.length" color="info" :padding-x="4" small class="flex items-center h-9 mr-2" @click="openEbook">
              <span class="material-icons -ml-2 pr-2 text-white">auto_stories</span>
              Read
            </ui-btn>

            <ui-tooltip v-if="userCanUpdate" text="Edit" direction="top">
              <ui-icon-btn icon="edit" class="mx-0.5" @click="editClick" />
            </ui-tooltip>

            <ui-tooltip v-if="userCanDownload" :disabled="isMissing" text="Download" direction="top">
              <ui-icon-btn icon="download" :disabled="isMissing" class="mx-0.5" @click="downloadClick" />
            </ui-tooltip>

            <ui-tooltip :text="userIsFinished ? 'Mark as Not Finished' : 'Mark as Finished'" direction="top">
              <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" class="mx-0.5" @click="toggleFinished" />
            </ui-tooltip>

            <ui-tooltip text="Collections" direction="top">
              <ui-icon-btn icon="collections_bookmark" class="mx-0.5" outlined @click="collectionsClick" />
            </ui-tooltip>
          </div>

          <div class="my-4 max-w-2xl">
            <p class="text-base text-gray-100 whitespace-pre-line">{{ description }}</p>
          </div>

          <widgets-audiobook-data v-if="tracks.length" :library-item-id="libraryItemId" :media="media" />

          <tables-library-files-table v-if="libraryFiles.length" :is-missing="isMissing" :library-item-id="libraryItemId" :files="libraryFiles" class="mt-6" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
    var item = await app.$axios.$get(`/api/items/${params.id}?expanded=1&include=authors`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!item) {
      console.error('No item...', params.id)
      return redirect('/')
    }
    return {
      libraryItem: item
    }
  },
  data() {
    return {
      resettingProgress: false,
      isProcessingReadUpdate: false
    }
  },
  computed: {
    coverAspectRatio() {
      return this.$store.getters['getServerSetting']('coverAspectRatio')
    },
    bookCoverAspectRatio() {
      return this.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE ? 1 : 1.6
    },
    bookCoverWidth() {
      return 208
    },
    isDeveloperMode() {
      return this.$store.state.developerMode
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    isPodcast() {
      return this.libraryItem.mediaType === 'podcast'
    },
    isMissing() {
      return this.libraryItem.isMissing
    },
    isInvalid() {
      return this.libraryItem.isInvalid
    },
    showPlayButton() {
      if (this.isMissing || this.isInvalid) return false
      if (this.isPodcast) return this.podcastEpisodes.length
      return this.tracks.length
    },
    libraryId() {
      return this.libraryItem.libraryId
    },
    folderId() {
      return this.libraryItem.folderId
    },
    libraryItemId() {
      return this.libraryItem.id
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    tracks() {
      return this.media.tracks || []
    },
    podcastEpisodes() {
      return this.media.episodes || []
    },
    title() {
      return this.mediaMetadata.title || 'No Title'
    },
    publishedYear() {
      return this.mediaMetadata.publishedYear
    },
    narrator() {
      return this.mediaMetadata.narratorName
    },
    bookSubtitle() {
      if (this.isPodcast) return null
      return this.mediaMetadata.subtitle
    },
    genres() {
      return this.mediaMetadata.genres || []
    },
    podcastAuthor() {
      return this.mediaMetadata.author || ''
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    authorsList() {
      return this.authors.map((au) => au.name)
    },
    narrators() {
      return this.mediaMetadata.narrators || []
    },
    series() {
      return this.media.series || []
    },
    seriesList() {
      return this.series.map((se) => {
        var text = se.name
        if (se.sequence) text += ` #${se.sequence}`
        return {
          ...se,
          text
        }
      })
    },
    durationPretty() {
      if (!this.tracks.length) return 'N/A'
      return this.$elapsedPretty(this.media.duration)
    },
    duration() {
      if (!this.tracks.length) return 0
      return this.media.duration
    },
    sizePretty() {
      return this.$bytesPretty(this.media.size)
    },
    libraryFiles() {
      return this.libraryItem.libraryFiles || []
    },
    ebooks() {
      return this.media.ebooks || []
    },
    showExperimentalReadAlert() {
      return !this.tracks.length && this.ebooks.length && !this.showExperimentalFeatures
    },
    description() {
      return this.mediaMetadata.description || ''
    },
    userMediaProgress() {
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    userIsFinished() {
      return this.userMediaProgress ? !!this.userMediaProgress.isFinished : false
    },
    userTimeRemaining() {
      if (!this.userMediaProgress) return 0
      var duration = this.userMediaProgress.duration || this.duration
      return duration - this.userMediaProgress.currentTime
    },
    progressPercent() {
      return this.userMediaProgress ? Math.max(Math.min(1, this.userMediaProgress.progress), 0) : 0
    },
    userProgressStartedAt() {
      return this.userMediaProgress ? this.userMediaProgress.startedAt : 0
    },
    userProgressFinishedAt() {
      return this.userMediaProgress ? this.userMediaProgress.finishedAt : 0
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    streaming() {
      return this.streamLibraryItem && this.streamLibraryItem.id === this.libraryItemId
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    }
  },
  methods: {
    showEditCover() {
      this.$store.commit('setBookshelfBookIds', [])
      this.$store.commit('showEditModalOnTab', { libraryItem: this.libraryItem, tab: 'cover' })
    },
    openEbook() {
      this.$store.commit('showEReader', this.libraryItem)
    },
    toggleFinished() {
      var updatePayload = {
        isFinished: !this.userIsFinished
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/me/progress/${this.libraryItemId}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
          this.$toast.success(`Item marked as ${updatePayload.isFinished ? 'Finished' : 'Not Finished'}`)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(`Failed to mark as ${updatePayload.isFinished ? 'Finished' : 'Not Finished'}`)
        })
    },
    startStream() {
      this.$eventBus.$emit('play-item', this.libraryItem.id)
    },
    editClick() {
      this.$store.commit('setBookshelfBookIds', [])
      this.$store.commit('showEditModal', this.libraryItem)
    },
    libraryItemUpdated(libraryItem) {
      if (libraryItem.id === this.libraryItemId) {
        console.log('Item was updated', libraryItem)
        this.libraryItem = libraryItem
      }
    },
    clearProgressClick() {
      if (confirm(`Are you sure you want to reset your progress?`)) {
        this.resettingProgress = true
        this.$axios
          .$delete(`/api/me/progress/${this.libraryItemId}`)
          .then(() => {
            console.log('Progress reset complete')
            this.$toast.success(`Your progress was reset`)
            this.resettingProgress = false
          })
          .catch((error) => {
            console.error('Progress reset failed', error)
            this.resettingProgress = false
          })
      }
    },
    downloadClick() {
      this.$store.commit('showEditModalOnTab', { libraryItem: this.libraryItem, tab: 'download' })
    },
    collectionsClick() {
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setShowUserCollectionsModal', true)
    }
  },
  mounted() {
    // use this items library id as the current
    if (this.libraryId) {
      this.$store.commit('libraries/setCurrentLibrary', this.libraryId)
    }
    this.$root.socket.on('item_updated', this.libraryItemUpdated)
  },
  beforeDestroy() {
    this.$root.socket.off('item_updated', this.libraryItemUpdated)
  }
}
</script>
