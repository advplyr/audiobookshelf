<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full h-full overflow-y-auto p-8">
      <div class="flex max-w-6xl mx-auto">
        <div class="w-52" style="min-width: 208px">
          <div class="relative">
            <cards-book-cover :audiobook="audiobook" :width="208" />
            <div class="absolute bottom-0 left-0 h-1.5 bg-yellow-400 shadow-sm" :class="userIsRead ? 'bg-success' : 'bg-yellow-400'" :style="{ width: 208 * progressPercent + 'px' }"></div>
          </div>
        </div>
        <div class="flex-grow px-10">
          <div class="flex">
            <div class="mb-4">
              <div class="flex items-end">
                <h1 class="text-3xl font-sans">
                  {{ title }}<span v-if="isDeveloperMode"> ({{ audiobook.ino }})</span>
                </h1>
                <p v-if="subtitle" class="ml-4 text-gray-400 text-2xl">{{ subtitle }}</p>
              </div>

              <p class="mb-2 mt-0.5 text-gray-100 text-xl">
                by <nuxt-link v-if="authorFL" :to="`/library/${libraryId}/bookshelf?filter=authors.${$encode(authorFL)}`" class="hover:underline">{{ authorFL }}</nuxt-link
                ><span v-else>Unknown</span>
              </p>
              <nuxt-link v-if="series" :to="`/library/${libraryId}/bookshelf/series?series=${$encode(series)}`" class="hover:underline font-sans text-gray-300 text-lg leading-7 mb-4"> {{ seriesText }}</nuxt-link>

              <div v-if="narrator" class="flex py-0.5">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Narrated By</span>
                </div>
                <div>
                  <nuxt-link :to="`/library/${libraryId}/bookshelf?filter=narrators.${$encode(narrator)}`" class="hover:underline">{{ narrator }}</nuxt-link>
                </div>
              </div>
              <div v-if="publishYear" class="flex py-0.5">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Publish Year</span>
                </div>
                <div>
                  {{ publishYear }}
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
              <div v-if="tracks.length" class="flex py-0.5">
                <div class="w-32">
                  <span class="text-white text-opacity-60 uppercase text-sm">Size</span>
                </div>
                <div>
                  {{ sizePretty }}
                </div>
              </div>
            </div>
            <div class="flex-grow" />
          </div>

          <!-- Alerts -->
          <div v-show="showExperimentalReadAlert" class="bg-error p-4 rounded-xl flex items-center">
            <span class="material-icons text-2xl">warning_amber</span>
            <p class="ml-4">Book has no audio tracks but has valid ebook files. The e-reader is experimental and can be turned on in config.</p>
          </div>

          <div v-if="progressPercent > 0 && progressPercent < 1" class="px-4 py-2 mt-4 bg-primary text-sm font-semibold rounded-md text-gray-200 relative max-w-max" :class="resettingProgress ? 'opacity-25' : ''">
            <p class="leading-6">Your Progress: {{ Math.round(progressPercent * 100) }}%</p>
            <p class="text-gray-400 text-xs">{{ $elapsedPretty(userTimeRemaining) }} remaining</p>
            <div v-if="!resettingProgress" class="absolute -top-1.5 -right-1.5 p-1 w-5 h-5 rounded-full bg-bg hover:bg-error border border-primary flex items-center justify-center cursor-pointer" @click.stop="clearProgressClick">
              <span class="material-icons text-sm">close</span>
            </div>
          </div>

          <div class="flex items-center pt-4">
            <ui-btn v-if="showPlayButton" :disabled="streaming" color="success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="startStream">
              <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">play_arrow</span>
              {{ streaming ? 'Streaming' : 'Play' }}
            </ui-btn>
            <ui-btn v-else-if="isMissing || isIncomplete" color="error" :padding-x="4" small class="flex items-center h-9 mr-2">
              <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">error</span>
              {{ isMissing ? 'Missing' : 'Incomplete' }}
            </ui-btn>

            <ui-btn v-if="showExperimentalFeatures && numEbooks" color="info" :padding-x="4" small class="flex items-center h-9 mr-2" @click="openEbook">
              <span class="material-icons -ml-2 pr-2 text-white">auto_stories</span>
              Read
            </ui-btn>

            <ui-tooltip v-if="userCanUpdate" text="Edit" direction="top">
              <ui-icon-btn icon="edit" class="mx-0.5" @click="editClick" />
            </ui-tooltip>

            <ui-tooltip v-if="userCanDownload" :disabled="isMissing" text="Download" direction="top">
              <ui-icon-btn icon="download" :disabled="isMissing" class="mx-0.5" @click="downloadClick" />
            </ui-tooltip>

            <ui-tooltip :text="isRead ? 'Mark as Not Read' : 'Mark as Read'" direction="top">
              <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="isRead" class="mx-0.5" @click="toggleRead" />
            </ui-tooltip>

            <ui-btn v-if="isDeveloperMode" class="mx-2" @click="openRssFeed">Open RSS Feed</ui-btn>
          </div>

          <div class="my-4 max-w-2xl">
            <p class="text-base text-gray-100">{{ description }}</p>
          </div>

          <div v-if="missingParts.length" class="bg-error border-red-800 shadow-md p-4">
            <p class="text-sm mb-2">
              Missing Parts <span class="text-sm">({{ missingParts.length }})</span>
            </p>
            <p class="text-sm font-mono">{{ missingPartChunks.join(', ') }}</p>
          </div>

          <div v-if="invalidParts.length" class="bg-error border-red-800 shadow-md p-4">
            <p class="text-sm mb-2">
              Invalid Parts <span class="text-sm">({{ invalidParts.length }})</span>
            </p>
            <div>
              <p v-for="part in invalidParts" :key="part.filename" class="text-sm font-mono">{{ part.filename }}: {{ part.error }}</p>
            </div>
          </div>

          <tables-tracks-table v-if="tracks.length" :tracks="tracks" :audiobook="audiobook" class="mt-6" />

          <tables-audio-files-table v-if="otherAudioFiles.length" :audiobook-id="audiobook.id" :files="otherAudioFiles" class="mt-6" />

          <tables-other-files-table v-if="otherFiles.length" :audiobook="audiobook" :files="otherFiles" class="mt-6" />
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
    var audiobook = await app.$axios.$get(`/api/audiobook/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!audiobook) {
      console.error('No audiobook...', params.id)
      return redirect('/')
    }
    store.commit('audiobooks/addUpdate', audiobook)
    return {
      audiobook
    }
  },
  data() {
    return {
      isRead: false,
      resettingProgress: false,
      isProcessingReadUpdate: false
    }
  },
  watch: {
    userIsRead: {
      immediate: true,
      handler(newVal) {
        this.isRead = newVal
      }
    }
  },
  computed: {
    isDeveloperMode() {
      return this.$store.state.developerMode
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    missingPartChunks() {
      if (this.missingParts === 1) return this.missingParts[0]
      var chunks = []

      var currentIndex = this.missingParts[0]
      var currentChunk = [this.missingParts[0]]

      for (let i = 1; i < this.missingParts.length; i++) {
        var partIndex = this.missingParts[i]
        if (currentIndex === partIndex - 1) {
          currentChunk.push(partIndex)
          currentIndex = partIndex
        } else {
          // console.log('Chunk ended', currentChunk.join(', '), currentIndex, partIndex)
          if (currentChunk.length === 0) {
            console.error('How is current chunk 0?', currentChunk.join(', '))
          }
          chunks.push(currentChunk)
          currentChunk = [partIndex]
          currentIndex = partIndex
        }
      }
      if (currentChunk.length) {
        chunks.push(currentChunk)
      }
      chunks = chunks.map((chunk) => {
        if (chunk.length === 1) return chunk[0]
        else return `${chunk[0]}-${chunk[chunk.length - 1]}`
      })
      return chunks
    },
    isMissing() {
      return this.audiobook.isMissing
    },
    isIncomplete() {
      return this.audiobook.isIncomplete
    },
    showPlayButton() {
      return !this.isMissing && !this.isIncomplete && this.tracks.length
    },
    missingParts() {
      return this.audiobook.missingParts || []
    },
    invalidParts() {
      return this.audiobook.invalidParts || []
    },
    libraryId() {
      return this.audiobook.libraryId
    },
    folderId() {
      return this.audiobook.folderId
    },
    audiobookId() {
      return this.audiobook.id
    },
    title() {
      return this.book.title || 'No Title'
    },
    publishYear() {
      return this.book.publishYear
    },
    narrator() {
      return this.book.narrator
    },
    subtitle() {
      return this.book.subtitle
    },
    genres() {
      return this.book.genres || []
    },
    author() {
      return this.book.author || 'Unknown'
    },
    authorFL() {
      return this.book.authorFL
    },
    authorLF() {
      return this.book.authorLF
    },
    authorTooltipText() {
      var txt = ['FL: ' + this.authorFL || 'Not Set', 'LF: ' + this.authorLF || 'Not Set']
      return txt.join('<br>')
    },
    series() {
      return this.book.series || null
    },
    volumeNumber() {
      return this.book.volumeNumber || null
    },
    seriesText() {
      if (!this.series) return ''
      if (!this.volumeNumber) return this.series
      return `${this.series} #${this.volumeNumber}`
    },
    durationPretty() {
      return this.audiobook.durationPretty
    },
    duration() {
      return this.audiobook.duration
    },
    sizePretty() {
      return this.audiobook.sizePretty
    },
    book() {
      return this.audiobook.book || {}
    },
    otherFiles() {
      return this.audiobook.otherFiles || []
    },
    otherAudioFiles() {
      return this.audioFiles.filter((af) => {
        return !this.tracks.find((t) => t.path === af.path)
      })
    },
    tracks() {
      return this.audiobook.tracks || []
    },
    audioFiles() {
      return this.audiobook.audioFiles || []
    },
    ebooks() {
      return this.audiobook.ebooks
    },
    showExperimentalReadAlert() {
      return !this.tracks.length && this.ebooks.length && !this.showExperimentalFeatures
    },
    numEbooks() {
      return this.audiobook.numEbooks
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    description() {
      return this.book.description || ''
    },
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    },
    userAudiobook() {
      return this.userAudiobooks[this.audiobookId] || null
    },
    userCurrentTime() {
      return this.userAudiobook ? this.userAudiobook.currentTime : 0
    },
    userIsRead() {
      return this.userAudiobook ? !!this.userAudiobook.isRead : false
    },
    userTimeRemaining() {
      return this.duration - this.userCurrentTime
    },
    progressPercent() {
      return this.userAudiobook ? this.userAudiobook.progress : 0
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    streaming() {
      return this.streamAudiobook && this.streamAudiobook.id === this.audiobookId
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
    openEbook() {
      this.$store.commit('showEReader', this.audiobook)
    },
    toggleRead() {
      var updatePayload = {
        isRead: !this.isRead
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/user/audiobook/${this.audiobookId}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
          this.$toast.success(`"${this.title}" Marked as ${updatePayload.isRead ? 'Read' : 'Not Read'}`)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(`Failed to mark as ${updatePayload.isRead ? 'Read' : 'Not Read'}`)
        })
    },
    openRssFeed() {
      this.$axios
        .$post('/api/feed', { audiobookId: this.audiobook.id })
        .then((res) => {
          console.log('Feed open', res)
          this.$toast.success('RSS Feed Open')
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Failed to open feed')
        })
    },
    startStream() {
      this.$store.commit('setStreamAudiobook', this.audiobook)
      this.$root.socket.emit('open_stream', this.audiobook.id)
    },
    editClick() {
      this.$store.commit('setBookshelfBookIds', [])
      this.$store.commit('showEditModal', this.audiobook)
    },
    audiobookUpdated() {
      console.log('Audiobook Updated - Fetch full audiobook')
      this.$axios
        .$get(`/api/audiobook/${this.audiobookId}`)
        .then((audiobook) => {
          console.log('Updated audiobook', audiobook)
          this.audiobook = audiobook
        })
        .catch((error) => {
          console.error('Failed', error)
        })
    },
    clearProgressClick() {
      if (confirm(`Are you sure you want to reset your progress?`)) {
        this.resettingProgress = true
        this.$axios
          .$patch(`/api/user/audiobook/${this.audiobookId}/reset-progress`)
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
      this.$store.commit('showEditModalOnTab', { audiobook: this.audiobook, tab: 'download' })
    }
  },
  mounted() {
    this.$store.commit('audiobooks/addListener', { id: 'audiobook', audiobookId: this.audiobookId, meth: this.audiobookUpdated })

    // If a library has not yet been loaded, use this audiobooks library id as the current
    if (!this.$store.state.audiobooks.loadedLibraryId && this.libraryId) {
      this.$store.commit('libraries/setCurrentLibrary', this.libraryId)
    }
  },
  beforeDestroy() {
    this.$store.commit('audiobooks/removeListener', 'audiobook')
  }
}
</script>
