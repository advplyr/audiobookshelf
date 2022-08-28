<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full h-full overflow-y-auto px-2 py-6 md:p-8">
      <div class="flex flex-col md:flex-row max-w-6xl mx-auto">
        <div class="w-full flex justify-center md:block md:w-52" style="min-width: 208px">
          <div class="relative" style="height: fit-content">
            <covers-book-cover :library-item="libraryItem" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />

            <!-- Item Progress Bar -->
            <div v-if="!isPodcast" class="absolute bottom-0 left-0 h-1.5 shadow-sm z-10" :class="userIsFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: 208 * progressPercent + 'px' }"></div>

            <!-- Item Cover Overlay -->
            <div class="absolute top-0 left-0 w-full h-full z-10 bg-black bg-opacity-30 opacity-0 hover:opacity-100 transition-opacity" @mousedown.prevent @mouseup.prevent>
              <div v-show="showPlayButton && !isStreaming" class="h-full flex items-center justify-center pointer-events-none">
                <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto cursor-pointer" @click.stop.prevent="playItem">
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
              <h1 class="text-2xl md:text-3xl font-semibold">
                {{ title }}
              </h1>

              <p v-if="bookSubtitle" class="text-gray-200 text-xl md:text-2xl">{{ bookSubtitle }}</p>

              <nuxt-link v-for="_series in seriesList" :key="_series.id" :to="`/library/${libraryId}/series/${_series.id}`" class="hover:underline font-sans text-gray-300 text-lg leading-7"> {{ _series.text }}</nuxt-link>

              <template v-if="!isVideo">
                <p v-if="isPodcast" class="mb-2 mt-0.5 text-gray-200 text-lg md:text-xl">by {{ podcastAuthor || 'Unknown' }}</p>
                <p v-else-if="authors.length" class="mb-2 mt-0.5 text-gray-200 text-lg md:text-xl">
                  by <nuxt-link v-for="(author, index) in authors" :key="index" :to="`/author/${author.id}`" class="hover:underline">{{ author.name }}<span v-if="index < authors.length - 1">,&nbsp;</span></nuxt-link>
                </p>
                <p v-else class="mb-2 mt-0.5 text-gray-200 text-xl">by Unknown</p>
              </template>

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
            <p v-if="userIsAdminOrUp" class="ml-4">Book has no audio tracks but has an ebook. The experimental e-reader can be enabled in config.</p>
            <p v-else class="ml-4">Book has no audio tracks but has an ebook. The experimental e-reader must be enabled by a server admin.</p>
          </div>

          <!-- Podcast episode downloads queue -->
          <div v-if="episodeDownloadsQueued.length" class="px-4 py-2 mt-4 bg-info bg-opacity-40 text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0">
            <div class="flex items-center">
              <p class="text-sm py-1">{{ episodeDownloadsQueued.length }} Episode{{ episodeDownloadsQueued.length === 1 ? '' : 's' }} queued for download</p>

              <span v-if="userIsAdminOrUp" class="material-icons hover:text-error text-xl ml-3 cursor-pointer" @click="clearDownloadQueue">close</span>
            </div>
          </div>

          <!-- Podcast episodes currently downloading -->
          <div v-if="episodesDownloading.length" class="px-4 py-2 mt-4 bg-success bg-opacity-20 text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0">
            <div v-for="episode in episodesDownloading" :key="episode.id" class="flex items-center">
              <widgets-loading-spinner />
              <p class="text-sm py-1 pl-4">Downloading episode "{{ episode.episodeDisplayTitle }}"</p>
            </div>
          </div>

          <!-- Progress -->
          <div v-if="!isPodcast && progressPercent > 0" class="px-4 py-2 mt-4 bg-primary text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0" :class="resettingProgress ? 'opacity-25' : ''">
            <p v-if="progressPercent < 1" class="leading-6">Your Progress: {{ Math.round(progressPercent * 100) }}%</p>
            <p v-else class="text-xs">Finished {{ $formatDate(userProgressFinishedAt, dateFormat) }}</p>
            <p v-if="progressPercent < 1" class="text-gray-200 text-xs">{{ $elapsedPretty(userTimeRemaining) }} remaining</p>
            <p class="text-gray-400 text-xs pt-1">Started {{ $formatDate(userProgressStartedAt, dateFormat) }}</p>

            <div v-if="!resettingProgress" class="absolute -top-1.5 -right-1.5 p-1 w-5 h-5 rounded-full bg-bg hover:bg-error border border-primary flex items-center justify-center cursor-pointer" @click.stop="clearProgressClick">
              <span class="material-icons text-sm">close</span>
            </div>
          </div>

          <!-- Icon buttons -->
          <div class="flex items-center justify-center md:justify-start pt-4">
            <ui-btn v-if="showPlayButton" :disabled="isStreaming" color="success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="playItem">
              <span v-show="!isStreaming" class="material-icons -ml-2 pr-1 text-white">play_arrow</span>
              {{ isStreaming ? 'Playing' : 'Play' }}
            </ui-btn>
            <ui-btn v-else-if="isMissing || isInvalid" color="error" :padding-x="4" small class="flex items-center h-9 mr-2">
              <span v-show="!isStreaming" class="material-icons -ml-2 pr-1 text-white">error</span>
              {{ isMissing ? 'Missing' : 'Incomplete' }}
            </ui-btn>

            <ui-btn v-if="showReadButton" color="info" :padding-x="4" small class="flex items-center h-9 mr-2" @click="openEbook">
              <span class="material-icons -ml-2 pr-2 text-white">auto_stories</span>
              Read
            </ui-btn>

            <ui-tooltip v-if="userCanUpdate" text="Edit" direction="top">
              <ui-icon-btn icon="edit" class="mx-0.5" @click="editClick" />
            </ui-tooltip>

            <ui-tooltip v-if="!isPodcast" :text="userIsFinished ? 'Mark as Not Finished' : 'Mark as Finished'" direction="top">
              <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" class="mx-0.5" @click="toggleFinished" />
            </ui-tooltip>

            <ui-tooltip v-if="!isPodcast" text="Collections" direction="top">
              <ui-icon-btn icon="collections_bookmark" class="mx-0.5" outlined @click="collectionsClick" />
            </ui-tooltip>

            <!-- Only admin or root user can download new episodes -->
            <ui-tooltip v-if="isPodcast && userIsAdminOrUp" text="Find Episodes" direction="top">
              <ui-icon-btn icon="search" class="mx-0.5" :loading="fetchingRSSFeed" outlined @click="findEpisodesClick" />
            </ui-tooltip>

            <ui-tooltip v-if="bookmarks.length" text="Your Bookmarks" direction="top">
              <ui-icon-btn :icon="bookmarks.length ? 'bookmarks' : 'bookmark_border'" class="mx-0.5" @click="clickBookmarksBtn" />
            </ui-tooltip>

            <!-- RSS feed -->
            <ui-tooltip v-if="showRssFeedBtn" text="Open RSS Feed" direction="top">
              <ui-icon-btn icon="rss_feed" class="mx-0.5" :bg-color="rssFeedUrl ? 'success' : 'primary'" outlined @click="clickRSSFeed" />
            </ui-tooltip>
          </div>

          <div class="my-4 max-w-2xl">
            <p class="text-base text-gray-100 whitespace-pre-line">{{ description }}</p>
          </div>

          <div v-if="invalidAudioFiles.length" class="bg-error border-red-800 shadow-md p-4">
            <p class="text-sm mb-2">Invalid audio files</p>

            <p v-for="audioFile in invalidAudioFiles" :key="audioFile.id" class="text-xs pl-2">- {{ audioFile.metadata.filename }} ({{ audioFile.error }})</p>
          </div>

          <widgets-audiobook-data v-if="tracks.length" :library-item-id="libraryItemId" :is-file="isFile" :media="media" />

          <tables-podcast-episodes-table v-if="isPodcast" :library-item="libraryItem" />

          <tables-chapters-table v-if="chapters.length" :library-item="libraryItem" class="mt-6" />

          <tables-library-files-table v-if="libraryFiles.length" :is-missing="isMissing" :library-item-id="libraryItemId" :files="libraryFiles" class="mt-6" />
        </div>
      </div>
    </div>

    <modals-podcast-episode-feed v-model="showPodcastEpisodeFeed" :library-item="libraryItem" :episodes="podcastFeedEpisodes" />
    <modals-rssfeed-view-modal v-model="showRssFeedModal" :library-item="libraryItem" :feed-url="rssFeedUrl" />
    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :library-item-id="libraryItemId" hide-create @select="selectBookmark" />
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }

    // Include episode downloads for podcasts
    var item = await app.$axios.$get(`/api/items/${params.id}?expanded=1&include=authors,downloads,rssfeed`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!item) {
      console.error('No item...', params.id)
      return redirect('/')
    }
    return {
      libraryItem: item,
      rssFeedUrl: item.rssFeedUrl || null
    }
  },
  data() {
    return {
      resettingProgress: false,
      isProcessingReadUpdate: false,
      fetchingRSSFeed: false,
      showPodcastEpisodeFeed: false,
      podcastFeedEpisodes: [],
      episodesDownloading: [],
      episodeDownloadsQueued: [],
      showRssFeedModal: false,
      showBookmarksModal: false
    }
  },
  computed: {
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    enableEReader() {
      return this.$store.getters['getServerSetting']('enableEReader')
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    isFile() {
      return this.libraryItem.isFile
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    bookCoverWidth() {
      return 208
    },
    isDeveloperMode() {
      return this.$store.state.developerMode
    },
    isPodcast() {
      return this.libraryItem.mediaType === 'podcast'
    },
    isVideo() {
      return this.libraryItem.mediaType === 'video'
    },
    isMissing() {
      return this.libraryItem.isMissing
    },
    isInvalid() {
      return this.libraryItem.isInvalid
    },
    invalidAudioFiles() {
      if (this.isPodcast || this.isVideo) return []
      return this.libraryItem.media.audioFiles.filter((af) => af.invalid)
    },
    showPlayButton() {
      if (this.isMissing || this.isInvalid) return false
      if (this.isVideo) return !!this.videoFile
      if (this.isPodcast) return this.podcastEpisodes.length
      return this.tracks.length
    },
    showReadButton() {
      return this.ebookFile && (this.showExperimentalFeatures || this.enableEReader)
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
    chapters() {
      return this.media.chapters || []
    },
    bookmarks() {
      if (this.isPodcast) return []
      return this.$store.getters['user/getUserBookmarksForItem'](this.libraryItemId)
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
    narrators() {
      return this.mediaMetadata.narrators || []
    },
    series() {
      return this.mediaMetadata.series || []
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
    ebookFile() {
      return this.media.ebookFile
    },
    videoFile() {
      return this.media.videoFile
    },
    showExperimentalReadAlert() {
      return !this.tracks.length && this.ebookFile && !this.showExperimentalFeatures && !this.enableEReader
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
    isStreaming() {
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
    },
    showRssFeedBtn() {
      if (!this.rssFeedUrl && !this.podcastEpisodes.length && !this.tracks.length) return false // Cannot open RSS feed with no episodes/tracks

      // If rss feed is open then show feed url to users otherwise just show to admins
      return this.userIsAdminOrUp || this.rssFeedUrl
    }
  },
  methods: {
    clickBookmarksBtn() {
      this.showBookmarksModal = true
    },
    selectBookmark(bookmark) {
      if (!bookmark) return
      if (this.isStreaming) {
        this.$eventBus.$emit('playback-seek', bookmark.time)
      } else if (this.streamLibraryItem) {
        this.showBookmarksModal = false
        console.log('Already streaming library item so ask about it')
        const payload = {
          message: `Start playback for "${this.title}" at ${this.$secondsToTimestamp(bookmark.time)}?`,
          callback: (confirmed) => {
            if (confirmed) {
              this.playItem(bookmark.time)
            }
          },
          type: 'yesNo'
        }
        this.$store.commit('globals/setConfirmPrompt', payload)
      } else {
        this.playItem(bookmark.time)
      }
      this.showBookmarksModal = false
    },
    clearDownloadQueue() {
      if (confirm('Are you sure you want to clear episode download queue?')) {
        this.$axios
          .$get(`/api/podcasts/${this.libraryItemId}/clear-queue`)
          .then(() => {
            this.$toast.success('Episode download queue cleared')
            this.episodeDownloadQueued = []
          })
          .catch((error) => {
            console.error('Failed to clear queue', error)
            this.$toast.error('Failed to clear queue')
          })
      }
    },
    async findEpisodesClick() {
      if (!this.mediaMetadata.feedUrl) {
        return this.$toast.error('Podcast does not have an RSS Feed')
      }
      this.fetchingRSSFeed = true
      var payload = await this.$axios.$post(`/api/podcasts/feed`, { rssFeed: this.mediaMetadata.feedUrl }).catch((error) => {
        console.error('Failed to get feed', error)
        this.$toast.error('Failed to get podcast feed')
        return null
      })
      this.fetchingRSSFeed = false
      if (!payload) return

      console.log('Podcast feed', payload)
      const podcastfeed = payload.podcast
      if (!podcastfeed.episodes || !podcastfeed.episodes.length) {
        this.$toast.info('No episodes found in RSS feed')
        return
      }

      this.podcastFeedEpisodes = podcastfeed.episodes
      this.showPodcastEpisodeFeed = true
    },
    showEditCover() {
      this.$store.commit('setBookshelfBookIds', [])
      this.$store.commit('showEditModalOnTab', { libraryItem: this.libraryItem, tab: 'cover' })
    },
    openEbook() {
      this.$store.commit('showEReader', this.libraryItem)
    },
    toggleFinished(confirmed = false) {
      if (!this.userIsFinished && this.progressPercent > 0 && !confirmed) {
        const payload = {
          message: `Are you sure you want to mark "${this.title}" as finished?`,
          callback: (confirmed) => {
            if (confirmed) {
              this.toggleFinished(true)
            }
          },
          type: 'yesNo'
        }
        this.$store.commit('globals/setConfirmPrompt', payload)
        return
      }

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
    playItem(startTime = null) {
      var episodeId = null
      const queueItems = []
      if (this.isPodcast) {
        var episodeIndex = this.podcastEpisodes.findIndex((ep) => {
          var podcastProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItemId, ep.id)
          return !podcastProgress || !podcastProgress.isFinished
        })
        if (episodeIndex < 0) episodeIndex = 0

        episodeId = this.podcastEpisodes[episodeIndex].id

        for (let i = episodeIndex; i < this.podcastEpisodes.length; i++) {
          const episode = this.podcastEpisodes[i]
          const audioFile = episode.audioFile
          queueItems.push({
            libraryItemId: this.libraryItemId,
            episodeId: episode.id,
            title: episode.title,
            subtitle: this.title,
            duration: audioFile.duration || null,
            coverPath: this.libraryItem.media.coverPath || null
          })
        }
      }

      this.$eventBus.$emit('play-item', {
        libraryItemId: this.libraryItem.id,
        episodeId,
        startTime,
        queueItems
      })
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
    collectionsClick() {
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setShowUserCollectionsModal', true)
    },
    clickRSSFeed() {
      this.showRssFeedModal = true
    },
    episodeDownloadQueued(episodeDownload) {
      if (episodeDownload.libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued.push(episodeDownload)
      }
    },
    episodeDownloadStarted(episodeDownload) {
      if (episodeDownload.libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading.push(episodeDownload)
      }
    },
    episodeDownloadFinished(episodeDownload) {
      if (episodeDownload.libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading = this.episodesDownloading.filter((d) => d.id !== episodeDownload.id)
      }
    },
    rssFeedOpen(data) {
      if (data.entityId === this.libraryItemId) {
        console.log('RSS Feed Opened', data)
        this.rssFeedUrl = data.feedUrl
      }
    },
    rssFeedClosed(data) {
      if (data.entityId === this.libraryItemId) {
        console.log('RSS Feed Closed', data)
        this.rssFeedUrl = null
      }
    }
  },
  mounted() {
    if (this.libraryItem.episodesDownloading) {
      this.episodeDownloadsQueued = this.libraryItem.episodesDownloading || []
    }

    // use this items library id as the current
    if (this.libraryId) {
      this.$store.commit('libraries/setCurrentLibrary', this.libraryId)
    }
    this.$root.socket.on('item_updated', this.libraryItemUpdated)
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
    this.$root.socket.on('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.on('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.on('episode_download_finished', this.episodeDownloadFinished)
  },
  beforeDestroy() {
    this.$root.socket.off('item_updated', this.libraryItemUpdated)
    this.$root.socket.off('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.off('rss_feed_closed', this.rssFeedClosed)
    this.$root.socket.off('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.off('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.off('episode_download_finished', this.episodeDownloadFinished)
  }
}
</script>
