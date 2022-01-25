<template>
  <div ref="card" :id="`book-card-${index}`" :style="{ minWidth: width + 'px', maxWidth: width + 'px', height: height + 'px' }" class="rounded-sm z-10 bg-primary cursor-pointer box-shadow-book" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <!-- When cover image does not fill -->
    <div v-show="showCoverBg" class="absolute top-0 left-0 w-full h-full overflow-hidden rounded-sm bg-primary">
      <div class="absolute cover-bg" ref="coverBg" />
    </div>

    <div v-if="isAlternativeBookshelfView" class="absolute left-0 z-50 w-full" :style="{ bottom: `-${sizeMultiplier * 3}rem` }">
      <p class="truncate" :style="{ fontSize: 0.9 * sizeMultiplier + 'rem' }">
        <span v-if="volumeNumber">#{{ volumeNumber }}&nbsp;</span>{{ title }}
      </p>
      <p class="truncate text-gray-400" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ authorFL }}</p>
    </div>

    <div v-if="booksInSeries" class="absolute z-20 top-1.5 right-1.5 rounded-md leading-3 text-sm p-1 font-semibold text-white flex items-center justify-center" style="background-color: #cd9d49dd">{{ booksInSeries }}</div>

    <div class="w-full h-full absolute top-0 left-0 rounded overflow-hidden z-10">
      <div v-show="audiobook && !imageReady" class="absolute top-0 left-0 w-full h-full flex items-center justify-center" :style="{ padding: sizeMultiplier * 0.5 + 'rem' }">
        <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }" class="font-book text-gray-300 text-center">{{ title }}</p>
      </div>

      <img v-show="audiobook" ref="cover" :src="bookCoverSrc" class="w-full h-full object-contain transition-opacity duration-300" :class="showCoverBg ? 'object-contain' : 'object-fill'" @load="imageLoaded" :style="{ opacity: imageReady ? 1 : 0 }" />

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

    <div class="absolute bottom-0 left-0 h-1 shadow-sm max-w-full z-10 rounded-b" :class="userIsRead ? 'bg-success' : 'bg-yellow-400'" :style="{ width: width * userProgressPercent + 'px' }"></div>

    <div v-show="audiobook && (isHovering || isSelectionMode || isMoreMenuOpen)" class="w-full h-full absolute top-0 left-0 z-10 bg-black rounded" :class="overlayWrapperClasslist">
      <div v-show="showPlayButton" class="h-full flex items-center justify-center pointer-events-none">
        <div class="hover:text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="play">
          <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">play_circle_filled</span>
        </div>
      </div>

      <div v-show="showReadButton" class="h-full flex items-center justify-center pointer-events-none">
        <div class="hover:text-gray-200 hover:scale-110 transform duration-200 pointer-events-auto" @click.stop.prevent="clickReadEBook">
          <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">auto_stories</span>
        </div>
      </div>

      <div v-if="userCanUpdate" v-show="!isSelectionMode" class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-50" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="editClick">
        <span class="material-icons" :style="{ fontSize: sizeMultiplier + 'rem' }">edit</span>
      </div>

      <div class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-100" :style="{ top: 0.375 * sizeMultiplier + 'rem', left: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="selectBtnClick">
        <span class="material-icons" :class="selected ? 'text-yellow-400' : ''" :style="{ fontSize: 1.25 * sizeMultiplier + 'rem' }">{{ selected ? 'radio_button_checked' : 'radio_button_unchecked' }}</span>
      </div>

      <div ref="moreIcon" v-show="!isSelectionMode" class="hidden md:block absolute cursor-pointer hover:text-yellow-300" :style="{ bottom: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="clickShowMore">
        <span class="material-icons" :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">more_vert</span>
      </div>
    </div>
    <ui-tooltip v-if="showError" :text="errorText" class="absolute bottom-4 left-0 z-10">
      <div :style="{ height: 1.5 * sizeMultiplier + 'rem', width: 2.5 * sizeMultiplier + 'rem' }" class="bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
        <span class="material-icons text-red-100 pr-1" :style="{ fontSize: 0.875 * sizeMultiplier + 'rem' }">priority_high</span>
      </div>
    </ui-tooltip>

    <div v-if="volumeNumber && showVolumeNumber && !isHovering && !isSelectionMode" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md z-10" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }">
      <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">#{{ volumeNumber }}</p>
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
    showVolumeNumber: Boolean,
    bookshelfView: Number,
    bookMount: {
      // Book can be passed as prop or set with setEntity()
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      isHovering: false,
      isMoreMenuOpen: false,
      isProcessingReadUpdate: false,
      audiobook: null,
      imageReady: false,
      rescanning: false,
      selected: false,
      isSelectionMode: false,
      showCoverBg: false
    }
  },
  computed: {
    showExperimentalFeatures() {
      return this.store.state.showExperimentalFeatures
    },
    _audiobook() {
      return this.audiobook || {}
    },
    book() {
      return this._audiobook.book || {}
    },
    placeholderUrl() {
      return '/book_placeholder.jpg'
    },
    bookCoverSrc() {
      return this.store.getters['audiobooks/getBookCoverSrc'](this._audiobook, this.placeholderUrl)
    },
    audiobookId() {
      return this._audiobook.id
    },
    series() {
      return this.book.series
    },
    libraryId() {
      return this._audiobook.libraryId
    },
    hasEbook() {
      return this._audiobook.numEbooks
    },
    hasTracks() {
      return this._audiobook.numTracks
    },
    processingBatch() {
      return this.store.state.processingBatch
    },
    booksInSeries() {
      // Only added to audiobook object when collapseSeries is enabled
      return this._audiobook.booksInSeries
    },
    hasCover() {
      return !!this.book.cover
    },
    squareAspectRatio() {
      return this.bookCoverAspectRatio === 1
    },
    sizeMultiplier() {
      var baseSize = this.squareAspectRatio ? 192 : 120
      return this.width / baseSize
    },
    title() {
      return this.book.title || ''
    },
    playIconFontSize() {
      return Math.max(2, 3 * this.sizeMultiplier)
    },
    author() {
      return this.book.author
    },
    authorFL() {
      return this.book.authorFL || this.author
    },
    authorLF() {
      return this.book.authorLF || this.author
    },
    volumeNumber() {
      return this.book.volumeNumber || null
    },
    userProgress() {
      return this.store.getters['user/getUserAudiobook'](this.audiobookId)
    },
    userProgressPercent() {
      return this.userProgress ? this.userProgress.progress || 0 : 0
    },
    userIsRead() {
      return this.userProgress ? !!this.userProgress.isRead : false
    },
    showError() {
      return this.hasMissingParts || this.hasInvalidParts || this.isMissing || this.isInvalid
    },
    isStreaming() {
      return this.store.getters['getAudiobookIdStreaming'] === this.audiobookId
    },
    showReadButton() {
      return !this.isSelectionMode && this.showExperimentalFeatures && !this.showPlayButton && this.hasEbook
    },
    showPlayButton() {
      return !this.isSelectionMode && !this.isMissing && !this.isInvalid && this.hasTracks && !this.isStreaming
    },
    showSmallEBookIcon() {
      return !this.isSelectionMode && this.showExperimentalFeatures && this.hasEbook
    },
    isMissing() {
      return this._audiobook.isMissing
    },
    isInvalid() {
      return this._audiobook.isInvalid
    },
    hasMissingParts() {
      return this._audiobook.hasMissingParts
    },
    hasInvalidParts() {
      return this._audiobook.hasInvalidParts
    },
    errorText() {
      if (this.isMissing) return 'Audiobook directory is missing!'
      else if (this.isInvalid) return 'Audiobook has no audio tracks & ebook'
      var txt = ''
      if (this.hasMissingParts) {
        txt = `${this.hasMissingParts} missing parts.`
      }
      if (this.hasInvalidParts) {
        if (this.hasMissingParts) txt += ' '
        txt += `${this.hasInvalidParts} invalid parts.`
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
    userIsRoot() {
      return this.store.getters['user/getIsRoot']
    },
    moreMenuItems() {
      var items = [
        {
          func: 'toggleRead',
          text: `Mark as ${this.userIsRead ? 'Not Read' : 'Read'}`
        },
        {
          func: 'openCollections',
          text: 'Add to Collection'
        }
      ]
      if (this.userCanUpdate) {
        if (this.hasTracks) {
          items.push({
            func: 'showEditModalTracks',
            text: 'Tracks'
          })
        }
        items.push({
          func: 'showEditModalMatch',
          text: 'Match'
        })
      }
      if (this.userCanDownload) {
        items.push({
          func: 'showEditModalDownload',
          text: 'Download'
        })
      }
      if (this.userIsRoot) {
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
      if (!this.authorFL) return ''
      if (this.authorFL.length > 30) {
        return this.authorFL.slice(0, 27) + '...'
      }
      return this.authorFL
    },
    isAlternativeBookshelfView() {
      var constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView === constants.BookshelfView.TITLES
    }
  },
  methods: {
    setSelectionMode(val) {
      this.isSelectionMode = val
      if (!val) this.selected = false
    },
    setEntity(audiobook) {
      this.audiobook = audiobook
    },
    clickCard(e) {
      if (this.isSelectionMode) {
        e.stopPropagation()
        e.preventDefault()
        this.selectBtnClick()
      } else {
        var router = this.$router || this.$nuxt.$router
        if (router) {
          if (this.booksInSeries) router.push(`/library/${this.libraryId}/series/${this.$encode(this.series)}`)
          else router.push(`/audiobook/${this.audiobookId}`)
        }
      }
    },
    editClick() {
      this.$emit('edit', this.audiobook)
    },
    toggleRead() {
      // More menu func
      var updatePayload = {
        isRead: !this.userIsRead
      }
      this.isProcessingReadUpdate = true
      var toast = this.$toast || this.$nuxt.$toast
      var axios = this.$axios || this.$nuxt.$axios
      axios
        .$patch(`/api/me/audiobook/${this.audiobookId}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
          toast.success(`"${this.title}" Marked as ${updatePayload.isRead ? 'Read' : 'Not Read'}`)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          toast.error(`Failed to mark as ${updatePayload.isRead ? 'Read' : 'Not Read'}`)
        })
    },
    audiobookScanComplete(result) {
      this.rescanning = false
      var toast = this.$toast || this.$nuxt.$toast
      if (!result) {
        toast.error(`Re-Scan Failed for "${this.title}"`)
      } else if (result === 'UPDATED') {
        toast.success(`Re-Scan complete audiobook was updated`)
      } else if (result === 'UPTODATE') {
        toast.success(`Re-Scan complete audiobook was up to date`)
      } else if (result === 'REMOVED') {
        toast.error(`Re-Scan complete audiobook was removed`)
      }
    },
    rescan() {
      this.rescanning = true
      this._socket.once('audiobook_scan_complete', this.audiobookScanComplete)
      this._socket.emit('scan_audiobook', this.audiobookId)
    },
    showEditModalTracks() {
      // More menu func
      this.store.commit('showEditModalOnTab', { audiobook: this.audiobook, tab: 'tracks' })
    },
    showEditModalMatch() {
      // More menu func
      this.store.commit('showEditModalOnTab', { audiobook: this.audiobook, tab: 'match' })
    },
    showEditModalDownload() {
      // More menu func
      this.store.commit('showEditModalOnTab', { audiobook: this.audiobook, tab: 'download' })
    },
    openCollections() {
      this.store.commit('setSelectedAudiobook', this.audiobook)
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
    clickReadEBook() {
      this.store.commit('showEReader', this.audiobook)
    },
    selectBtnClick() {
      if (this.processingBatch) return
      this.selected = !this.selected
      this.$emit('select', this.audiobook)
    },
    play() {
      this.store.commit('setStreamAudiobook', this.audiobook)
      this._socket.emit('open_stream', this.audiobookId)
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
