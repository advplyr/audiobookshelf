<template>
  <tr class="book-row" :class="selected ? 'selected' : ''">
    <td class="body-cell min-w-12 max-w-12">
      <div class="flex justify-center">
        <div class="bg-white border-2 rounded border-gray-400 flex flex-shrink-0 justify-center items-center focus-within:border-blue-500 w-4 h-4" @click="selectBtnClick">
          <svg v-if="selected" class="fill-current text-green-500 pointer-events-none w-2.5 h-2.5" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
        </div>
      </div>
    </td>
    <td class="body-cell min-w-6 max-w-6">
      <covers-hover-book-cover :audiobook="book" />
    </td>
    <td class="body-cell min-w-64 max-w-64 px-2">
      <nuxt-link :to="`/audiobook/${book.id}`" class="hover:underline">
        <p class="truncate">
          {{ book.book.title }}<span v-if="book.book.subtitle">: {{ book.book.subtitle }}</span>
        </p>
      </nuxt-link>
    </td>
    <td class="body-cell min-w-48 max-w-48 px-2">
      <p class="truncate">{{ book.book.authorFL }}</p>
    </td>
    <td class="body-cell min-w-48 max-w-48 px-2">
      <p class="truncate">{{ seriesText }}</p>
    </td>
    <td class="body-cell min-w-24 max-w-24 px-2">
      <p class="truncate">{{ book.book.publishYear }}</p>
    </td>
    <td class="body-cell min-w-80 max-w-80 px-2">
      <p class="truncate">{{ book.book.description }}</p>
    </td>
    <td class="body-cell min-w-48 max-w-48 px-2">
      <p class="truncate">{{ book.book.narrator }}</p>
    </td>
    <td class="body-cell min-w-48 max-w-48 px-2">
      <p class="truncate">{{ genresText }}</p>
    </td>
    <td class="body-cell min-w-48 max-w-48 px-2">
      <p class="truncate">{{ tagsText }}</p>
    </td>
    <td class="body-cell min-w-24 max-w-24 px-2">
      <div class="flex">
        <span v-if="userCanUpdate" class="material-icons cursor-pointer text-white text-opacity-60 hover:text-opacity-100 text-xl" @click="editClick">edit</span>
        <span v-if="showPlayButton" class="material-icons cursor-pointer text-white text-opacity-60 hover:text-opacity-100 text-2xl mx-1" @click="startStream">play_arrow</span>
        <span v-if="showReadButton" class="material-icons cursor-pointer text-white text-opacity-60 hover:text-opacity-100 text-xl" @click="openEbook">auto_stories</span>
      </div>
    </td>
  </tr>
</template>

<script>
export default {
  props: {
    book: {
      type: Object,
      default: () => {}
    },
    userAudiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      isProcessingReadUpdate: false
    }
  },
  computed: {
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    audiobookId() {
      return this.book.id
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
    bookObj() {
      return this.book.book || {}
    },
    series() {
      return this.bookObj.series || null
    },
    volumeNumber() {
      return this.bookObj.volumeNumber || null
    },
    seriesText() {
      if (!this.series) return ''
      if (!this.volumeNumber) return this.series
      return `${this.series} #${this.volumeNumber}`
    },
    genresText() {
      if (!this.bookObj.genres) return ''
      return this.bookObj.genres.join(', ')
    },
    tagsText() {
      return (this.book.tags || []).join(', ')
    },
    isMissing() {
      return this.book.isMissing
    },
    isInvalid() {
      return this.book.isInvalid
    },
    numEbooks() {
      return this.book.numEbooks
    },
    numTracks() {
      return this.book.numTracks
    },
    isStreaming() {
      return this.$store.getters['getAudiobookIdStreaming'] === this.audiobookId
    },
    showReadButton() {
      return this.showExperimentalFeatures && this.numEbooks
    },
    showPlayButton() {
      return !this.isMissing && !this.isInvalid && this.numTracks && !this.isStreaming
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
      this.$store.commit('showEReader', this.book)
    },
    downloadClick() {
      this.$store.commit('showEditModalOnTab', { audiobook: this.book, tab: 'download' })
    },
    toggleRead() {
      var updatePayload = {
        isRead: !this.userIsRead
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/me/audiobook/${this.audiobookId}`, updatePayload)
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
      this.$store.commit('setStreamAudiobook', this.book)
      this.$root.socket.emit('open_stream', this.book.id)
    },
    editClick() {
      this.$emit('edit', this.book)
    }
  },
  mounted() {}
}
</script>