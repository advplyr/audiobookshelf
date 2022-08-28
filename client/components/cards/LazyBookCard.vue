<template>
  <div ref="card" :id="`book-card-${index}`" :style="{ minWidth: width + 'px', maxWidth: width + 'px', height: height + 'px' }" class="rounded-sm z-10 bg-primary cursor-pointer box-shadow-book" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <!-- When cover image does not fill -->
    <div v-show="showCoverBg" class="absolute top-0 left-0 w-full h-full overflow-hidden rounded-sm bg-primary">
      <div class="absolute cover-bg" ref="coverBg" />
    </div>

    <!-- Alternative bookshelf title/author/sort -->
    <div v-if="isAlternativeBookshelfView || isAuthorBookshelfView" class="absolute left-0 z-50 w-full" :style="{ bottom: `-${titleDisplayBottomOffset}rem` }">
      <p class="truncate" :style="{ fontSize: 0.9 * sizeMultiplier + 'rem' }">
        {{ displayTitle }}
      </p>
      <p class="truncate text-gray-400" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ displayLineTwo || '&nbsp;' }}</p>
      <p v-if="displaySortLine" class="truncate text-gray-400" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ displaySortLine }}</p>
    </div>

    <div v-if="booksInSeries" class="absolute z-20 top-1.5 right-1.5 rounded-md leading-3 text-sm p-1 font-semibold text-white flex items-center justify-center" style="background-color: #cd9d49dd">{{ booksInSeries }}</div>

    <div class="w-full h-full absolute top-0 left-0 rounded overflow-hidden z-10">
      <div v-show="libraryItem && !imageReady" class="absolute top-0 left-0 w-full h-full flex items-center justify-center" :style="{ padding: sizeMultiplier * 0.5 + 'rem' }">
        <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }" class="font-book text-gray-300 text-center">{{ title }}</p>
      </div>

      <!-- Cover Image -->
      <img v-show="libraryItem" ref="cover" :src="bookCoverSrc" class="w-full h-full transition-opacity duration-300" :class="showCoverBg ? 'object-contain' : 'object-fill'" @load="imageLoaded" :style="{ opacity: imageReady ? 1 : 0 }" />

      <!-- Placeholder Cover Title & Author -->
      <div v-if="!hasCover" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem' }">
        <div>
          <p class="text-center font-book" style="color: rgb(247 223 187)" :style="{ fontSize: titleFontSize + 'rem' }">{{ titleCleaned }}</p>
        </div>
      </div>
      <div v-if="!hasCover" class="absolute left-0 right-0 w-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem', bottom: authorBottom + 'rem' }">
        <p class="text-center font-book" style="color: rgb(247 223 187); opacity: 0.75" :style="{ fontSize: authorFontSize + 'rem' }">{{ authorCleaned }}</p>
      </div>
    </div>

    <!-- No progress shown for collapsed series in library and podcasts (unless showing podcast episode) -->
    <div v-if="!booksInSeries && (!isPodcast || episodeProgress)" class="absolute bottom-0 left-0 h-1 shadow-sm max-w-full z-10 rounded-b" :class="itemIsFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: width * userProgressPercent + 'px' }"></div>

    <!-- Overlay is not shown if collapsing series in library -->
    <div v-show="!booksInSeries && libraryItem && (isHovering || isSelectionMode || isMoreMenuOpen) && !processing" class="w-full h-full absolute top-0 left-0 z-10 bg-black rounded hidden md:block" :class="overlayWrapperClasslist">
      <div v-show="showPlayButton" class="h-full flex items-center justify-center pointer-events-none">
        <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="play">
          <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">play_circle_filled</span>
        </div>
      </div>

      <div v-show="showReadButton" class="h-full flex items-center justify-center pointer-events-none">
        <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="clickReadEBook">
          <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">auto_stories</span>
        </div>
      </div>

      <div v-if="userCanUpdate" v-show="!isSelectionMode" class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-150 top-0 right-0" :style="{ padding: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="editClick">
        <span class="material-icons" :style="{ fontSize: sizeMultiplier + 'rem' }">edit</span>
      </div>

      <div class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-100" :style="{ top: 0.375 * sizeMultiplier + 'rem', left: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="selectBtnClick">
        <span class="material-icons" :class="selected ? 'text-yellow-400' : ''" :style="{ fontSize: 1.25 * sizeMultiplier + 'rem' }">{{ selected ? 'radio_button_checked' : 'radio_button_unchecked' }}</span>
      </div>

      <!-- More Menu Icon -->
      <div ref="moreIcon" v-show="!isSelectionMode" class="hidden md:block absolute cursor-pointer hover:text-yellow-300 300 hover:scale-125 transform duration-150" :style="{ bottom: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="clickShowMore">
        <span class="material-icons" :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">more_vert</span>
      </div>
    </div>

    <!-- Processing/loading spinner overlay -->
    <div v-if="processing" class="w-full h-full absolute top-0 left-0 z-10 bg-black bg-opacity-40 rounded flex items-center justify-center">
      <widgets-loading-spinner size="la-lg" />
    </div>

    <!-- Series name overlay -->
    <div v-if="booksInSeries && libraryItem && isHovering" class="w-full h-full absolute top-0 left-0 z-10 bg-black bg-opacity-60 rounded flex items-center justify-center" :style="{ padding: sizeMultiplier + 'rem' }">
      <p class="text-gray-200 text-center" :style="{ fontSize: 1.1 * sizeMultiplier + 'rem' }">{{ series }}</p>
    </div>

    <!-- Error widget -->
    <ui-tooltip v-if="showError" :text="errorText" class="absolute bottom-4 left-0 z-10">
      <div :style="{ height: 1.5 * sizeMultiplier + 'rem', width: 2.5 * sizeMultiplier + 'rem' }" class="bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
        <span class="material-icons text-red-100 pr-1" :style="{ fontSize: 0.875 * sizeMultiplier + 'rem' }">priority_high</span>
      </div>
    </ui-tooltip>

    <div v-if="rssFeed && !isSelectionMode && !isHovering" class="absolute text-success top-0 left-0 z-10" :style="{ padding: 0.375 * sizeMultiplier + 'rem' }">
      <span class="material-icons" :style="{ fontSize: sizeMultiplier * 1.5 + 'rem' }">rss_feed</span>
    </div>

    <!-- Series sequence -->
    <div v-if="seriesSequence && !isHovering && !isSelectionMode" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md z-10" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">#{{ seriesSequence }}</p>
    </div>

    <!-- Podcast Episode # -->
    <div v-if="recentEpisodeNumber && !isHovering && !isSelectionMode && !processing" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md z-10" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">Episode #{{ recentEpisodeNumber }}</p>
    </div>

    <!-- Podcast Num Episodes -->
    <div v-else-if="numEpisodes && !isHovering && !isSelectionMode" class="absolute rounded-full bg-black bg-opacity-90 box-shadow-md z-10 flex items-center justify-center" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', width: 1.25 * sizeMultiplier + 'rem', height: 1.25 * sizeMultiplier + 'rem' }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">{{ numEpisodes }}</p>
    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import MoreMenu from '@/components/widgets/MoreMenu'

export default {
  props: {
    index: Number,
    width: {
      type: Number,
      default: 120
    },
    height: {
      type: Number,
      default: 192
    },
    bookCoverAspectRatio: Number,
    bookshelfView: Number,
    bookMount: {
      // Book can be passed as prop or set with setEntity()
      type: Object,
      default: () => null
    },
    orderBy: String,
    filterBy: String,
    sortingIgnorePrefix: Boolean
  },
  data() {
    return {
      isHovering: false,
      isMoreMenuOpen: false,
      processing: false,
      libraryItem: null,
      imageReady: false,
      rescanning: false,
      selected: false,
      isSelectionMode: false,
      showCoverBg: false
    }
  },
  watch: {
    bookMount: {
      handler(newVal) {
        if (newVal) {
          this.libraryItem = newVal
        }
      }
    }
  },
  computed: {
    dateFormat() {
      return this.store.state.serverSettings.dateFormat
    },
    showExperimentalFeatures() {
      return this.store.state.showExperimentalFeatures
    },
    enableEReader() {
      return this.store.getters['getServerSetting']('enableEReader')
    },
    _libraryItem() {
      return this.libraryItem || {}
    },
    isFile() {
      // Library item is not in a folder
      return this._libraryItem.isFile
    },
    media() {
      return this._libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    mediaType() {
      return this._libraryItem.mediaType
    },
    isPodcast() {
      return this.mediaType === 'podcast'
    },
    placeholderUrl() {
      return '/book_placeholder.jpg'
    },
    bookCoverSrc() {
      return this.store.getters['globals/getLibraryItemCoverSrc'](this._libraryItem, this.placeholderUrl)
    },
    libraryItemId() {
      return this._libraryItem.id
    },
    series() {
      // Only included when filtering by series or collapse series or Continue Series shelf on home page
      return this.mediaMetadata.series
    },
    seriesSequence() {
      return this.series ? this.series.sequence : null
    },
    libraryId() {
      return this._libraryItem.libraryId
    },
    hasEbook() {
      return this.media.ebookFormat
    },
    numTracks() {
      if (this.media.tracks) return this.media.tracks.length
      return this.media.numTracks || 0 // toJSONMinified
    },
    numEpisodes() {
      if (!this.isPodcast) return 0
      return this.media.numEpisodes || 0
    },
    processingBatch() {
      return this.store.state.processingBatch
    },
    recentEpisode() {
      // Only added to item when getting currently listening podcasts
      return this._libraryItem.recentEpisode
    },
    recentEpisodeNumber() {
      if (!this.recentEpisode) return null
      if (this.recentEpisode.episode) {
        return this.recentEpisode.episode.replace(/^#/, '')
      }
      return this.recentEpisode.index
    },
    collapsedSeries() {
      // Only added to item object when collapseSeries is enabled
      return this._libraryItem.collapsedSeries
    },
    booksInSeries() {
      // Only added to item object when collapseSeries is enabled
      return this.collapsedSeries ? this.collapsedSeries.numBooks : 0
    },
    hasCover() {
      return !!this.media.coverPath
    },
    squareAspectRatio() {
      return this.bookCoverAspectRatio === 1
    },
    sizeMultiplier() {
      var baseSize = this.squareAspectRatio ? 192 : 120
      return this.width / baseSize
    },
    title() {
      return this.mediaMetadata.title || ''
    },
    playIconFontSize() {
      return Math.max(2, 3 * this.sizeMultiplier)
    },
    author() {
      if (this.isPodcast) return this.mediaMetadata.author
      return this.mediaMetadata.authorName
    },
    authorLF() {
      return this.mediaMetadata.authorNameLF
    },
    displayTitle() {
      if (this.recentEpisode) return this.recentEpisode.title
      const ignorePrefix = this.orderBy === 'media.metadata.title' && this.sortingIgnorePrefix
      if (this.collapsedSeries) return ignorePrefix ? this.collapsedSeries.nameIgnorePrefix : this.collapsedSeries.name
      return ignorePrefix ? this.mediaMetadata.titleIgnorePrefix : this.title
    },
    displayLineTwo() {
      if (this.recentEpisode) return this.title
      if (this.isPodcast) return this.author
      if (this.collapsedSeries) return ''
      if (this.isAuthorBookshelfView) {
        return this.mediaMetadata.publishedYear || ''
      }
      if (this.orderBy === 'media.metadata.authorNameLF') return this.authorLF
      return this.author
    },
    displaySortLine() {
      if (this.collapsedSeries) return null
      if (this.orderBy === 'mtimeMs') return 'Modified ' + this.$formatDate(this._libraryItem.mtimeMs, this.dateFormat)
      if (this.orderBy === 'birthtimeMs') return 'Born ' + this.$formatDate(this._libraryItem.birthtimeMs, this.dateFormat)
      if (this.orderBy === 'addedAt') return 'Added ' + this.$formatDate(this._libraryItem.addedAt, this.dateFormat)
      if (this.orderBy === 'media.duration') return 'Duration: ' + this.$elapsedPrettyExtended(this.media.duration, false)
      if (this.orderBy === 'size') return 'Size: ' + this.$bytesPretty(this._libraryItem.size)
      if (this.orderBy === 'media.numTracks') return `${this.numEpisodes} Episodes`
      return null
    },
    episodeProgress() {
      // Only used on home page currently listening podcast shelf
      if (!this.recentEpisode) return null
      return this.store.getters['user/getUserMediaProgress'](this.libraryItemId, this.recentEpisode.id)
    },
    userProgress() {
      if (this.episodeProgress) return this.episodeProgress
      return this.store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    userProgressPercent() {
      return this.userProgress ? this.userProgress.progress || 0 : 0
    },
    itemIsFinished() {
      return this.userProgress ? !!this.userProgress.isFinished : false
    },
    showError() {
      if (this.recentEpisode) return false // Dont show podcast error on episode card
      return this.numInvalidAudioFiles || this.numMissingParts || this.isMissing || this.isInvalid
    },
    isStreaming() {
      return this.store.getters['getlibraryItemIdStreaming'] === this.libraryItemId
    },
    showReadButton() {
      return !this.isSelectionMode && !this.showPlayButton && this.hasEbook && (this.showExperimentalFeatures || this.enableEReader)
    },
    showPlayButton() {
      return !this.isSelectionMode && !this.isMissing && !this.isInvalid && !this.isStreaming && (this.numTracks || this.recentEpisode)
    },
    showSmallEBookIcon() {
      return !this.isSelectionMode && this.hasEbook && (this.showExperimentalFeatures || this.enableEReader)
    },
    isMissing() {
      return this._libraryItem.isMissing
    },
    isInvalid() {
      return this._libraryItem.isInvalid
    },
    numMissingParts() {
      if (this.isPodcast) return 0
      return this.media.numMissingParts
    },
    numInvalidAudioFiles() {
      if (this.isPodcast) return 0
      return this.media.numInvalidAudioFiles
    },
    errorText() {
      if (this.isMissing) return 'Item directory is missing!'
      else if (this.isInvalid) {
        if (this.isPodcast) return 'Podcast has no episodes'
        return 'Item has no audio tracks & ebook'
      }
      var txt = ''
      if (this.numMissingParts) {
        txt += `${this.numMissingParts} missing parts.`
      }
      if (this.numInvalidAudioFiles) {
        if (txt) txt += ' '
        txt += `${this.numInvalidAudioFiles} invalid audio files.`
      }
      return txt || 'Unknown Error'
    },
    overlayWrapperClasslist() {
      var classes = []
      if (this.isSelectionMode) classes.push('bg-opacity-60')
      else classes.push('bg-opacity-40')
      if (this.selected) {
        classes.push('border-2 border-yellow-400')
      }
      return classes
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    userCanUpdate() {
      return this.store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.store.getters['user/getUserCanDelete']
    },
    userCanDownload() {
      return this.store.getters['user/getUserCanDownload']
    },
    userIsAdminOrUp() {
      return this.store.getters['user/getIsAdminOrUp']
    },
    moreMenuItems() {
      if (this.recentEpisode) {
        return [
          {
            func: 'editPodcast',
            text: 'Edit Podcast'
          },
          {
            func: 'toggleFinished',
            text: `Mark as ${this.itemIsFinished ? 'Not Finished' : 'Finished'}`
          }
        ]
      }

      var items = []
      if (!this.isPodcast) {
        items = [
          {
            func: 'toggleFinished',
            text: `Mark as ${this.itemIsFinished ? 'Not Finished' : 'Finished'}`
          },
          {
            func: 'openCollections',
            text: 'Add to Collection'
          }
        ]
      }
      if (this.userCanUpdate) {
        items.push({
          func: 'showEditModalFiles',
          text: 'Files'
        })
        items.push({
          func: 'showEditModalMatch',
          text: 'Match'
        })
      }
      if (this.userIsAdminOrUp && !this.isFile) {
        items.push({
          func: 'rescan',
          text: 'Re-Scan'
        })
      }
      return items
    },
    _socket() {
      return this.$root.socket || this.$nuxt.$root.socket
    },
    titleFontSize() {
      return 0.75 * this.sizeMultiplier
    },
    authorFontSize() {
      return 0.6 * this.sizeMultiplier
    },
    placeholderCoverPadding() {
      return 0.8 * this.sizeMultiplier
    },
    authorBottom() {
      return 0.75 * this.sizeMultiplier
    },
    titleCleaned() {
      if (!this.title) return ''
      if (this.title.length > 60) {
        return this.title.slice(0, 57) + '...'
      }
      return this.title
    },
    authorCleaned() {
      if (!this.author) return ''
      if (this.author.length > 30) {
        return this.author.slice(0, 27) + '...'
      }
      return this.author
    },
    isAlternativeBookshelfView() {
      var constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView === constants.BookshelfView.TITLES
    },
    isAuthorBookshelfView() {
      var constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView === constants.BookshelfView.AUTHOR
    },
    titleDisplayBottomOffset() {
      if (!this.isAlternativeBookshelfView && !this.isAuthorBookshelfView) return 0
      else if (!this.displaySortLine) return 3 * this.sizeMultiplier
      return 4.25 * this.sizeMultiplier
    },
    rssFeed() {
      if (this.booksInSeries) return null
      return this.store.getters['feeds/getFeedForItem'](this.libraryItemId)
    }
  },
  methods: {
    setSelectionMode(val) {
      this.isSelectionMode = val
      if (!val) this.selected = false
    },
    setEntity(_libraryItem) {
      var libraryItem = _libraryItem

      // this code block is only necessary when showing a selected series with sequence #
      //   it will update the selected series so we get realtime updates for series sequence changes
      if (this.series) {
        // i know.. but the libraryItem passed to this func cannot be modified so we need to create a copy
        libraryItem = {
          ..._libraryItem,
          media: {
            ..._libraryItem.media,
            metadata: {
              ..._libraryItem.media.metadata
            }
          }
        }
        var mediaMetadata = libraryItem.media.metadata
        if (mediaMetadata.series) {
          var newSeries = mediaMetadata.series.find((se) => se.id === this.series.id)
          if (newSeries) {
            // update selected series
            libraryItem.media.metadata.series = newSeries
            this.libraryItem = libraryItem
            return
          }
        }
      }

      this.libraryItem = libraryItem
    },
    clickCard(e) {
      if (this.processing) return
      if (this.isSelectionMode) {
        e.stopPropagation()
        e.preventDefault()
        this.selectBtnClick()
      } else {
        var router = this.$router || this.$nuxt.$router
        if (router) {
          if (this.collapsedSeries) router.push(`/library/${this.libraryId}/series/${this.collapsedSeries.id}`)
          else router.push(`/item/${this.libraryItemId}`)
        }
      }
    },
    editClick() {
      if (this.recentEpisode) {
        return this.$emit('edit', { libraryItem: this.libraryItem, episode: this.recentEpisode })
      }
      this.$emit('edit', this.libraryItem)
    },
    toggleFinished(confirmed = false) {
      if (!this.itemIsFinished && this.userProgressPercent > 0 && !confirmed) {
        const payload = {
          message: `Are you sure you want to mark "${this.displayTitle}" as finished?`,
          callback: (confirmed) => {
            if (confirmed) {
              this.toggleFinished(true)
            }
          },
          type: 'yesNo'
        }
        this.store.commit('globals/setConfirmPrompt', payload)
        return
      }

      var updatePayload = {
        isFinished: !this.itemIsFinished
      }
      this.processing = true

      var apiEndpoint = `/api/me/progress/${this.libraryItemId}`
      if (this.recentEpisode) apiEndpoint += `/${this.recentEpisode.id}`

      var toast = this.$toast || this.$nuxt.$toast
      var axios = this.$axios || this.$nuxt.$axios
      axios
        .$patch(apiEndpoint, updatePayload)
        .then(() => {
          this.processing = false
          toast.success(`Item marked as ${updatePayload.isFinished ? 'Finished' : 'Not Finished'}`)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.processing = false
          toast.error(`Failed to mark as ${updatePayload.isFinished ? 'Finished' : 'Not Finished'}`)
        })
    },
    editPodcast() {
      this.$emit('editPodcast', this.libraryItem)
    },
    rescan() {
      this.rescanning = true
      this.$axios
        .$get(`/api/items/${this.libraryItemId}/scan`)
        .then((data) => {
          this.rescanning = false
          var result = data.result
          if (!result) {
            this.$toast.error(`Re-Scan Failed for "${this.title}"`)
          } else if (result === 'UPDATED') {
            this.$toast.success(`Re-Scan complete item was updated`)
          } else if (result === 'UPTODATE') {
            this.$toast.success(`Re-Scan complete item was up to date`)
          } else if (result === 'REMOVED') {
            this.$toast.error(`Re-Scan complete item was removed`)
          }
        })
        .catch((error) => {
          console.error('Failed to scan library item', error)
          this.$toast.error('Failed to scan library item')
          this.rescanning = false
        })
    },
    showEditModalFiles() {
      // More menu func
      this.store.commit('showEditModalOnTab', { libraryItem: this.libraryItem, tab: 'files' })
    },
    showEditModalMatch() {
      // More menu func
      this.store.commit('showEditModalOnTab', { libraryItem: this.libraryItem, tab: 'match' })
    },
    openCollections() {
      this.store.commit('setSelectedLibraryItem', this.libraryItem)
      this.store.commit('globals/setShowUserCollectionsModal', true)
    },
    createMoreMenu() {
      if (!this.$refs.moreIcon) return

      var ComponentClass = Vue.extend(MoreMenu)

      var _this = this
      var instance = new ComponentClass({
        propsData: {
          items: this.moreMenuItems
        },
        created() {
          this.$on('action', (func) => {
            if (_this[func]) _this[func]()
          })
          this.$on('close', () => {
            _this.isMoreMenuOpen = false
          })
        }
      })
      instance.$mount()

      var wrapperBox = this.$refs.moreIcon.getBoundingClientRect()
      var el = instance.$el

      var elHeight = this.moreMenuItems.length * 28 + 2
      var elWidth = 130

      var bottomOfIcon = wrapperBox.top + wrapperBox.height
      var rightOfIcon = wrapperBox.left + wrapperBox.width

      var elTop = bottomOfIcon
      var elLeft = rightOfIcon
      if (bottomOfIcon + elHeight > window.innerHeight - 100) {
        elTop = wrapperBox.top - elHeight
        elLeft = wrapperBox.left
      }

      if (rightOfIcon + elWidth > window.innerWidth - 100) {
        elLeft = rightOfIcon - elWidth
      }

      el.style.top = elTop + 'px'
      el.style.left = elLeft + 'px'

      this.isMoreMenuOpen = true
      document.body.appendChild(el)
    },
    clickShowMore() {
      this.createMoreMenu()
    },
    async clickReadEBook() {
      var libraryItem = await this.$axios.$get(`/api/items/${this.libraryItemId}?expanded=1`).catch((error) => {
        console.error('Failed to get lirbary item', this.libraryItemId)
        return null
      })
      if (!libraryItem) return
      console.log('Got library itemn', libraryItem)
      this.store.commit('showEReader', libraryItem)
    },
    selectBtnClick() {
      if (this.processingBatch) return
      this.selected = !this.selected
      this.$emit('select', this.libraryItem)
    },
    async play() {
      var eventBus = this.$eventBus || this.$nuxt.$eventBus

      const queueItems = []
      // Podcast episode load queue items
      if (this.recentEpisode) {
        const axios = this.$axios || this.$nuxt.$axios
        this.processing = true
        const fullLibraryItem = await axios.$get(`/api/items/${this.libraryItemId}`).catch((err) => {
          console.error('Failed to fetch library item', err)
          return null
        })
        this.processing = false

        if (fullLibraryItem && fullLibraryItem.media.episodes) {
          const episodes = fullLibraryItem.media.episodes || []
          const episodeIndex = episodes.findIndex((ep) => ep.id === this.recentEpisode.id)
          if (episodeIndex >= 0) {
            for (let i = episodeIndex; i < episodes.length; i++) {
              const episode = episodes[i]
              const audioFile = episode.audioFile
              queueItems.push({
                libraryItemId: this.libraryItemId,
                episodeId: episode.id,
                title: episode.title,
                subtitle: this.mediaMetadata.title,
                duration: audioFile.duration || null,
                coverPath: this.media.coverPath || null
              })
            }
          }
        }
      }

      eventBus.$emit('play-item', {
        libraryItemId: this.libraryItemId,
        episodeId: this.recentEpisode ? this.recentEpisode.id : null,
        queueItems
      })
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    destroy() {
      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      if (this.$el && this.$el.parentNode) {
        this.$el.parentNode.removeChild(this.$el)
      } else if (this.$el && this.$el.remove) {
        this.$el.remove()
      }
    },
    setCoverBg() {
      if (this.$refs.coverBg) {
        this.$refs.coverBg.style.backgroundImage = `url("${this.bookCoverSrc}")`
      }
    },
    imageLoaded() {
      this.imageReady = true

      if (this.$refs.cover && this.bookCoverSrc !== this.placeholderUrl) {
        var { naturalWidth, naturalHeight } = this.$refs.cover
        var aspectRatio = naturalHeight / naturalWidth
        var arDiff = Math.abs(aspectRatio - this.bookCoverAspectRatio)

        // If image aspect ratio is <= 1.45 or >= 1.75 then use cover bg, otherwise stretch to fit
        if (arDiff > 0.15) {
          this.showCoverBg = true
          this.$nextTick(this.setCoverBg)
        } else {
          this.showCoverBg = false
        }
      }
    }
  },
  mounted() {
    if (this.bookMount) {
      this.setEntity(this.bookMount)
    }
  }
}
</script>
