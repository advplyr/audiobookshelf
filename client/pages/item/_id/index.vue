<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamLibraryItem ? 'streaming' : ''">
    <div id="item-page-wrapper" class="w-full h-full overflow-y-auto px-2 py-6 lg:p-8">
      <div class="flex flex-col lg:flex-row max-w-6xl mx-auto">
        <div class="w-full flex justify-center lg:block lg:w-52" style="min-width: 208px">
          <div class="relative group" style="height: fit-content">
            <covers-book-cover class="relative group-hover:brightness-75 transition cursor-pointer" expand-on-click :library-item="libraryItem" :width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />

            <!-- Item Progress Bar -->
            <div v-if="!isPodcast" class="absolute bottom-0 left-0 h-1.5 shadow-xs z-10" :class="userIsFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: 208 * progressPercent + 'px' }"></div>

            <!-- Item Cover Overlay -->
            <div class="absolute top-0 left-0 w-full h-full z-10 opacity-0 group-hover:opacity-100 pointer-events-none">
              <div v-show="showPlayButton && !isStreaming" class="h-full flex items-center justify-center pointer-events-none">
                <button class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto cursor-pointer" :aria-label="$strings.ButtonPlay" @click.stop.prevent="playItem">
                  <span class="material-symbols fill text-4xl">play_arrow</span>
                </button>
              </div>

              <button class="absolute bottom-2.5 right-2.5 z-10 material-symbols text-lg cursor-pointer text-white/75 hover:text-white/100 hover:scale-110 transform duration-200 pointer-events-auto" :aria-label="$strings.ButtonEdit" @click="showEditCover">edit</button>
            </div>
          </div>
        </div>
        <div class="grow px-2 py-6 lg:py-0 md:px-10">
          <div class="flex justify-center">
            <div class="mb-4">
              <h1 class="text-2xl md:text-3xl font-semibold">
                <div class="flex items-center">
                  {{ title }}
                  <widgets-explicit-indicator v-if="isExplicit" />
                  <widgets-abridged-indicator v-if="isAbridged" />
                </div>
              </h1>

              <p v-if="bookSubtitle" class="text-gray-200 text-xl md:text-2xl">{{ bookSubtitle }}</p>

              <template v-for="(_series, index) in seriesList">
                <nuxt-link :key="_series.id" :to="`/library/${libraryId}/series/${_series.id}`" class="hover:underline font-sans text-gray-300 text-lg leading-7">{{ _series.text }}</nuxt-link
                ><span :key="index" v-if="index < seriesList.length - 1">, </span>
              </template>

              <p v-if="isPodcast" class="mb-2 mt-0.5 text-gray-200 text-lg md:text-xl">{{ $getString('LabelByAuthor', [podcastAuthor]) }}</p>
              <p v-else-if="authors.length" class="mb-2 mt-0.5 text-gray-200 text-lg md:text-xl max-w-[calc(100vw-2rem)] overflow-hidden text-ellipsis">
                {{ $getString('LabelByAuthor', ['']) }}<nuxt-link v-for="(author, index) in authors" :key="index" :to="`/author/${author.id}`" class="hover:underline">{{ author.name }}<span v-if="index < authors.length - 1">,&nbsp;</span></nuxt-link>
              </p>
              <p v-else class="mb-2 mt-0.5 text-gray-200 text-xl">by Unknown</p>

              <content-library-item-details :library-item="libraryItem" />
            </div>
            <div class="hidden md:block grow" />
          </div>

          <!-- Podcast episode downloads queue -->
          <div v-if="episodeDownloadsQueued.length" class="px-4 py-2 mt-4 bg-info/40 text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0">
            <div class="flex items-center">
              <p class="text-sm py-1">{{ $getString('MessageEpisodesQueuedForDownload', [episodeDownloadsQueued.length]) }}</p>

              <span v-if="userIsAdminOrUp" class="material-symbols hover:text-error text-xl ml-3 cursor-pointer" @click="clearDownloadQueue">close</span>
            </div>
          </div>

          <!-- Podcast episodes currently downloading -->
          <div v-if="episodesDownloading.length" class="px-4 py-2 mt-4 bg-success/20 text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0">
            <div v-for="episode in episodesDownloading" :key="episode.id" class="flex items-center">
              <widgets-loading-spinner />
              <p class="text-sm py-1 pl-4">{{ $strings.MessageDownloadingEpisode }} "{{ episode.episodeDisplayTitle }}"</p>
            </div>
          </div>

          <!-- Progress -->
          <div v-if="!isPodcast && progressPercent > 0" class="px-4 py-2 mt-4 bg-primary text-sm font-semibold rounded-md text-gray-100 relative max-w-max mx-auto md:mx-0" :class="resettingProgress ? 'opacity-25' : ''">
            <p v-if="progressPercent < 1" class="leading-6">{{ $strings.LabelYourProgress }}: {{ Math.round(progressPercent * 100) }}%</p>
            <p v-else class="text-xs">{{ $strings.LabelFinished }} {{ $formatDate(userProgressFinishedAt, dateFormat) }}</p>
            <p v-if="progressPercent < 1 && !useEBookProgress" class="text-gray-200 text-xs">{{ $getString('LabelTimeRemaining', [$elapsedPretty(userTimeRemaining)]) }}</p>
            <p class="text-gray-400 text-xs pt-1">{{ $strings.LabelStarted }} {{ $formatDate(userProgressStartedAt, dateFormat) }}</p>

            <div v-if="!resettingProgress" class="absolute -top-1.5 -right-1.5 p-1 w-5 h-5 rounded-full bg-bg hover:bg-error border border-primary flex items-center justify-center cursor-pointer" @click.stop="clearProgressClick">
              <span class="material-symbols text-sm">&#xe5cd;</span>
            </div>
          </div>

          <!-- Icon buttons -->
          <div class="flex items-center justify-center md:justify-start pt-4">
            <ui-btn v-if="showPlayButton" :disabled="isStreaming" color="bg-success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="playItem">
              <span v-show="!isStreaming" class="material-symbols fill text-2xl -ml-2 pr-1 text-white">&#xe037;</span>
              {{ isStreaming ? $strings.ButtonPlaying : $strings.ButtonPlay }}
            </ui-btn>

            <ui-btn v-else-if="isMissing || isInvalid" color="bg-error" :padding-x="4" small class="flex items-center h-9 mr-2">
              <span class="material-symbols text-2xl -ml-2 pr-1 text-white">error</span>
              {{ isMissing ? $strings.LabelMissing : $strings.LabelIncomplete }}
            </ui-btn>

            <ui-btn v-if="showReadButton" color="bg-info" :padding-x="4" small class="flex items-center h-9 mr-2" @click="openEbook">
              <span class="material-symbols text-2xl -ml-2 pr-2 text-white" aria-hidden="true">auto_stories</span>
              {{ $strings.ButtonRead }}
            </ui-btn>

            <ui-tooltip v-if="showQueueBtn" :text="isQueued ? $strings.ButtonQueueRemoveItem : $strings.ButtonQueueAddItem" direction="top">
              <ui-icon-btn :icon="isQueued ? 'playlist_add_check' : 'playlist_play'" :bg-color="isQueued ? 'bg-primary' : 'bg-success/60'" class="mx-0.5" :class="isQueued ? 'text-success' : ''" @click="queueBtnClick" />
            </ui-tooltip>

            <ui-tooltip v-if="userCanUpdate" :text="$strings.LabelEdit" direction="top">
              <ui-icon-btn icon="&#xe3c9;" outlined class="mx-0.5" :aria-label="$strings.LabelEdit" @click="editClick" />
            </ui-tooltip>

            <ui-tooltip v-if="!isPodcast" :text="userIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="top">
              <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" class="mx-0.5" @click="toggleFinished" />
            </ui-tooltip>

            <!-- Only admin or root user can download new episodes -->
            <ui-tooltip v-if="isPodcast && userIsAdminOrUp" :text="$strings.LabelFindEpisodes" direction="top">
              <ui-icon-btn icon="search" class="mx-0.5" :aria-label="$strings.LabelFindEpisodes" :loading="fetchingRSSFeed" outlined @click="findEpisodesClick" />
            </ui-tooltip>

            <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="148" @action="contextMenuAction">
              <template #default="{ showMenu, clickShowMenu, disabled }">
                <button type="button" :disabled="disabled" class="mx-0.5 icon-btn bg-primary border border-gray-600 w-9 h-9 rounded-md flex items-center justify-center relative" aria-haspopup="listbox" :aria-expanded="showMenu" :aria-label="$strings.LabelMore" @click.stop.prevent="clickShowMenu">
                  <span class="material-symbols text-2xl">&#xe5d3;</span>
                </button>
              </template>
            </ui-context-menu-dropdown>
          </div>

          <div class="my-4 w-full">
            <div ref="description" id="item-description" dir="auto" role="paragraph" class="default-style less-spacing text-base text-gray-100 whitespace-pre-line mb-1" :class="{ 'show-full': showFullDescription }" v-html="description" />

            <button v-if="isDescriptionClamped" class="py-0.5 flex items-center text-slate-300 hover:text-white" @click="showFullDescription = !showFullDescription">{{ showFullDescription ? $strings.ButtonReadLess : $strings.ButtonReadMore }} <span class="material-symbols text-xl pl-1" v-html="showFullDescription ? 'expand_less' : '&#xe313;'" /></button>
          </div>

          <tables-chapters-table v-if="chapters.length" :library-item="libraryItem" class="mt-6" />

          <tables-tracks-table v-if="tracks.length" :title="$strings.LabelStatsAudioTracks" :tracks="tracksWithAudioFile" :is-file="isFile" :library-item-id="libraryItemId" class="mt-6" />

          <tables-podcast-lazy-episodes-table ref="episodesTable" v-if="isPodcast" :library-item="libraryItem" />

          <tables-ebook-files-table v-if="ebookFiles.length" :library-item="libraryItem" class="mt-6" />

          <tables-library-files-table v-if="libraryFiles.length" :library-item="libraryItem" class="mt-6" />
        </div>
      </div>

      <!-- Comments section -->
      <div class="max-w-6xl mx-auto">
        <div class="flex flex-col lg:flex-row">
          <div class="w-full lg:w-52" style="min-width: 208px">
            <!-- Spacer div to match the layout above -->
          </div>
          <div class="grow px-2 md:px-10">
            <div class="mt-12">
              <div class="comments-section mt-4 border-t border-gray-700 pt-4">
                <h3 class="text-xl font-semibold mb-4">{{ $strings.LabelComments }}</h3>

                <!-- Average Rating Display -->
                <div v-if="comments.length" class="mb-4">
                  <p class="text-lg">
                    {{ $strings.LabelAverageRating.replace('{0}', averageRating.toFixed(1)) }}
                    <span class="inline-flex ml-2">
                      <i v-for="i in 5" :key="i" class="fas fa-star" :class="i <= Math.round(averageRating) ? 'text-yellow-500' : 'text-gray-500'"></i>
                    </span>
                  </p>
                </div>

                <!-- Add Comment Form -->
                <div class="mb-6">
                  <div class="bg-bg border border-gray-700 rounded-lg p-4">
                    <textarea v-model="newComment" :placeholder="$strings.PlaceholderAddComment" class="w-full p-2 bg-transparent border border-gray-600 rounded resize-none focus:outline-none mb-3" rows="3"></textarea>

                    <!-- Star Rating Input -->
                    <div class="flex items-center mb-3">
                      <span class="mr-2">{{ $strings.LabelRating }}:</span>
                      <div class="flex">
                        <button v-for="star in 5" :key="star" class="text-2xl focus:outline-none" :class="star <= (hoverRating || newRating) ? 'text-yellow-500' : 'text-gray-500'" @click="newRating = star" @mouseover="hoverRating = star" @mouseleave="hoverRating = 0">
                          <span class="abs-icons icon-star"></span>
                        </button>
                      </div>
                      <button v-if="newRating" class="ml-2 text-sm text-gray-400 hover:text-white" @click="newRating = 0">({{ $strings.ButtonClear }})</button>
                    </div>

                    <div class="flex justify-end">
                      <button class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-75" @click="postComment">
                        {{ $strings.ButtonPost }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Comments List -->
                <div v-if="comments.length" class="space-y-4">
                  <div v-for="comment in comments" :key="comment.id" class="bg-bg border border-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                      <div>
                        <span class="font-semibold">{{ comment.user.username }}</span>
                        <span class="text-sm text-gray-400 ml-2">
                          {{ formatDate(comment.createdAt) }}
                        </span>
                      </div>
                      <div class="flex items-center">
                        <!-- Star Rating Display -->
                        <div v-if="comment.rating" class="flex mr-4">
                          <span v-for="star in 5" :key="star" class="abs-icons icon-star" :class="star <= comment.rating ? 'text-yellow-500' : 'text-gray-500'"></span>
                        </div>

                        <div v-if="canEditComment(comment)" class="space-x-2">
                          <button v-if="editingCommentId !== comment.id" class="text-gray-400 hover:text-white" @click="startEditing(comment)">
                            {{ $strings.ButtonEdit }}
                          </button>
                          <button class="text-gray-400 hover:text-white" @click="deleteComment(comment)">
                            {{ $strings.ButtonDelete }}
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Edit Comment Form -->
                    <div v-if="editingCommentId === comment.id">
                      <textarea v-model="editCommentText" class="w-full p-2 bg-gray-800 rounded mb-2 resize-none focus:outline-none" rows="3"></textarea>

                      <!-- Edit Rating -->
                      <div class="flex items-center mb-2">
                        <span class="mr-2">{{ $strings.LabelRating }}:</span>
                        <div class="flex">
                          <button v-for="star in 5" :key="star" class="text-2xl focus:outline-none" :class="star <= editRating ? 'text-yellow-500' : 'text-gray-500'" @click="editRating = star">
                            <span class="abs-icons icon-star"></span>
                          </button>
                        </div>
                        <button v-if="editRating" class="ml-2 text-sm text-gray-400 hover:text-white" @click="editRating = 0">({{ $strings.ButtonClear }})</button>
                      </div>

                      <div class="flex space-x-2">
                        <button class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-75" @click="saveEdit(comment)">
                          {{ $strings.ButtonSave }}
                        </button>
                        <button class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-opacity-75" @click="cancelEdit">
                          {{ $strings.ButtonCancel }}
                        </button>
                      </div>
                    </div>

                    <!-- Comment Text Display -->
                    <div v-else class="text-gray-300">
                      {{ comment.text }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-gray-400">
                  {{ $strings.MessageNoComments }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <modals-podcast-episode-feed v-model="showPodcastEpisodeFeed" :library-item="libraryItem" :episodes="podcastFeedEpisodes" :download-queue="episodeDownloadsQueued" :episodes-downloading="episodesDownloading" />
    <modals-bookmarks-modal v-model="showBookmarksModal" :bookmarks="bookmarks" :playback-rate="1" :library-item-id="libraryItemId" hide-create @select="selectBookmark" />
  </div>
</template>

<script>
export default {
  components: {
    // Remove unused comments component registration
  },
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }

    // Include episode downloads for podcasts
    var item = await app.$axios.$get(`/api/items/${params.id}?expanded=1&include=downloads,rssfeed,share`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!item) {
      console.error('No item...', params.id)
      return redirect('/')
    }
    if (store.state.libraries.currentLibraryId !== item.libraryId || !store.state.libraries.filterData) {
      await store.dispatch('libraries/fetch', item.libraryId)
    }
    return {
      libraryItem: item,
      rssFeed: item.rssFeed || null,
      mediaItemShare: item.mediaItemShare || null
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
      showBookmarksModal: false,
      isDescriptionClamped: false,
      showFullDescription: false,
      newComment: '',
      newRating: 0,
      hoverRating: 0,
      editingCommentId: null,
      editCommentText: '',
      editRating: 0,
      comments: []
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    downloadUrl() {
      return `${process.env.serverUrl}/api/items/${this.libraryItemId}/download?token=${this.userToken}`
    },
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
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
    isFile() {
      return this.libraryItem.isFile
    },
    isBook() {
      return this.libraryItem.mediaType === 'book'
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
    isExplicit() {
      return !!this.mediaMetadata.explicit
    },
    isAbridged() {
      return !!this.mediaMetadata.abridged
    },
    showPlayButton() {
      if (this.isMissing || this.isInvalid) return false
      if (this.isPodcast) return this.podcastEpisodes.length
      return this.tracks.length
    },
    showReadButton() {
      return this.ebookFile
    },
    libraryId() {
      return this.libraryItem.libraryId
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
    tracksWithAudioFile() {
      return this.tracks.map((track) => {
        track.audioFile = this.media.audioFiles?.find((af) => af.metadata.path === track.metadata.path)
        return track
      })
    },
    podcastEpisodes() {
      return this.media.episodes || []
    },
    title() {
      return this.mediaMetadata.title || 'No Title'
    },
    bookSubtitle() {
      if (this.isPodcast) return null
      return this.mediaMetadata.subtitle
    },
    podcastAuthor() {
      return this.mediaMetadata.author || 'Unknown'
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    series() {
      return this.mediaMetadata.series || []
    },
    seriesList() {
      return this.series.map((se) => {
        let text = se.name
        if (se.sequence) text += ` #${se.sequence}`
        return {
          ...se,
          text
        }
      })
    },
    duration() {
      if (!this.tracks.length) return 0
      return this.media.duration
    },
    libraryFiles() {
      return this.libraryItem.libraryFiles || []
    },
    ebookFiles() {
      return this.libraryFiles.filter((lf) => lf.fileType === 'ebook')
    },
    ebookFile() {
      return this.media.ebookFile
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
      const duration = this.userMediaProgress.duration || this.duration
      return duration - this.userMediaProgress.currentTime
    },
    useEBookProgress() {
      if (!this.userMediaProgress || this.userMediaProgress.progress) return false
      return this.userMediaProgress.ebookProgress > 0
    },
    progressPercent() {
      if (this.useEBookProgress) return Math.max(Math.min(1, this.userMediaProgress.ebookProgress), 0)
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
    isQueued() {
      return this.$store.getters['getIsMediaQueued'](this.libraryItemId)
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
      if (!this.rssFeed && !this.podcastEpisodes.length && !this.tracks.length) return false // Cannot open RSS feed with no episodes/tracks

      // If rss feed is open then show feed url to users otherwise just show to admins
      return this.userIsAdminOrUp || this.rssFeed
    },
    showQueueBtn() {
      if (!this.isBook) return false
      return !this.$store.getters['getIsStreamingFromDifferentLibrary'] && this.streamLibraryItem
    },
    showCollectionsButton() {
      return this.isBook && this.userCanUpdate
    },
    contextMenuItems() {
      const items = []

      if (this.showCollectionsButton) {
        items.push({
          text: this.$strings.LabelCollections,
          action: 'collections'
        })
      }

      if (!this.isPodcast && this.tracks.length) {
        items.push({
          text: this.$strings.LabelYourPlaylists,
          action: 'playlists'
        })
      }

      if (this.bookmarks.length) {
        items.push({
          text: this.$strings.LabelYourBookmarks,
          action: 'bookmarks'
        })
      }

      if (this.showRssFeedBtn) {
        items.push({
          text: this.$strings.LabelOpenRSSFeed,
          action: 'rss-feeds'
        })
      }

      if (this.userCanDownload) {
        items.push({
          text: this.$strings.LabelDownload,
          action: 'download'
        })
      }

      if (this.ebookFile && this.$store.state.libraries.ereaderDevices?.length) {
        items.push({
          text: this.$strings.LabelSendEbookToDevice,
          subitems: this.$store.state.libraries.ereaderDevices.map((d) => {
            return {
              text: d.name,
              action: 'sendToDevice',
              data: d.name
            }
          })
        })
      }

      if (this.userIsAdminOrUp && !this.isPodcast && this.tracks.length) {
        items.push({
          text: this.$strings.LabelShare,
          action: 'share'
        })
      }

      if (this.userCanDelete) {
        items.push({
          text: this.$strings.ButtonDelete,
          action: 'delete'
        })
      }

      return items
    },
    currentUser() {
      return this.$store.state.user.user
    },
    averageRating() {
      const ratedComments = this.comments.filter((c) => c.rating)
      if (!ratedComments.length) return 0
      const sum = ratedComments.reduce((acc, comment) => acc + comment.rating, 0)
      return sum / ratedComments.length
    }
  },
  methods: {
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
            this.$toast.success(this.$strings.ToastEpisodeDownloadQueueClearSuccess)
            this.episodeDownloadQueued = []
          })
          .catch((error) => {
            console.error('Failed to clear queue', error)
            this.$toast.error(this.$strings.ToastEpisodeDownloadQueueClearFailed)
          })
      }
    },
    async findEpisodesClick() {
      if (!this.mediaMetadata.feedUrl) {
        return this.$toast.error(this.$strings.ToastNoRSSFeed)
      }
      this.fetchingRSSFeed = true
      var payload = await this.$axios.$post(`/api/podcasts/feed`, { rssFeed: this.mediaMetadata.feedUrl }).catch((error) => {
        console.error('Failed to get feed', error)
        this.$toast.error(this.$strings.ToastPodcastGetFeedFailed)
        return null
      })
      this.fetchingRSSFeed = false
      if (!payload) return

      console.log('Podcast feed', payload)
      const podcastfeed = payload.podcast
      if (!podcastfeed.episodes || !podcastfeed.episodes.length) {
        this.$toast.info(this.$strings.ToastPodcastNoEpisodesInFeed)
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
      this.$store.commit('showEReader', { libraryItem: this.libraryItem, keepProgress: true })
    },
    toggleFinished(confirmed = false) {
      if (!this.userIsFinished && this.progressPercent > 0 && !confirmed) {
        const payload = {
          message: this.$getString('MessageConfirmMarkItemFinished', [this.title]),
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
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    playItem(startTime = null) {
      let episodeId = null
      const queueItems = []
      if (this.isPodcast) {
        // Uses the sorting and filtering from the episode table component
        const episodesInListeningOrder = this.$refs.episodesTable?.episodesList || []

        // Find the first unplayed episode from the table
        let episodeIndex = episodesInListeningOrder.findIndex((ep) => {
          const podcastProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItemId, ep.id)
          return !podcastProgress || !podcastProgress.isFinished
        })
        // If all episodes are played, use the first episode
        if (episodeIndex < 0) episodeIndex = 0

        episodeId = episodesInListeningOrder[episodeIndex].id

        for (let i = episodeIndex; i < episodesInListeningOrder.length; i++) {
          const episode = episodesInListeningOrder[i]
          const podcastProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItemId, episode.id)
          if (!podcastProgress || !podcastProgress.isFinished) {
            queueItems.push({
              libraryItemId: this.libraryItemId,
              libraryId: this.libraryId,
              episodeId: episode.id,
              title: episode.title,
              subtitle: this.title,
              caption: episode.publishedAt ? this.$getString('LabelPublishedDate', [this.$formatDate(episode.publishedAt, this.dateFormat)]) : this.$strings.LabelUnknownPublishDate,
              duration: episode.audioFile.duration || null,
              coverPath: this.libraryItem.media.coverPath || null
            })
          }
        }
      } else {
        const queueItem = {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: null,
          title: this.title,
          subtitle: this.authors.map((au) => au.name).join(', '),
          caption: '',
          duration: this.duration || null,
          coverPath: this.media.coverPath || null
        }
        queueItems.push(queueItem)
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
    checkDescriptionClamped() {
      if (!this.$refs.description) return
      this.isDescriptionClamped = this.$refs.description.scrollHeight > this.$refs.description.clientHeight
    },
    libraryItemUpdated(libraryItem) {
      if (libraryItem.id === this.libraryItemId) {
        console.log('Item was updated', libraryItem)
        this.libraryItem = libraryItem
        this.$nextTick(this.checkDescriptionClamped)
      }
    },
    clearProgressClick() {
      if (!this.userMediaProgress) return

      const payload = {
        message: this.$strings.MessageConfirmResetProgress,
        callback: (confirmed) => {
          if (confirmed) {
            this.clearProgress()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    clearProgress() {
      this.resettingProgress = true
      this.$axios
        .$delete(`/api/me/progress/${this.userMediaProgress.id}`)
        .then(() => {
          console.log('Progress reset complete')
        })
        .catch((error) => {
          console.error('Progress reset failed', error)
        })
        .finally(() => {
          this.resettingProgress = false
        })
    },
    clickRSSFeed() {
      this.$store.commit('globals/setRSSFeedOpenCloseModal', {
        id: this.libraryItemId,
        name: this.title,
        type: 'item',
        feed: this.rssFeed,
        hasEpisodesWithoutPubDate: this.podcastEpisodes.some((ep) => !ep.pubDate)
      })
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
    episodeDownloadQueueCleared(libraryItemId) {
      if (libraryItemId === this.libraryItemId) {
        this.episodeDownloadsQueued = []
      }
    },
    rssFeedOpen(data) {
      if (data.entityId === this.libraryItemId) {
        this.rssFeed = data
      }
    },
    rssFeedClosed(data) {
      if (data.entityId === this.libraryItemId) {
        this.rssFeed = null
      }
    },
    shareOpen(mediaItemShare) {
      if (mediaItemShare.mediaItemId === this.media.id) {
        this.mediaItemShare = mediaItemShare
      }
    },
    shareClosed(mediaItemShare) {
      if (mediaItemShare.mediaItemId === this.media.id) {
        this.mediaItemShare = null
      }
    },
    queueBtnClick() {
      if (this.isQueued) {
        // Remove from queue
        this.$store.commit('removeItemFromQueue', { libraryItemId: this.libraryItemId })
      } else {
        // Add to queue

        const queueItem = {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: null,
          title: this.title,
          subtitle: this.authors.map((au) => au.name).join(', '),
          caption: '',
          duration: this.duration || null,
          coverPath: this.media.coverPath || null
        }
        this.$store.commit('addItemToQueue', queueItem)
      }
    },
    downloadLibraryItem() {
      this.$downloadFile(this.downloadUrl)
    },
    deleteLibraryItem() {
      const payload = {
        message: this.$strings.MessageConfirmDeleteLibraryItem,
        checkboxLabel: this.$strings.LabelDeleteFromFileSystemCheckbox,
        yesButtonText: this.$strings.ButtonDelete,
        yesButtonColor: 'error',
        checkboxDefaultValue: !Number(localStorage.getItem('softDeleteDefault') || 0),
        callback: (confirmed, hardDelete) => {
          if (confirmed) {
            localStorage.setItem('softDeleteDefault', hardDelete ? 0 : 1)

            this.$axios
              .$delete(`/api/items/${this.libraryItemId}?hard=${hardDelete ? 1 : 0}`)
              .then(() => {
                this.$toast.success(this.$strings.ToastItemDeletedSuccess)
                this.$router.replace(`/library/${this.libraryId}`)
              })
              .catch((error) => {
                console.error('Failed to delete item', error)
                this.$toast.error(this.$strings.ToastItemDeleteFailed)
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    sendToDevice(deviceName) {
      const payload = {
        message: this.$getString('MessageConfirmSendEbookToDevice', [this.ebookFile.ebookFormat, this.title, deviceName]),
        callback: (confirmed) => {
          if (confirmed) {
            const payload = {
              libraryItemId: this.libraryItemId,
              deviceName
            }
            this.processing = true
            this.$axios
              .$post(`/api/emails/send-ebook-to-device`, payload)
              .then(() => {
                this.$toast.success(this.$getString('ToastSendEbookToDeviceSuccess', [deviceName]))
              })
              .catch((error) => {
                console.error('Failed to send ebook to device', error)
                this.$toast.error(this.$strings.ToastSendEbookToDeviceFailed)
              })
              .finally(() => {
                this.processing = false
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    contextMenuAction({ action, data }) {
      if (action === 'collections') {
        this.$store.commit('setSelectedLibraryItem', this.libraryItem)
        this.$store.commit('globals/setShowCollectionsModal', true)
      } else if (action === 'playlists') {
        this.$store.commit('globals/setSelectedPlaylistItems', [{ libraryItem: this.libraryItem }])
        this.$store.commit('globals/setShowPlaylistsModal', true)
      } else if (action === 'bookmarks') {
        this.showBookmarksModal = true
      } else if (action === 'rss-feeds') {
        this.clickRSSFeed()
      } else if (action === 'download') {
        this.downloadLibraryItem()
      } else if (action === 'delete') {
        this.deleteLibraryItem()
      } else if (action === 'sendToDevice') {
        this.sendToDevice(data)
      } else if (action === 'share') {
        this.$store.commit('setSelectedLibraryItem', this.libraryItem)
        this.$store.commit('globals/setShareModal', this.mediaItemShare)
      }
    },
    async postComment() {
      if (!this.newComment.trim()) return

      try {
        console.log('Posting comment:', {
          text: this.newComment.trim(),
          rating: this.newRating || null
        })

        const response = await this.$axios.$post(`/api/items/${this.libraryItemId}/comments`, {
          text: this.newComment.trim(),
          rating: this.newRating || null
        })

        // Load comments if they haven't been loaded yet
        if (!this.comments) {
          this.comments = []
        }

        this.comments.unshift(response)
        this.newComment = ''
        this.newRating = 0
        this.$toast.success(this.$strings.MessageCommentAdded)
      } catch (error) {
        console.error('Error posting comment:', error)
        this.$toast.error(this.$strings.ErrorAddingComment)
      }
    },
    startEditing(comment) {
      this.editingCommentId = comment.id
      this.editCommentText = comment.text
      this.editRating = comment.rating || 0
    },
    async saveEdit(comment) {
      try {
        const response = await this.$axios.put(`/api/items/${this.libraryItem.id}/comments/${comment.id}`, {
          text: this.editCommentText.trim(),
          rating: this.editRating || null
        })

        const index = this.comments.findIndex((c) => c.id === comment.id)
        this.comments.splice(index, 1, response.data)
        this.cancelEdit()
        this.$toast.success(this.$strings.MessageCommentUpdated)
      } catch (error) {
        this.$toast.error(this.$strings.ErrorUpdatingComment)
      }
    },
    cancelEdit() {
      this.editingCommentId = null
      this.editCommentText = ''
      this.editRating = 0
    },
    async deleteComment(comment) {
      if (!confirm(this.$strings.ConfirmDeleteComment)) return

      try {
        await this.$axios.delete(`/api/items/${this.libraryItem.id}/comments/${comment.id}`)
        const index = this.comments.findIndex((c) => c.id === comment.id)
        this.comments.splice(index, 1)
        this.$toast.success(this.$strings.MessageCommentDeleted)
      } catch (error) {
        this.$toast.error(this.$strings.ErrorDeletingComment)
      }
    },
    canEditComment(comment) {
      return this.$store.state.user.user.id === comment.userId || this.$store.state.user.user.type === 'admin'
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString()
    },
    async loadComments() {
      try {
        const response = await this.$axios.$get(`/api/items/${this.libraryItemId}/comments`)
        this.comments = response || []
      } catch (error) {
        console.error('Error loading comments:', error)
        this.$toast.error(this.$strings.ErrorLoadingComments)
      }
    }
  },
  async mounted() {
    this.checkDescriptionClamped()
    await this.loadComments()

    this.episodeDownloadsQueued = this.libraryItem.episodeDownloadsQueued || []
    this.episodesDownloading = this.libraryItem.episodesDownloading || []

    this.$eventBus.$on(`${this.libraryItem.id}_updated`, this.libraryItemUpdated)
    this.$root.socket.on('item_updated', this.libraryItemUpdated)
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
    this.$root.socket.on('share_open', this.shareOpen)
    this.$root.socket.on('share_closed', this.shareClosed)
    this.$root.socket.on('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.on('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.on('episode_download_finished', this.episodeDownloadFinished)
    this.$root.socket.on('episode_download_queue_cleared', this.episodeDownloadQueueCleared)
  },
  beforeDestroy() {
    this.$eventBus.$off(`${this.libraryItem.id}_updated`, this.libraryItemUpdated)
    this.$root.socket.off('item_updated', this.libraryItemUpdated)
    this.$root.socket.off('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.off('rss_feed_closed', this.rssFeedClosed)
    this.$root.socket.off('share_open', this.shareOpen)
    this.$root.socket.off('share_closed', this.shareClosed)
    this.$root.socket.off('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.off('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.off('episode_download_finished', this.episodeDownloadFinished)
    this.$root.socket.off('episode_download_queue_cleared', this.episodeDownloadQueueCleared)
  }
}
</script>

<style scoped>
#item-description {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  max-height: calc(6 * 1lh);
}

/* Safari-specific fix for the description clamping */
@supports (-webkit-touch-callout: none) {
  #item-description {
    position: relative;
    display: block;
    overflow: hidden;
    max-height: calc(6 * 1lh);
  }
}

#item-description.show-full {
  -webkit-line-clamp: unset;
  max-height: 999rem;
}

.comments-section {
  max-width: 800px;
  margin: 0 auto;
}
</style>