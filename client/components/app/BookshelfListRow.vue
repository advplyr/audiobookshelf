<template>
  <div :class="selected ? 'bg-success bg-opacity-10' : ''">
    <div class="flex px-12 mx-auto" style="max-width: 1400px">
      <div class="w-12 h-full flex items-center justify-center self-center">
        <ui-checkbox v-model="selected" />
      </div>
      <div class="p-3">
        <cards-book-cover :width="bookCoverWidth" :audiobook="bookItem" />
      </div>
      <div class="flex-grow p-3">
        <div class="flex h-full">
          <div class="w-full max-w-xl">
            <nuxt-link :to="`/audiobook/${audiobookId}`" class="flex items-center hover:underline">
              <p class="text-base font-book">{{ title }}<span v-if="subtitle">:</span></p>
              <p class="text-base font-book pl-2 text-gray-200">{{ subtitle }}</p>
            </nuxt-link>
            <p class="text-gray-200 text-sm" v-if="seriesText">{{ seriesText }}</p>
            <p class="text-sm text-gray-300">{{ author }}</p>
            <div class="flex pt-2">
              <div class="rounded-full bg-black bg-opacity-50 px-2 py-px text-xs text-gray-200">
                <p>{{ numTracks }} Tracks</p>
              </div>
              <div class="rounded-full bg-black bg-opacity-50 px-2 py-px text-xs text-gray-200 mx-2">
                <p>{{ durationPretty }}</p>
              </div>
              <div class="rounded-full bg-black bg-opacity-50 px-2 py-px text-xs text-gray-200">
                <p>{{ sizePretty }}</p>
              </div>
            </div>
          </div>
          <div class="w-full max-w-xl pr-6 pl-12 items-center h-full pb-3 hidden xl:flex">
            <p class="text-sm text-gray-200 max-3-lines">{{ description }}</p>
          </div>
        </div>
      </div>
      <div class="w-32 h-full self-center">
        <div class="flex justify-center mb-2">
          <ui-btn v-if="showPlayButton" :disabled="streaming" color="success" :padding-x="4" small class="flex items-center h-9" @click="startStream">
            <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">play_arrow</span>
            {{ streaming ? 'Streaming' : 'Play' }}
          </ui-btn>
        </div>
        <div class="flex">
          <ui-tooltip v-if="userCanUpdate" text="Edit" direction="top">
            <ui-icon-btn icon="edit" class="mx-0.5" @click="editClick" />
          </ui-tooltip>

          <ui-tooltip v-if="userCanDownload" :disabled="isMissing" text="Download" direction="top">
            <ui-icon-btn icon="download" :disabled="isMissing" class="mx-0.5" @click="downloadClick" />
          </ui-tooltip>

          <ui-tooltip :text="userIsRead ? 'Mark as Not Read' : 'Mark as Read'" direction="top">
            <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsRead" class="mx-0.5" @click="toggleRead" />
          </ui-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    bookItem: {
      type: Object,
      default: () => {}
    },
    userAudiobook: {
      type: Object,
      default: () => {}
    },
    bookCoverWidth: Number
  },
  data() {
    return {
      isProcessingReadUpdate: false
    }
  },
  computed: {
    audiobookId() {
      return this.bookItem.id
    },
    isSelectionMode() {
      return !!this.selectedAudiobooks.length
    },
    selectedAudiobooks() {
      return this.$store.state.selectedAudiobooks
    },
    selected: {
      get() {
        return this.$store.getters['getIsAudiobookSelected'](this.audiobookId)
      },
      set(val) {
        if (this.processingBatch) return
        this.$store.commit('setAudiobookSelected', { audiobookId: this.audiobookId, selected: val })
      }
    },
    processingBatch() {
      return this.$store.state.processingBatch
    },
    isMissing() {
      return this.bookItem.isMissing
    },
    isIncomplete() {
      return this.bookItem.isIncomplete
    },
    numTracks() {
      return this.bookItem.numTracks
    },
    durationPretty() {
      return this.$elapsedPretty(this.bookItem.duration)
    },
    sizePretty() {
      return this.$bytesPretty(this.bookItem.size)
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    streaming() {
      return this.streamAudiobook && this.streamAudiobook.id === this.audiobookId
    },
    book() {
      return this.bookItem.book || {}
    },
    title() {
      return this.book.title
    },
    subtitle() {
      return this.book.subtitle
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
    description() {
      return this.book.description
    },
    author() {
      return this.book.authorFL
    },
    showPlayButton() {
      return !this.isMissing && !this.isIncomplete && this.numTracks
    },
    userCurrentTime() {
      return this.userAudiobook ? this.userAudiobook.currentTime : 0
    },
    userIsRead() {
      return this.userAudiobook ? !!this.userAudiobook.isRead : false
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
    selectBtnClick() {
      if (this.processingBatch) return
      this.$store.commit('toggleAudiobookSelected', this.audiobookId)
    },
    openEbook() {
      this.$store.commit('showEReader', this.bookItem)
    },
    downloadClick() {
      this.$store.commit('showEditModalOnTab', { audiobook: this.bookItem, tab: 'download' })
    },
    toggleRead() {
      var updatePayload = {
        isRead: !this.userIsRead
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
    startStream() {
      this.$store.commit('setStreamAudiobook', this.bookItem)
      this.$root.socket.emit('open_stream', this.bookItem.id)
    },
    editClick() {
      this.$store.commit('setBookshelfBookIds', [])
      this.$store.commit('showEditModal', this.bookItem)
    }
  },
  mounted() {}
}
</script>

<style>
.max-3-lines {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3; /* number of lines to show */
  -webkit-box-orient: vertical;
}
</style>