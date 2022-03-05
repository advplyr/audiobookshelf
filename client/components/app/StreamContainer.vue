<template>
  <div v-if="streamAudiobook" id="streamContainer" class="w-full fixed bottom-0 left-0 right-0 h-48 sm:h-44 md:h-40 z-40 bg-primary px-4 pb-1 md:pb-4 pt-2">
    <nuxt-link :to="`/audiobook/${streamAudiobook.id}`" class="absolute left-4 cursor-pointer" :style="{ top: bookCoverPosTop + 'px' }">
      <covers-book-cover :audiobook="streamAudiobook" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    </nuxt-link>
    <div class="flex items-start pl-24 mb-6 md:mb-0">
      <div>
        <nuxt-link :to="`/audiobook/${streamAudiobook.id}`" class="hover:underline cursor-pointer text-base sm:text-lg">
          {{ title }}
        </nuxt-link>
        <div class="text-gray-400 flex items-center">
          <span class="material-icons text-sm">person</span>
          <p v-if="authorFL" class="pl-1.5 text-sm sm:text-base">
            <nuxt-link v-for="(author, index) in authorsList" :key="index" :to="`/library/${libraryId}/bookshelf?filter=authors.${$encode(author)}`" class="hover:underline">{{ author }}<span v-if="index < authorsList.length - 1">,&nbsp;</span></nuxt-link>
          </p>
          <p v-else class="text-sm sm:text-base cursor-pointer pl-2">Unknown</p>
        </div>

        <div class="text-gray-400 flex items-center">
          <span class="material-icons text-xs">schedule</span>
          <p class="font-mono text-sm pl-2 pb-px">{{ totalDurationPretty }}</p>
        </div>
      </div>
      <div class="flex-grow" />
      <span class="material-icons px-2 py-1 md:p-4 cursor-pointer" @click="closePlayer">close</span>
    </div>

    <audio-player
      ref="audioPlayer"
      :chapters="chapters"
      :paused="!isPlaying"
      :loading="playerLoading"
      :bookmarks="bookmarks"
      :sleep-timer-set="sleepTimerSet"
      :sleep-timer-remaining="sleepTimerRemaining"
      @playPause="playPause"
      @jumpForward="jumpForward"
      @jumpBackward="jumpBackward"
      @setVolume="setVolume"
      @setPlaybackRate="setPlaybackRate"
      @seek="seek"
      @close="closePlayer"
      @showBookmarks="showBookmarks"
      @showSleepTimer="showSleepTimerModal = true"
    />

    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :audiobook-id="bookmarkAudiobookId" :current-time="bookmarkCurrentTime" @select="selectBookmark" />

    <modals-sleep-timer-modal v-model="showSleepTimerModal" :timer-set="sleepTimerSet" :timer-time="sleepTimerTime" :remaining="sleepTimerRemaining" @set="setSleepTimer" @cancel="cancelSleepTimer" @increment="incrementSleepTimer" @decrement="decrementSleepTimer" />
  </div>
</template>

<script>
import PlayerHandler from '@/players/PlayerHandler'

