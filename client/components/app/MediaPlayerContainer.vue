<template>
  <div v-if="streamLibraryItem" id="mediaPlayerContainer" class="w-full fixed bottom-0 left-0 right-0 h-48 lg:h-40 z-50 bg-primary px-2 lg:px-4 pb-1 lg:pb-4 pt-2">
    <div class="absolute left-2 top-2 lg:left-4 cursor-pointer">
      <covers-book-cover expand-on-click :library-item="streamLibraryItem" :width="bookCoverWidth" :book-cover-aspect-ratio="coverAspectRatio" />
    </div>
    <div class="flex items-start mb-6 lg:mb-0" :class="isSquareCover ? 'pl-18 sm:pl-24' : 'pl-12 sm:pl-16'">
      <div class="min-w-0 w-full">
        <div class="flex items-center">
          <nuxt-link :to="`/item/${streamLibraryItem.id}`" class="hover:underline cursor-pointer text-sm sm:text-lg block truncate">
            {{ title }}
          </nuxt-link>
          <widgets-explicit-indicator v-if="isExplicit" />
        </div>
        <div class="text-gray-400 flex items-center w-1/2 sm:w-4/5 lg:w-2/5">
          <span class="material-symbols text-sm">person</span>
          <div v-if="podcastAuthor" class="pl-1 sm:pl-1.5 text-xs sm:text-base">{{ podcastAuthor }}</div>
          <div v-else-if="authors.length" class="pl-1 sm:pl-1.5 text-xs sm:text-base truncate">
            <nuxt-link v-for="(author, index) in authors" :key="index" :to="`/author/${author.id}`" class="hover:underline">{{ author.name }}<span v-if="index < authors.length - 1">,&nbsp;</span></nuxt-link>
          </div>
          <div v-else class="text-xs sm:text-base cursor-pointer pl-1 sm:pl-1.5">{{ $strings.LabelUnknown }}</div>
        </div>

        <div class="text-gray-400 flex items-center">
          <span class="material-symbols text-xs">schedule</span>
          <p class="font-mono text-xs sm:text-sm pl-1 sm:pl-1.5 pb-px">{{ totalDurationPretty }}</p>
        </div>
      </div>
      <div class="flex-grow" />
      <ui-tooltip direction="top" :text="$strings.LabelClosePlayer">
        <button :aria-label="$strings.LabelClosePlayer" class="material-symbols sm:px-2 py-1 lg:p-4 cursor-pointer text-xl sm:text-2xl" @click="closePlayer">close</button>
      </ui-tooltip>
    </div>
    <player-ui
      ref="audioPlayer"
      :chapters="chapters"
      :current-chapter="currentChapter"
      :paused="!isPlaying"
      :loading="playerLoading"
      :bookmarks="bookmarks"
      :sleep-timer-set="sleepTimerSet"
      :sleep-timer-remaining="sleepTimerRemaining"
      :sleep-timer-type="sleepTimerType"
      :is-podcast="isPodcast"
      :hasNextItemInQueue="hasNextItemInQueue"
      @playPause="playPause"
      @jumpForward="jumpForward"
      @jumpBackward="jumpBackward"
      @setVolume="setVolume"
      @setPlaybackRate="setPlaybackRate"
      @seek="seek"
      @nextItemInQueue="playNextItemInQueue"
      @close="closePlayer"
      @showBookmarks="showBookmarks"
      @showSleepTimer="showSleepTimerModal = true"
      @showPlayerQueueItems="showPlayerQueueItemsModal = true"
    />

    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :current-time="bookmarkCurrentTime" :library-item-id="libraryItemId" @select="selectBookmark" />

    <modals-sleep-timer-modal v-model="showSleepTimerModal" :timer-set="sleepTimerSet" :timer-type="sleepTimerType" :remaining="sleepTimerRemaining" :has-chapters="!!chapters.length" @set="setSleepTimer" @cancel="cancelSleepTimer" @increment="incrementSleepTimer" @decrement="decrementSleepTimer" />

    <modals-player-queue-items-modal v-model="showPlayerQueueItemsModal" />
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
      playerLoading: false,
      isPlaying: false,
      currentTime: 0,
      showSleepTimerModal: false,
      showPlayerQueueItemsModal: false,
      sleepTimerSet: false,
      sleepTimerRemaining: 0,
      sleepTimerType: null,
      sleepTimer: null,
      displayTitle: null,
      currentPlaybackRate: 1,
      syncFailedToast: null,
      coverAspectRatio: 1
    }
  },
  computed: {
    isSquareCover() {
      return this.coverAspectRatio === 1
    },
    isMobile() {
      return this.$store.state.globals.isMobile
    },
    bookCoverWidth() {
      if (this.isMobile) return 64 / this.coverAspectRatio
      return 77 / this.coverAspectRatio
    },
    cover() {
      if (this.media.coverPath) return this.media.coverPath
      return 'Logo.png'
    },
    user() {
      return this.$store.state.user.user
    },
    userMediaProgress() {
      if (!this.libraryItemId) return
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    userItemCurrentTime() {
      return this.userMediaProgress ? this.userMediaProgress.currentTime || 0 : 0
    },
    bookmarks() {
      if (!this.libraryItemId) return []
      return this.$store.getters['user/getUserBookmarksForItem'](this.libraryItemId)
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    streamEpisode() {
      if (!this.$store.state.streamEpisodeId) return null
      const episodes = this.streamLibraryItem.media.episodes || []
      return episodes.find((ep) => ep.id === this.$store.state.streamEpisodeId)
    },
    libraryItemId() {
      return this.streamLibraryItem?.id || null
    },
    media() {
      return this.streamLibraryItem?.media || {}
    },
    isPodcast() {
      return this.streamLibraryItem?.mediaType === 'podcast'
    },
    isExplicit() {
      return !!this.mediaMetadata.explicit
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    chapters() {
      if (this.streamEpisode) return this.streamEpisode.chapters || []
      return this.media.chapters || []
    },
    currentChapter() {
      return this.chapters.find((chapter) => chapter.start <= this.currentTime && this.currentTime < chapter.end)
    },
    title() {
      if (this.playerHandler.displayTitle) return this.playerHandler.displayTitle
      return this.mediaMetadata.title || 'No Title'
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    libraryId() {
      return this.streamLibraryItem ? this.streamLibraryItem.libraryId : null
    },
    totalDurationPretty() {
      // Adjusted by playback rate
      return this.$secondsToTimestamp(this.totalDuration / this.currentPlaybackRate)
    },
    podcastAuthor() {
      if (!this.isPodcast) return null
      return this.mediaMetadata.author || this.$strings.LabelUnknown
    },
    hasNextItemInQueue() {
      return this.currentPlayerQueueIndex < this.playerQueueItems.length - 1
    },
    currentPlayerQueueIndex() {
      if (!this.libraryItemId) return -1
      return this.playerQueueItems.findIndex((i) => {
        if (this.streamEpisode?.id) return i.episodeId === this.streamEpisode.id
        return i.libraryItemId === this.libraryItemId
      })
    },
    playerQueueItems() {
      return this.$store.state.playerQueueItems || []
    }
  },
  methods: {
    mediaFinished(libraryItemId, episodeId) {
      // Play next item in queue
      if (!this.playerQueueItems.length || !this.$store.state.playerQueueAutoPlay) {
        // TODO: Set media finished flag so play button will play next queue item
        return
      }
      var currentQueueIndex = this.playerQueueItems.findIndex((i) => {
        if (episodeId) return i.libraryItemId === libraryItemId && i.episodeId === episodeId
        return i.libraryItemId === libraryItemId
      })
      if (currentQueueIndex < 0) {
        console.error('Media finished not found in queue - using first in queue', this.playerQueueItems)
        currentQueueIndex = -1
      }
      if (currentQueueIndex === this.playerQueueItems.length - 1) {
        console.log('Finished last item in queue')
        return
      }
      const nextItemInQueue = this.playerQueueItems[currentQueueIndex + 1]
      if (nextItemInQueue) {
        this.playLibraryItem({
          libraryItemId: nextItemInQueue.libraryItemId,
          episodeId: nextItemInQueue.episodeId || null,
          queueItems: this.playerQueueItems
        })
      }
    },
    setPlaying(isPlaying) {
      this.isPlaying = isPlaying
      this.$store.commit('setIsPlaying', isPlaying)
      this.updateMediaSessionPlaybackState()
    },
    setSleepTimer(time) {
      this.sleepTimerSet = true
      this.showSleepTimerModal = false

      this.sleepTimerType = time.timerType
      if (this.sleepTimerType === this.$constants.SleepTimerTypes.COUNTDOWN) {
        this.runSleepTimer(time)
      }
    },
    runSleepTimer(time) {
      this.sleepTimerRemaining = time.seconds

      var lastTick = Date.now()
      clearInterval(this.sleepTimer)
      this.sleepTimer = setInterval(() => {
        var elapsed = Date.now() - lastTick
        lastTick = Date.now()
        this.sleepTimerRemaining -= elapsed / 1000

        if (this.sleepTimerRemaining <= 0) {
          this.sleepTimerEnd()
        }
      }, 1000)
    },
    checkChapterEnd(time) {
      if (!this.currentChapter) return
      const chapterEndTime = this.currentChapter.end
      const tolerance = 0.75
      if (time >= chapterEndTime - tolerance) {
        this.sleepTimerEnd()
      }
    },
    sleepTimerEnd() {
      this.clearSleepTimer()
      this.playerHandler.pause()
      this.$toast.info(this.$strings.ToastSleepTimerDone)
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
      this.sleepTimerType = null
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
      this.currentPlaybackRate = playbackRate
      this.playerHandler.setPlaybackRate(playbackRate)
    },
    seek(time) {
      this.playerHandler.seek(time)
    },
    playbackTimeUpdate(time) {
      // When updating progress from another session
      this.playerHandler.seek(time, false)
    },
    setCurrentTime(time) {
      this.currentTime = time
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setCurrentTime(time)
      }

      if (this.sleepTimerType === this.$constants.SleepTimerTypes.CHAPTER && this.sleepTimerSet) {
        this.checkChapterEnd(time)
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
      this.bookmarkCurrentTime = this.currentTime
      this.showBookmarksModal = true
    },
    selectBookmark(bookmark) {
      this.seek(bookmark.time)
      this.showBookmarksModal = false
    },
    closePlayer() {
      this.playerHandler.closePlayer()
      this.$store.commit('setMediaPlaying', null)
    },
    mediaSessionPlay() {
      console.log('Media session play')
      this.playerHandler.play()
    },
    mediaSessionPause() {
      console.log('Media session pause')
      this.playerHandler.pause()
    },
    mediaSessionStop() {
      console.log('Media session stop')
      this.playerHandler.pause()
    },
    mediaSessionSeekBackward() {
      console.log('Media session seek backward')
      this.playerHandler.jumpBackward()
    },
    mediaSessionSeekForward() {
      console.log('Media session seek forward')
      this.playerHandler.jumpForward()
    },
    mediaSessionSeekTo(e) {
      console.log('Media session seek to', e)
      if (e.seekTime !== null && !isNaN(e.seekTime)) {
        this.playerHandler.seek(e.seekTime)
      }
    },
    mediaSessionPreviousTrack() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.prevChapter()
      }
    },
    mediaSessionNextTrack() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.nextChapter()
      }
    },
    updateMediaSessionPlaybackState() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused'
      }
    },
    setMediaSession() {
      if (!this.streamLibraryItem) {
        console.error('setMediaSession: No library item set')
        return
      }

      if ('mediaSession' in navigator) {
        var coverImageSrc = this.$store.getters['globals/getLibraryItemCoverSrc'](this.streamLibraryItem, '/Logo.png', true)
        const artwork = [
          {
            src: coverImageSrc
          }
        ]

        navigator.mediaSession.metadata = new MediaMetadata({
          title: this.title,
          artist: this.playerHandler.displayAuthor || this.mediaMetadata.authorName || 'Unknown',
          album: this.mediaMetadata.seriesName || '',
          artwork
        })
        console.log('Set media session metadata', navigator.mediaSession.metadata)

        navigator.mediaSession.setActionHandler('play', this.mediaSessionPlay)
        navigator.mediaSession.setActionHandler('pause', this.mediaSessionPause)
        navigator.mediaSession.setActionHandler('stop', this.mediaSessionStop)
        navigator.mediaSession.setActionHandler('seekbackward', this.mediaSessionSeekBackward)
        navigator.mediaSession.setActionHandler('seekforward', this.mediaSessionSeekForward)
        navigator.mediaSession.setActionHandler('seekto', this.mediaSessionSeekTo)
        navigator.mediaSession.setActionHandler('previoustrack', this.mediaSessionSeekBackward)
        navigator.mediaSession.setActionHandler('nexttrack', this.mediaSessionSeekForward)
      } else {
        console.warn('Media session not available')
      }
    },
    streamProgress(data) {
      if (this.playerHandler.isPlayingLocalItem && this.playerHandler.currentStreamId === data.stream) {
        if (!data.numSegments) return
        var chunks = data.chunks
        console.log(`[MediaPlayerContainer] Stream Progress ${data.percent}`)
        if (this.$refs.audioPlayer) {
          this.$refs.audioPlayer.setChunksReady(chunks, data.numSegments)
        } else {
          console.error('No Audio Ref')
        }
      }
    },
    sessionOpen(session) {
      // For opening session on init (temporarily unused)
      this.$store.commit('setMediaPlaying', {
        libraryItem: session.libraryItem,
        episodeId: session.episodeId
      })
      this.playerHandler.prepareOpenSession(session, this.currentPlaybackRate)
    },
    streamOpen(session) {
      console.log(`[MediaPlayerContainer] Stream session open`, session)
    },
    streamClosed(streamId) {
      // Stream was closed from the server
      if (this.playerHandler.isPlayingLocalItem && this.playerHandler.currentStreamId === streamId) {
        console.warn('[MediaPlayerContainer] Closing stream due to request from server')
        this.playerHandler.closePlayer()
      }
    },
    streamReady() {
      console.log(`[MediaPlayerContainer] Stream Ready`)
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setStreamReady()
      } else {
        console.error('No Audio Ref')
      }
    },
    streamError(streamId) {
      // Stream had critical error from the server
      if (this.playerHandler.isPlayingLocalItem && this.playerHandler.currentStreamId === streamId) {
        console.warn('[MediaPlayerContainer] Closing stream due to stream error from server')
        this.playerHandler.closePlayer()
      }
    },
    streamReset({ startTime, streamId }) {
      this.playerHandler.resetStream(startTime, streamId)
    },
    castSessionActive(isActive) {
      if (isActive && this.playerHandler.isPlayingLocalItem) {
        // Cast session started switch to cast player
        this.playerHandler.switchPlayer()
      } else if (!isActive && this.playerHandler.isPlayingCastedItem) {
        // Cast session ended switch to local player
        this.playerHandler.switchPlayer()
      }
    },
    playNextItemInQueue() {
      if (this.hasNextItemInQueue) {
        this.playQueueItem({ index: this.currentPlayerQueueIndex + 1 })
      }
    },
    /**
     * @param {{ index: number }} payload
     */
    playQueueItem(payload) {
      if (payload?.index === undefined) {
        console.error('playQueueItem: No index provided')
        return
      }
      if (!this.playerQueueItems[payload.index]) {
        console.error('playQueueItem: No item found at index', payload.index)
        return
      }
      const item = this.playerQueueItems[payload.index]
      this.playLibraryItem({
        libraryItemId: item.libraryItemId,
        episodeId: item.episodeId || null,
        queueItems: this.playerQueueItems
      })
    },
    async playLibraryItem(payload) {
      const libraryItemId = payload.libraryItemId
      const episodeId = payload.episodeId || null

      if (this.playerHandler.libraryItemId == libraryItemId && this.playerHandler.episodeId == episodeId) {
        if (payload.startTime !== null && !isNaN(payload.startTime)) {
          this.seek(payload.startTime)
        } else {
          this.playerHandler.play()
        }
        return
      }

      const libraryItem = await this.$axios.$get(`/api/items/${libraryItemId}?expanded=1`).catch((error) => {
        console.error('Failed to fetch full item', error)
        return null
      })
      if (!libraryItem) return

      this.$store.commit('setMediaPlaying', {
        libraryItem,
        episodeId,
        queueItems: payload.queueItems || []
      })
      // Set cover aspect ratio for this item's library since the library may change
      this.coverAspectRatio = this.$store.getters['libraries/getBookCoverAspectRatio']

      this.$nextTick(() => {
        if (this.$refs.audioPlayer) this.$refs.audioPlayer.checkUpdateChapterTrack()
      })

      this.playerHandler.load(libraryItem, episodeId, true, this.currentPlaybackRate, payload.startTime)
    },
    pauseItem() {
      this.playerHandler.pause()
    },
    showFailedProgressSyncs() {
      if (!isNaN(this.syncFailedToast)) this.$toast.dismiss(this.syncFailedToast)
      this.syncFailedToast = this.$toast(this.$strings.ToastProgressIsNotBeingSynced, { timeout: false, type: 'error' })
    },
    sessionClosedEvent(sessionId) {
      if (this.playerHandler.currentSessionId === sessionId) {
        console.log('sessionClosedEvent closing current session', sessionId)
        this.playerHandler.resetPlayer() // Closes player without reporting to server
        this.$store.commit('setMediaPlaying', null)
      }
    }
  },
  mounted() {
    this.$eventBus.$on('cast-session-active', this.castSessionActive)
    this.$eventBus.$on('playback-seek', this.seek)
    this.$eventBus.$on('playback-time-update', this.playbackTimeUpdate)
    this.$eventBus.$on('play-queue-item', this.playQueueItem)
    this.$eventBus.$on('play-item', this.playLibraryItem)
    this.$eventBus.$on('pause-item', this.pauseItem)
  },
  beforeDestroy() {
    this.$eventBus.$off('cast-session-active', this.castSessionActive)
    this.$eventBus.$off('playback-seek', this.seek)
    this.$eventBus.$off('playback-time-update', this.playbackTimeUpdate)
    this.$eventBus.$off('play-queue-item', this.playQueueItem)
    this.$eventBus.$off('play-item', this.playLibraryItem)
    this.$eventBus.$off('pause-item', this.pauseItem)
  }
}
</script>

<style>
#mediaPlayerContainer {
  box-shadow: 0px -6px 8px #1111113f;
}
</style>
