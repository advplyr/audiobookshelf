<template>
  <div v-if="streamAudiobook" id="streamContainer" class="w-full fixed bottom-0 left-0 right-0 h-40 z-40 bg-primary px-4 pb-4 pt-2">
    <nuxt-link :to="`/audiobook/${streamAudiobook.id}`" class="absolute -top-16 left-4 cursor-pointer">
      <cards-book-cover :audiobook="streamAudiobook" :width="88" />
    </nuxt-link>
    <div class="flex items-center pl-24">
      <div>
        <nuxt-link :to="`/audiobook/${streamAudiobook.id}`" class="hover:underline cursor-pointer text-lg">
          {{ title }} <span v-if="stream && $isDev" class="text-xs text-gray-400">({{ stream.id }})</span>
        </nuxt-link>
        <div class="text-gray-400 flex items-center">
          <span class="material-icons text-sm">person</span>
          <p v-if="authorFL" class="pl-1.5 text-base">
            <nuxt-link v-for="(author, index) in authorsList" :key="index" :to="`/library/${libraryId}/bookshelf?filter=authors.${$encode(author)}`" class="hover:underline">{{ author }}<span v-if="index < authorsList.length - 1">,&nbsp;</span></nuxt-link>
          </p>
          <p v-else class="text-base cursor-pointer pl-2">Unknown</p>
        </div>

        <div class="text-gray-400 flex items-center">
          <span class="material-icons text-xs">schedule</span>
          <p class="font-mono text-sm pl-2 pb-px">{{ totalDurationPretty }}</p>
        </div>
      </div>
      <div class="flex-grow" />
      <span v-if="stream" class="material-icons px-4 cursor-pointer" @click="cancelStream">close</span>
    </div>

    <audio-player ref="audioPlayer" :chapters="chapters" :loading="isLoading" :bookmarks="bookmarks" @close="cancelStream" @updateTime="updateTime" @loaded="(d) => (totalDuration = d)" @showBookmarks="showBookmarks" @hook:mounted="audioPlayerMounted" />

    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :audiobook-id="bookmarkAudiobookId" :current-time="bookmarkCurrentTime" @select="selectBookmark" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      audioPlayerReady: false,
      lastServerUpdateSentSeconds: 0,
      stream: null,
      totalDuration: 0,
      showBookmarksModal: false,
      bookmarkCurrentTime: 0,
      bookmarkAudiobookId: null
    }
  },
  computed: {
    cover() {
      if (this.streamAudiobook && this.streamAudiobook.cover) return this.streamAudiobook.cover
      return 'Logo.png'
    },
    user() {
      return this.$store.state.user.user
    },
    userAudiobook() {
      if (!this.audiobookId) return
      return this.$store.getters['user/getUserAudiobook'](this.audiobookId)
    },
    bookmarks() {
      if (!this.userAudiobook) return []
      return (this.userAudiobook.bookmarks || []).map((bm) => ({ ...bm })).sort((a, b) => a.time - b.time)
    },
    isLoading() {
      if (!this.streamAudiobook) return false
      if (this.stream) {
        // IF Stream exists, set loading if stream is diff from next stream
        return this.stream.audiobook.id !== this.streamAudiobook.id
      }
      return true
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    audiobookId() {
      return this.streamAudiobook ? this.streamAudiobook.id : null
    },
    book() {
      return this.streamAudiobook ? this.streamAudiobook.book || {} : {}
    },
    chapters() {
      return this.streamAudiobook ? this.streamAudiobook.chapters || [] : []
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
    authorsList() {
      return this.authorFL ? this.authorFL.split(', ') : []
    },
    streamId() {
      return this.stream ? this.stream.id : null
    },
    playlistUrl() {
      return this.stream ? this.stream.clientPlaylistUri : null
    },
    libraryId() {
      return this.streamAudiobook ? this.streamAudiobook.libraryId : null
    },
    totalDurationPretty() {
      return this.$secondsToTimestamp(this.totalDuration)
    }
  },
  methods: {
    showBookmarks(currentTime) {
      this.bookmarkAudiobookId = this.audiobookId
      this.bookmarkCurrentTime = currentTime
      this.showBookmarksModal = true
    },
    selectBookmark(bookmark) {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.selectBookmark(bookmark)
      }
      this.showBookmarksModal = false
    },
    filterByAuthor() {
      if (this.$route.name !== 'index') {
        this.$router.push(`/library/${this.libraryId || this.$store.state.libraries.currentLibraryId}/bookshelf`)
      }
      var settingsUpdate = {
        filterBy: `authors.${this.$encode(this.author)}`
      }
      this.$store.dispatch('user/updateUserSettings', settingsUpdate)
    },
    audioPlayerMounted() {
      this.audioPlayerReady = true
      if (this.stream) {
        console.log('[STREAM-CONTAINER] audioPlayerMounted w/ Stream', this.stream)
        this.openStream()
      }
    },
    cancelStream() {
      this.$root.socket.emit('close_stream')
    },
    terminateStream() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.terminateStream()
      }
    },
    openStream() {
      var playOnLoad = this.$store.state.playOnLoad
      console.log(`[StreamContainer] openStream PlayOnLoad`, playOnLoad)
      if (!this.$refs.audioPlayer) {
        console.error('NO Audio Player')
        return
      }
      var currentTime = this.stream.clientCurrentTime || 0
      this.$refs.audioPlayer.set(this.playlistUrl, currentTime, playOnLoad)
      if (this.stream.isTranscodeComplete) {
        this.$refs.audioPlayer.setStreamReady()
      }
    },
    streamProgress(data) {
      if (!data.numSegments) return
      var chunks = data.chunks
      console.log(`[StreamContainer] Stream Progress ${data.percent}`)
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setChunksReady(chunks, data.numSegments)
      } else {
        console.error('No Audio Ref')
      }
    },
    streamOpen(stream) {
      this.stream = stream
      if (this.$refs.audioPlayer) {
        console.log('[StreamContainer] streamOpen', stream)
        this.openStream()
      } else if (this.audioPlayerReady) {
        console.error('No Audio Ref')
      }
    },
    streamClosed(streamId) {
      if (this.stream && (this.stream.id === streamId || streamId === 'n/a')) {
        this.terminateStream()
        this.$store.commit('clearStreamAudiobook', this.stream.audiobook.id)
        this.stream = null
      }
    },
    streamReady() {
      console.log(`[STREAM-CONTAINER] Stream Ready`)
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setStreamReady()
      } else {
        console.error('No Audio Ref')
      }
    },
    updateTime(currentTime) {
      var diff = currentTime - this.lastServerUpdateSentSeconds
      if (diff > 4 || diff < 0) {
        this.lastServerUpdateSentSeconds = currentTime
        var updatePayload = {
          currentTime,
          streamId: this.streamId
        }
        this.$root.socket.emit('stream_update', updatePayload)
      }
    },
    streamReset({ startTime, streamId }) {
      if (streamId !== this.streamId) {
        console.error('resetStream StreamId Mismatch', streamId, this.streamId)
        return
      }
      if (this.$refs.audioPlayer) {
        console.log(`[STREAM-CONTAINER] streamReset Received for time ${startTime}`)
        this.$refs.audioPlayer.resetStream(startTime)
      }
    }
  }
}
</script>

<style>
#streamContainer {
  box-shadow: 0px -6px 8px #1111113f;
}
</style>