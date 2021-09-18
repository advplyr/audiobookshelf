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
            <div class="mb-2">
              <h1 class="text-2xl font-book leading-7">{{ title }}</h1>
              <h3 v-if="series" class="font-book text-gray-300 text-lg leading-7">{{ seriesText }}</h3>
              <div class="w-min">
                <ui-tooltip :text="authorTooltipText" direction="bottom">
                  <span class="text-sm text-gray-100 leading-7 whitespace-nowrap">by {{ author }}</span>
                </ui-tooltip>
              </div>
            </div>
            <div class="flex-grow" />
          </div>
          <p class="text-gray-300 text-sm my-1">
            {{ durationPretty }}<span class="px-4">{{ sizePretty }}</span>
          </p>
          <div v-if="progressPercent > 0 && progressPercent < 1" class="px-4 py-2 mt-4 bg-primary text-sm font-semibold rounded-md text-gray-200 relative max-w-max" :class="resettingProgress ? 'opacity-25' : ''">
            <p class="leading-6">Your Progress: {{ Math.round(progressPercent * 100) }}%</p>
            <p class="text-gray-400 text-xs">{{ $elapsedPretty(userTimeRemaining) }} remaining</p>
            <div v-if="!resettingProgress" class="absolute -top-1.5 -right-1.5 p-1 w-5 h-5 rounded-full bg-bg hover:bg-error border border-primary flex items-center justify-center cursor-pointer" @click.stop="clearProgressClick">
              <span class="material-icons text-sm">close</span>
            </div>
          </div>

          <div class="flex items-center pt-4">
            <ui-btn v-if="!isMissing" :disabled="streaming" color="success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="startStream">
              <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">play_arrow</span>
              {{ streaming ? 'Streaming' : 'Play' }}
            </ui-btn>
            <ui-btn v-else color="error" :padding-x="4" small class="flex items-center h-9 mr-2">
              <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">error</span>
              Missing
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

            <div class="flex-grow" />
          </div>

          <div class="my-4">
            <p class="text-sm text-gray-100">{{ description }}</p>
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

          <tables-tracks-table :tracks="tracks" :audiobook-id="audiobook.id" class="mt-6" />

          <tables-audio-files-table v-if="otherAudioFiles.length" :audiobook-id="audiobook.id" :files="otherAudioFiles" class="mt-6" />

          <tables-other-files-table v-if="otherFiles.length" :audiobook-id="audiobook.id" :files="otherFiles" class="mt-6" />
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
    missingParts() {
      return this.audiobook.missingParts || []
    },
    invalidParts() {
      return this.audiobook.invalidParts || []
    },
    audiobookId() {
      return this.audiobook.id
    },
    title() {
      return this.book.title || 'No Title'
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
      this.$store.commit('showEditModal', this.audiobook)
    },
    lookupMetadata(index) {
      this.$axios
        .$get(`/api/metadata/${this.audiobookId}/${index}`)
        .then((metadata) => {
          console.log('Metadata for ' + index, metadata)
        })
        .catch((error) => {
          console.error(error)
        })
    },
    audiobookUpdated() {
      console.log('Audiobook Updated - Fetch full audiobook')
      this.$axios
        .$get(`/api/audiobook/${this.audiobookId}`)
        .then((audiobook) => {
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
          .$delete(`/api/user/audiobook/${this.audiobookId}`)
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
  },
  beforeDestroy() {
    this.$store.commit('audiobooks/removeListener', 'audiobook')
  }
}
</script>
