<template>
  <div ref="card" :id="`book-card-${index}`" :style="{ minWidth: width + 'px', maxWidth: width + 'px', height: height + 'px' }" class="absolute rounded-sm z-10 bg-primary cursor-pointer box-shadow-book" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <!-- When cover image does not fill -->
    <div cy-id="coverBg" v-show="showCoverBg" class="absolute top-0 left-0 w-full h-full overflow-hidden rounded-sm bg-primary">
      <div class="absolute cover-bg" ref="coverBg" />
    </div>

    <!-- Alternative bookshelf title/author/sort -->
    <div cy-id="detailBottom" v-if="isAlternativeBookshelfView || isAuthorBookshelfView" dir="auto" class="absolute left-0 z-50 w-full" :style="{ bottom: `-${titleDisplayBottomOffset}rem` }">
      <div :style="{ fontSize: 0.9 * sizeMultiplier + 'rem' }">
        <ui-tooltip v-if="displayTitle" :text="displayTitle" :disabled="!displayTitleTruncated" direction="bottom" :delayOnShow="500" class="flex items-center">
          <p cy-id="title" ref="displayTitle" class="truncate">{{ displayTitle }}</p>
          <widgets-explicit-indicator cy-id="explicitIndicator" v-if="isExplicit" />
        </ui-tooltip>
      </div>
      <p cy-id="line2" class="truncate text-gray-400" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ displayLineTwo || '&nbsp;' }}</p>
      <p cy-id="line3" v-if="displaySortLine" class="truncate text-gray-400" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ displaySortLine }}</p>
    </div>

    <div cy-id="seriesSequenceList" v-if="seriesSequenceList" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md z-20 text-right" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }" style="background-color: #78350f">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">#{{ seriesSequenceList }}</p>
    </div>
    <div cy-id="booksInSeries" v-else-if="booksInSeries" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md z-20" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }" style="background-color: #cd9d49dd">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">{{ booksInSeries }}</p>
    </div>

    <div class="w-full h-full absolute top-0 left-0 rounded overflow-hidden z-10">
      <div cy-id="titleImageNotReady" v-show="libraryItem && !imageReady" class="absolute top-0 left-0 w-full h-full flex items-center justify-center" :style="{ padding: sizeMultiplier * 0.5 + 'rem' }">
        <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }" class="text-gray-300 text-center">{{ title }}</p>
      </div>

      <!-- Cover Image -->
      <img cy-id="coverImage" v-show="libraryItem" ref="cover" :src="bookCoverSrc" class="w-full h-full transition-opacity duration-300" :class="showCoverBg ? 'object-contain' : 'object-fill'" @load="imageLoaded" :style="{ opacity: imageReady ? 1 : 0 }" />

      <!-- Placeholder Cover Title & Author -->
      <div cy-id="placeholderTitle" v-if="!hasCover" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem' }">
        <div>
          <p cy-id="placeholderTitleText" class="text-center" style="color: rgb(247 223 187)" :style="{ fontSize: titleFontSize + 'rem' }">{{ titleCleaned }}</p>
        </div>
      </div>
      <div cy-id="placeholderAuthor" v-if="!hasCover" class="absolute left-0 right-0 w-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem', bottom: authorBottom + 'rem' }">
        <p cy-id="placeholderAuthorText" class="text-center" style="color: rgb(247 223 187); opacity: 0.75" :style="{ fontSize: authorFontSize + 'rem' }">{{ authorCleaned }}</p>
      </div>
    </div>

    <!-- No progress shown for podcasts (unless showing podcast episode) -->
    <div cy-id="progressBar" v-if="!isPodcast || episodeProgress" class="absolute bottom-0 left-0 h-1 shadow-sm max-w-full z-10 rounded-b" :class="itemIsFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: width * userProgressPercent + 'px' }"></div>

    <!-- Overlay is not shown if collapsing series in library -->
    <div cy-id="overlay" v-show="!booksInSeries && libraryItem && (isHovering || isSelectionMode || isMoreMenuOpen) && !processing" class="w-full h-full absolute top-0 left-0 z-10 bg-black rounded md:block" :class="overlayWrapperClasslist">
      <div cy-id="playButton" v-show="showPlayButton" class="h-full flex items-center justify-center pointer-events-none">
        <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="play">
          <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">play_circle_filled</span>
        </div>
      </div>

      <div cy-id="readButton" v-show="showReadButton" class="h-full flex items-center justify-center pointer-events-none">
        <div class="hover:text-white text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="clickReadEBook">
          <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">auto_stories</span>
        </div>
      </div>

      <div cy-id="editButton" v-if="userCanUpdate" v-show="!isSelectionMode" class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-150 top-0 right-0" :style="{ padding: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="editClick">
        <span class="material-icons" :style="{ fontSize: sizeMultiplier + 'rem' }">edit</span>
      </div>

      <!-- Radio button -->
      <div cy-id="selectedRadioButton" v-if="!isAuthorBookshelfView" class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-100" :style="{ top: 0.375 * sizeMultiplier + 'rem', left: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="selectBtnClick">
        <span class="material-icons" :class="selected ? 'text-yellow-400' : ''" :style="{ fontSize: 1.25 * sizeMultiplier + 'rem' }">{{ selected ? 'radio_button_checked' : 'radio_button_unchecked' }}</span>
      </div>

      <!-- More Menu Icon -->
      <div cy-id="moreButton" ref="moreIcon" v-show="!isSelectionMode && moreMenuItems.length" class="md:block absolute cursor-pointer hover:text-yellow-300 300 hover:scale-125 transform duration-150" :style="{ bottom: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="clickShowMore">
        <span class="material-icons" :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">more_vert</span>
      </div>

      <div cy-id="ebookFormat" v-if="ebookFormat" class="absolute" :style="{ bottom: 0.375 * sizeMultiplier + 'rem', left: 0.375 * sizeMultiplier + 'rem' }">
        <span class="text-white/80" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ ebookFormat }}</span>
      </div>
    </div>

    <!-- Processing/loading spinner overlay -->
    <div cy-id="loadingSpinner" v-if="processing" class="w-full h-full absolute top-0 left-0 z-10 bg-black bg-opacity-40 rounded flex items-center justify-center">
      <widgets-loading-spinner size="la-lg" />
    </div>

    <!-- Series name overlay -->
    <div cy-id="seriesNameOverlay" v-if="booksInSeries && libraryItem && isHovering" class="w-full h-full absolute top-0 left-0 z-10 bg-black bg-opacity-60 rounded flex items-center justify-center" :style="{ padding: sizeMultiplier + 'rem' }">
      <p v-if="seriesName" class="text-gray-200 text-center" :style="{ fontSize: 1.1 * sizeMultiplier + 'rem' }">{{ seriesName }}</p>
    </div>

    <!-- Error widget -->
    <ui-tooltip cy-id="ErrorTooltip" v-if="showError" :text="errorText" class="absolute bottom-4 left-0 z-10">
      <div :style="{ height: 1.5 * sizeMultiplier + 'rem', width: 2.5 * sizeMultiplier + 'rem' }" class="bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
        <span class="material-icons text-red-100 pr-1" :style="{ fontSize: 0.875 * sizeMultiplier + 'rem' }">priority_high</span>
      </div>
    </ui-tooltip>

    <div cy-id="rssFeed" v-if="rssFeed && !isSelectionMode && !isHovering" class="absolute text-success top-0 left-0 z-10" :style="{ padding: 0.375 * sizeMultiplier + 'rem' }">
      <span class="material-icons" :style="{ fontSize: sizeMultiplier * 1.5 + 'rem' }">rss_feed</span>
    </div>

    <!-- Series sequence -->
    <div cy-id="seriesSequence" v-if="seriesSequence && !isHovering && !isSelectionMode" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md z-10" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">#{{ seriesSequence }}</p>
    </div>

    <!-- Podcast Episode # -->
    <div cy-id="podcastEpisodeNumber" v-if="recentEpisodeNumber !== null && !isHovering && !isSelectionMode && !processing" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md z-10" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">
        Episode<span v-if="recentEpisodeNumber"> #{{ recentEpisodeNumber }}</span>
      </p>
    </div>

    <!-- Podcast Num Episodes -->
    <div cy-id="numEpisodes" v-else-if="!numEpisodesIncomplete && numEpisodes && !isHovering && !isSelectionMode" class="absolute rounded-full bg-black bg-opacity-90 box-shadow-md z-10 flex items-center justify-center" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', width: 1.25 * sizeMultiplier + 'rem', height: 1.25 * sizeMultiplier + 'rem' }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">{{ numEpisodes }}</p>
    </div>

    <!-- Podcast Num Episodes -->
    <div cy-id="numEpisodesIncomplete" v-else-if="numEpisodesIncomplete && !isHovering && !isSelectionMode" class="absolute rounded-full bg-yellow-400 text-black font-semibold box-shadow-md z-10 flex items-center justify-center" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', width: 1.25 * sizeMultiplier + 'rem', height: 1.25 * sizeMultiplier + 'rem' }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">{{ numEpisodesIncomplete }}</p>
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
    sortingIgnorePrefix: Boolean,
    continueListeningShelf: Boolean
  },
  data() {
    return {
      isHovering: false,
      isMoreMenuOpen: false,
      processing: false,
      libraryItem: null,
      imageReady: false,
      selected: false,
      isSelectionMode: false,
      displayTitleTruncated: false,
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
    isMusic() {
      return this.mediaType === 'music'
    },
    isExplicit() {
      return this.mediaMetadata.explicit || false
    },
    placeholderUrl() {
      const config = this.$config || this.$nuxt.$config
      return `${config.routerBasePath}/book_placeholder.jpg`
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
    seriesName() {
      return this.series?.name || null
    },
    seriesSequence() {
      return this.series?.sequence || null
    },
    libraryId() {
      return this._libraryItem.libraryId
    },
    ebookFormat() {
      return this.media.ebookFormat
    },
    numTracks() {
      if (this.media.tracks) return this.media.tracks.length
      return this.media.numTracks || 0 // toJSONMinified
    },
    numEpisodes() {
      return this.media.numEpisodes || 0
    },
    numEpisodesIncomplete() {
      return this._libraryItem.numEpisodesIncomplete || 0
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
      return ''
    },
    collapsedSeries() {
      // Only added to item object when collapseSeries is enabled
      return this._libraryItem.collapsedSeries
    },
    booksInSeries() {
      // Only added to item object when collapseSeries is enabled
      return this.collapsedSeries?.numBooks || 0
    },
    seriesSequenceList() {
      return this.collapsedSeries?.seriesSequenceList || null
    },
    libraryItemIdsInSeries() {
      // Only added to item object when collapseSeries is enabled
      return this.collapsedSeries?.libraryItemIds || []
    },
    hasCover() {
      return !!this.media.coverPath
    },
    squareAspectRatio() {
      return this.bookCoverAspectRatio === 1
    },
    sizeMultiplier() {
      const baseSize = this.squareAspectRatio ? 192 : 120
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
    artist() {
      const artists = this.mediaMetadata.artists || []
      return artists.join(', ')
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
      if (this.isMusic) return this.artist
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
      if (this.orderBy === 'media.metadata.publishedYear' && this.mediaMetadata.publishedYear) return 'Published ' + this.mediaMetadata.publishedYear
      return null
    },
    episodeProgress() {
      // Only used on home page currently listening podcast shelf
      if (!this.recentEpisode) return null
      return this.store.getters['user/getUserMediaProgress'](this.libraryItemId, this.recentEpisode.id)
    },
    userProgress() {
      if (this.isMusic) return null
      if (this.episodeProgress) return this.episodeProgress
      return this.store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    isEBookOnly() {
      return !this.numTracks && this.ebookFormat
    },
    useEBookProgress() {
      if (!this.userProgress || this.userProgress.progress) return false
      return this.userProgress.ebookProgress > 0
    },
    seriesProgressPercent() {
      if (!this.libraryItemIdsInSeries.length) return 0
      let progressPercent = 0
      const useEBookProgress = this.useEBookProgress
      this.libraryItemIdsInSeries.forEach((lid) => {
        const progress = this.store.getters['user/getUserMediaProgress'](lid)
        if (progress) progressPercent += progress.isFinished ? 1 : useEBookProgress ? progress.ebookProgress || 0 : progress.progress || 0
      })
      return progressPercent / this.libraryItemIdsInSeries.length
    },
    userProgressPercent() {
      let progressPercent = this.itemIsFinished ? 1 : this.booksInSeries ? this.seriesProgressPercent : this.useEBookProgress ? this.userProgress?.ebookProgress || 0 : this.userProgress?.progress || 0
      return Math.max(Math.min(1, progressPercent), 0)
    },
    itemIsFinished() {
      if (this.booksInSeries) return this.seriesIsFinished
      return this.userProgress ? !!this.userProgress.isFinished : false
    },
    seriesIsFinished() {
      return !this.libraryItemIdsInSeries.some((lid) => {
        const progress = this.store.getters['user/getUserMediaProgress'](lid)
        return !progress || !progress.isFinished
      })
    },
    showError() {
      if (this.recentEpisode) return false // Dont show podcast error on episode card
      return this.isMissing || this.isInvalid
    },
    libraryItemIdStreaming() {
      return this.store.getters['getLibraryItemIdStreaming']
    },
    isStreaming() {
      return this.libraryItemIdStreaming === this.libraryItemId
    },
    isQueued() {
      const episodeId = this.recentEpisode ? this.recentEpisode.id : null
      return this.store.getters['getIsMediaQueued'](this.libraryItemId, episodeId)
    },
    isStreamingFromDifferentLibrary() {
      return this.store.getters['getIsStreamingFromDifferentLibrary']
    },
    showReadButton() {
      return !this.isSelectionMode && !this.showPlayButton && this.ebookFormat
    },
    showPlayButton() {
      return !this.isSelectionMode && !this.isMissing && !this.isInvalid && !this.isStreaming && (this.numTracks || this.recentEpisode || this.isMusic)
    },
    showSmallEBookIcon() {
      return !this.isSelectionMode && this.ebookFormat
    },
    isMissing() {
      return this._libraryItem.isMissing
    },
    isInvalid() {
      return this._libraryItem.isInvalid
    },
    errorText() {
      if (this.isMissing) return 'Item directory is missing!'
      else if (this.isInvalid) {
        if (this.isPodcast) return 'Podcast has no episodes'
        return 'Item has no audio tracks & ebook'
      }
      return 'Unknown Error'
    },
    overlayWrapperClasslist() {
      const classes = []
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
      if (this.isMusic) return []

      if (this.recentEpisode) {
        const items = [
          {
            func: 'editPodcast',
            text: this.$strings.ButtonEditPodcast
          },
          {
            func: 'toggleFinished',
            text: this.itemIsFinished ? this.$strings.MessageMarkAsNotFinished : this.$strings.MessageMarkAsFinished
          },
          {
            func: 'openPlaylists',
            text: this.$strings.LabelAddToPlaylist
          }
        ]
        if (this.continueListeningShelf) {
          items.push({
            func: 'removeFromContinueListening',
            text: this.$strings.ButtonRemoveFromContinueListening
          })
        }
        if (this.libraryItemIdStreaming && !this.isStreamingFromDifferentLibrary) {
          if (!this.isQueued) {
            items.push({
              func: 'addToQueue',
              text: this.$strings.ButtonQueueAddItem
            })
          } else if (!this.isStreaming) {
            items.push({
              func: 'removeFromQueue',
              text: this.$strings.ButtonQueueRemoveItem
            })
          }
        }
        return items
      }

      let items = []
      if (!this.isPodcast) {
        items = [
          {
            func: 'toggleFinished',
            text: this.itemIsFinished ? this.$strings.MessageMarkAsNotFinished : this.$strings.MessageMarkAsFinished
          }
        ]
        if (this.userCanUpdate) {
          items.push({
            func: 'openCollections',
            text: this.$strings.LabelAddToCollection
          })
        }
        if (this.numTracks) {
          items.push({
            func: 'openPlaylists',
            text: this.$strings.LabelAddToPlaylist
          })
        }
        if (this.ebookFormat && this.store.state.libraries.ereaderDevices?.length) {
          items.push({
            text: this.$strings.LabelSendEbookToDevice,
            subitems: this.store.state.libraries.ereaderDevices.map((d) => {
              return {
                text: d.name,
                func: 'sendToDevice',
                data: d.name
              }
            })
          })
        }
      }
      if (this.userCanUpdate) {
        items.push({
          func: 'showEditModalFiles',
          text: this.$strings.HeaderFiles
        })
        items.push({
          func: 'showEditModalMatch',
          text: this.$strings.HeaderMatch
        })
      }
      if (this.userIsAdminOrUp && !this.isFile) {
        items.push({
          func: 'rescan',
          text: this.$strings.ButtonReScan
        })
      }
      if (this.series && this.bookMount) {
        items.push({
          func: 'removeSeriesFromContinueListening',
          text: this.$strings.ButtonRemoveSeriesFromContinueSeries
        })
      }
      if (this.continueListeningShelf) {
        items.push({
          func: 'removeFromContinueListening',
          text: this.isEBookOnly ? this.$strings.ButtonRemoveFromContinueReading : this.$strings.ButtonRemoveFromContinueListening
        })
      }
      if (!this.isPodcast) {
        if (this.libraryItemIdStreaming && !this.isStreamingFromDifferentLibrary) {
          if (!this.isQueued) {
            items.push({
              func: 'addToQueue',
              text: this.$strings.ButtonQueueAddItem
            })
          } else if (!this.isStreaming) {
            items.push({
              func: 'removeFromQueue',
              text: this.$strings.ButtonQueueRemoveItem
            })
          }
        }
      }

      if (this.userCanDelete) {
        items.push({
          func: 'deleteLibraryItem',
          text: this.$strings.ButtonDelete
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
      const constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView === constants.BookshelfView.DETAIL
    },
    isAuthorBookshelfView() {
      const constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView === constants.BookshelfView.AUTHOR
    },
    titleDisplayBottomOffset() {
      if (!this.isAlternativeBookshelfView && !this.isAuthorBookshelfView) return 0
      else if (!this.displaySortLine) return 3 * this.sizeMultiplier
      return 4.25 * this.sizeMultiplier
    },
    rssFeed() {
      if (this.booksInSeries) return null
      return this._libraryItem.rssFeed || null
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
        if (mediaMetadata.series && Array.isArray(mediaMetadata.series)) {
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

      this.$nextTick(() => {
        if (this.$refs.displayTitle) {
          this.displayTitleTruncated = this.$refs.displayTitle.scrollWidth > this.$refs.displayTitle.clientWidth
        }
      })
    },
    clickCard(e) {
      if (this.processing) return
      if (this.isSelectionMode) {
        e.stopPropagation()
        e.preventDefault()
        this.selectBtnClick(e)
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
        })
        .catch((error) => {
          console.error('Failed', error)
          this.processing = false
          toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    editPodcast() {
      this.$emit('editPodcast', this.libraryItem)
    },
    rescan() {
      if (this.processing) return
      const axios = this.$axios || this.$nuxt.$axios
      this.processing = true
      axios
        .$post(`/api/items/${this.libraryItemId}/scan`)
        .then((data) => {
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
        })
        .finally(() => {
          this.processing = false
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
    sendToDevice(deviceName) {
      // More menu func
      const payload = {
        // message: `Are you sure you want to send ${this.ebookFormat} ebook "${this.title}" to device "${deviceName}"?`,
        message: this.$getString('MessageConfirmSendEbookToDevice', [this.ebookFormat, this.title, deviceName]),
        callback: (confirmed) => {
          if (confirmed) {
            const payload = {
              libraryItemId: this.libraryItemId,
              deviceName
            }
            this.processing = true
            const axios = this.$axios || this.$nuxt.$axios
            axios
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
      this.store.commit('globals/setConfirmPrompt', payload)
    },
    removeSeriesFromContinueListening() {
      if (!this.series) return

      const axios = this.$axios || this.$nuxt.$axios
      this.processing = true
      axios
        .$get(`/api/me/series/${this.series.id}/remove-from-continue-listening`)
        .then((data) => {
          console.log('User updated', data)
        })
        .catch((error) => {
          console.error('Failed to remove series from home', error)
          this.$toast.error('Failed to update user')
        })
        .finally(() => {
          this.processing = false
        })
    },
    removeFromContinueListening() {
      if (!this.userProgress) return

      const axios = this.$axios || this.$nuxt.$axios
      this.processing = true
      axios
        .$get(`/api/me/progress/${this.userProgress.id}/remove-from-continue-listening`)
        .then((data) => {
          console.log('User updated', data)
        })
        .catch((error) => {
          console.error('Failed to hide item from home', error)
          this.$toast.error('Failed to update user')
        })
        .finally(() => {
          this.processing = false
        })
    },
    addToQueue() {
      var queueItem = {}
      if (this.recentEpisode) {
        queueItem = {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: this.recentEpisode.id,
          title: this.recentEpisode.title,
          subtitle: this.mediaMetadata.title,
          caption: this.recentEpisode.publishedAt ? `Published ${this.$formatDate(this.recentEpisode.publishedAt, this.dateFormat)}` : 'Unknown publish date',
          duration: this.recentEpisode.audioFile.duration || null,
          coverPath: this.media.coverPath || null
        }
      } else {
        queueItem = {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: null,
          title: this.title,
          subtitle: this.author,
          caption: '',
          duration: this.media.duration || null,
          coverPath: this.media.coverPath || null
        }
      }
      this.store.commit('addItemToQueue', queueItem)
    },
    removeFromQueue() {
      const episodeId = this.recentEpisode ? this.recentEpisode.id : null
      this.store.commit('removeItemFromQueue', { libraryItemId: this.libraryItemId, episodeId })
    },
    openCollections() {
      this.store.commit('setSelectedLibraryItem', this.libraryItem)
      this.store.commit('globals/setShowCollectionsModal', true)
    },
    openPlaylists() {
      this.store.commit('globals/setSelectedPlaylistItems', [{ libraryItem: this.libraryItem, episode: this.recentEpisode }])
      this.store.commit('globals/setShowPlaylistsModal', true)
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

            this.processing = true
            const axios = this.$axios || this.$nuxt.$axios
            axios
              .$delete(`/api/items/${this.libraryItemId}?hard=${hardDelete ? 1 : 0}`)
              .then(() => {
                this.$toast.success('Item deleted')
              })
              .catch((error) => {
                console.error('Failed to delete item', error)
                this.$toast.error('Failed to delete item')
              })
              .finally(() => {
                this.processing = false
              })
          }
        },
        type: 'yesNo'
      }
      this.store.commit('globals/setConfirmPrompt', payload)
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
          this.$on('action', (action) => {
            if (action.func && _this[action.func]) _this[action.func](action.data)
          })
          this.$on('close', () => {
            _this.isMoreMenuOpen = false
          })
        }
      })
      instance.$mount()

      var wrapperBox = this.$refs.moreIcon.getBoundingClientRect()
      var el = instance.$el

      var elHeight = this.moreMenuItems.length * 28 + 10
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
      const axios = this.$axios || this.$nuxt.$axios
      var libraryItem = await axios.$get(`/api/items/${this.libraryItemId}?expanded=1`).catch((error) => {
        console.error('Failed to get lirbary item', this.libraryItemId)
        return null
      })
      if (!libraryItem) return
      this.store.commit('showEReader', { libraryItem, keepProgress: true })
    },
    selectBtnClick(evt) {
      if (this.processingBatch) return
      this.selected = !this.selected
      this.$emit('select', { entity: this.libraryItem, shiftKey: evt.shiftKey })
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
          // Sort from least recent to most recent
          episodes.sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt), undefined, { numeric: true, sensitivity: 'base' }))

          const episodeIndex = episodes.findIndex((ep) => ep.id === this.recentEpisode.id)
          if (episodeIndex >= 0) {
            for (let i = episodeIndex; i < episodes.length; i++) {
              const episode = episodes[i]
              const podcastProgress = this.store.getters['user/getUserMediaProgress'](this.libraryItemId, episode.id)
              if (!podcastProgress || !podcastProgress.isFinished) {
                queueItems.push({
                  libraryItemId: this.libraryItemId,
                  libraryId: this.libraryId,
                  episodeId: episode.id,
                  title: episode.title,
                  subtitle: this.mediaMetadata.title,
                  caption: episode.publishedAt ? `Published ${this.$formatDate(episode.publishedAt, this.dateFormat)}` : 'Unknown publish date',
                  duration: episode.audioFile.duration || null,
                  coverPath: this.media.coverPath || null
                })
              }
            }
          }
        }
      } else {
        const queueItem = {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: null,
          title: this.title,
          subtitle: this.author,
          caption: '',
          duration: this.media.duration || null,
          coverPath: this.media.coverPath || null
        }
        queueItems.push(queueItem)
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