export default {
  data() {
    return {
      playerHandler: new PlayerHandler(this),
      totalDuration: 0,
      showBookmarksModal: false,
      bookmarkCurrentTime: 0,
      bookmarkAudiobookId: null,
      playerLoading: false,
      isPlaying: false,
      currentTime: 0,
      showSleepTimerModal: false,
      sleepTimerSet: false,
      sleepTimerTime: 0,
      sleepTimerRemaining: 0,
      sleepTimer: null
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
      return 88
    },
    bookCoverPosTop() {
      if (this.bookCoverAspectRatio === 1) return -10
      return -64
    },
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
    userAudiobookCurrentTime() {
      return this.userAudiobook ? this.userAudiobook.currentTime || 0 : 0
    },
    bookmarks() {
      if (!this.userAudiobook) return []
      return (this.userAudiobook.bookmarks || []).map((bm) => ({ ...bm })).sort((a, b) => a.time - b.time)
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
    libraryId() {
      return this.streamAudiobook ? this.streamAudiobook.libraryId : null
    },
    totalDurationPretty() {
      return this.$secondsToTimestamp(this.totalDuration)
    }
  },
  methods: {
    setSleepTimer(seconds) {
      this.sleepTimerSet = true
      this.sleepTimerTime = seconds
      this.sleepTimerRemaining = seconds
      this.runSleepTimer()
      this.showSleepTimerModal = false
    },
    runSleepTimer() {
      var lastTick = Date.now()
      clearInterval(this.sleepTimer)
      this.sleepTimer = setInterval(() => {
        var elapsed = Date.now() - lastTick
        lastTick = Date.now()
        this.sleepTimerRemaining -= elapsed / 1000

        if (this.sleepTimerRemaining <= 0) {
          this.clearSleepTimer()
          this.playerHandler.pause()
          this.$toast.info('Sleep Timer Done.. zZzzZz')
        }
      }, 1000)
    },
    cancelSleepTimer() {
      this.showSleepTimerModal = false
      this.clearSleepTimer()
    },
    clearSleepTimer() {
      clearInterval(this.sleepTimer)
      this.sleepTimerRemaining = 0
      this.sleepTimer = null
      this.sleepTimerSet = false
    },
    incrementSleepTimer(amount) {
      if (!this.sleepTimerSet) return
      this.sleepTimerRemaining += amount
    },
    decrementSleepTimer(amount) {
      if (this.sleepTimerRemaining < amount) {
        this.sleepTimerRemaining = 3
        return
      }
      this.sleepTimerRemaining = Math.max(0, this.sleepTimerRemaining - amount)
    },
    playPause() {
      this.playerHandler.playPause()
    },
    jumpForward() {
      this.playerHandler.jumpForward()
    },
    jumpBackward() {
      this.playerHandler.jumpBackward()
    },
    setVolume(volume) {
      this.playerHandler.setVolume(volume)
    },
    setPlaybackRate(playbackRate) {
      this.playerHandler.setPlaybackRate(playbackRate)
    },
    seek(time) {
      this.playerHandler.seek(time)
    },
    setCurrentTime(time) {
      this.currentTime = time
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setCurrentTime(time)
      }
    },
    setDuration(duration) {
      this.totalDuration = duration
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setDuration(duration)
      }
    },
    setBufferTime(buffertime) {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setBufferTime(buffertime)
      }
    },
    showBookmarks() {
      this.bookmarkAudiobookId = this.audiobookId
      this.bookmarkCurrentTime = this.currentTime
      this.showBookmarksModal = true
    },
    selectBookmark(bookmark) {
      this.seek(bookmark.time)
      this.showBookmarksModal = false
    },
    closePlayer() {
      this.playerHandler.closePlayer()
      this.$store.commit('setStreamAudiobook', null)
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
      this.$store.commit('setStreamAudiobook', stream.audiobook)
      this.playerHandler.prepareStream(stream)
    },
    streamClosed(streamId) {
      // Stream was closed from the server
      if (this.playerHandler.isPlayingLocalAudiobook && this.playerHandler.currentStreamId === streamId) {
        console.warn('[StreamContainer] Closing stream due to request from server')
        this.playerHandler.closePlayer()
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
    streamError(streamId) {
      // Stream had critical error from the server
      if (this.playerHandler.isPlayingLocalAudiobook && this.playerHandler.currentStreamId === streamId) {
        console.warn('[StreamContainer] Closing stream due to stream error from server')
        this.playerHandler.closePlayer()
      }
    },
    streamReset({ startTime, streamId }) {
      this.playerHandler.resetStream(startTime, streamId)
    },
    castSessionActive(isActive) {
      if (isActive && this.playerHandler.isPlayingLocalAudiobook) {
        // Cast session started switch to cast player
        this.playerHandler.switchPlayer()
      } else if (!isActive && this.playerHandler.isPlayingCastedAudiobook) {
        // Cast session ended switch to local player
        this.playerHandler.switchPlayer()
      }
    },
    async playAudiobook(audiobookId) {
      var audiobook = await this.$axios.$get(`/api/books/${audiobookId}`).catch((error) => {
        console.error('Failed to fetch full audiobook', error)
        return null
      })
      if (!audiobook) return
      this.$store.commit('setStreamAudiobook', audiobook)

      this.playerHandler.load(audiobook, true, this.userAudiobookCurrentTime)
    }
  },
  mounted() {
    this.$eventBus.$on('cast-session-active', this.castSessionActive)
    this.$eventBus.$on('play-audiobook', this.playAudiobook)
  },
  beforeDestroy() {
    this.$eventBus.$off('cast-session-active', this.castSessionActive)
    this.$eventBus.$off('play-audiobook', this.playAudiobook)
  }
}
</script>

<style>
#streamContainer {
  box-shadow: 0px -6px 8px #1111113f;
}
</style>