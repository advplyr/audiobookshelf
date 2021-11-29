<template>
  <div ref="card" :id="`book-card-${index}`" :style="{ width: bookWidth + 'px', height: bookHeight + 'px' }" class="absolute top-0 left-0 rounded-sm z-20">
    <div class="w-full h-full bg-primary relative rounded-sm">
      <div class="absolute top-0 left-0 w-full flex items-center justify-center">
        <p>{{ title }}/{{ index }}</p>
      </div>
      <img v-show="audiobook" :src="bookCoverSrc" class="w-full h-full object-contain" />
      <!-- <covers-book-cover v-show="audiobook" :audiobook="audiobook" :width="bookWidth" /> -->
    </div>

    <!-- <div ref="overlay-wrapper" class="w-full h-full relative box-shadow-book cursor-pointer" @click="clickCard" @mouseover="mouseover" @mouseleave="isHovering = false">
      <covers-book-cover :audiobook="audiobook" :width="bookWidth" />
      <div v-if="false" ref="overlay">
        <div v-show="isHovering || isSelectionMode || isMoreMenuOpen" class="absolute top-0 left-0 w-full h-full bg-black rounded hidden md:block z-20" :class="overlayWrapperClasslist">
          <div v-show="showPlayButton" class="h-full flex items-center justify-center">
            <div class="hover:text-gray-200 hover:scale-110 transform duration-200" @click.stop.prevent="play">
              <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">play_circle_filled</span>
            </div>
          </div>
          <div v-show="showReadButton" class="h-full flex items-center justify-center">
            <div class="hover:text-gray-200 hover:scale-110 transform duration-200" @click.stop.prevent="clickReadEBook">
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

        <div v-if="volumeNumber && showVolumeNumber && !isHovering && !isSelectionMode" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }">
          <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">#{{ volumeNumber }}</p>
        </div>
        <div
          v-if="showSmallEBookIcon"
          class="absolute rounded-full bg-blue-500 flex items-center justify-center bg-opacity-90 hover:scale-125 transform duration-200"
          :style="{ bottom: 0.375 * sizeMultiplier + 'rem', left: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem`, width: 1.5 * sizeMultiplier + 'rem', height: 1.5 * sizeMultiplier + 'rem' }"
          @click.stop.prevent="clickReadEBook"
        >
          <span class="material-icons text-white" :style="{ fontSize: sizeMultiplier * 1 + 'rem' }">auto_stories</span>
        </div>

        <div v-show="!isSelectionMode" class="absolute bottom-0 left-0 h-1 shadow-sm max-w-full" :class="userIsRead ? 'bg-success' : 'bg-yellow-400'" :style="{ width: bookWidth * userProgressPercent + 'px' }"></div>

        <ui-tooltip v-if="showError" :text="errorText" class="absolute bottom-4 left-0">
          <div :style="{ height: 1.5 * sizeMultiplier + 'rem', width: 2.5 * sizeMultiplier + 'rem' }" class="bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
            <span class="material-icons text-red-100 pr-1" :style="{ fontSize: 0.875 * sizeMultiplier + 'rem' }">priority_high</span>
          </div>
        </ui-tooltip>
      </div>
    </div> -->
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    bookWidth: {
      type: Number,
      default: 120
    }
  },
  data() {
    return {
      isAttached: false,
      isHovering: false,
      isMoreMenuOpen: false,
      isProcessingReadUpdate: false,
      overlayEl: null,
      audiobook: null
    }
  },
  computed: {
    _audiobook() {
      return this.audiobook || {}
    },
    bookCoverSrc() {
      return this.store.getters['audiobooks/getBookCoverSrc'](this._audiobook, this.placeholderUrl)
    },
    audiobookId() {
      return this._audiobook.id
    },
    hasEbook() {
      return this._audiobook.numEbooks
    },
    hasTracks() {
      return this._audiobook.numTracks
    },
    isSelectionMode() {
      return !!this.selectedAudiobooks.length
    },
    selectedAudiobooks() {
      return this.store.state.selectedAudiobooks
    },
    selected() {
      return this.store.getters['getIsAudiobookSelected'](this.audiobookId)
    },
    processingBatch() {
      return this.store.state.processingBatch
    },
    book() {
      return this._audiobook.book || {}
    },
    bookHeight() {
      return this.bookWidth * 1.6
    },
    sizeMultiplier() {
      return this.bookWidth / 120
    },
    title() {
      return this.book.title
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
      var store = this.$store || this.$nuxt.$store
      return store.getters['user/getUserAudiobook'](this.audiobookId)
    },
    userProgressPercent() {
      return this.userProgress ? this.userProgress.progress || 0 : 0
    },
    userIsRead() {
      return this.userProgress ? !!this.userProgress.isRead : false
    },
    showError() {
      return this.hasMissingParts || this.hasInvalidParts || this.isMissing || this.isIncomplete
    },
    isStreaming() {
      var store = this.$store || this.$nuxt.$store
      return store.getters['getAudiobookIdStreaming'] === this.audiobookId
    },
    showReadButton() {
      return !this.isSelectionMode && this.showExperimentalFeatures && !this.showPlayButton && this.hasEbook
    },
    showPlayButton() {
      return !this.isSelectionMode && !this.isMissing && !this.isIncomplete && this.hasTracks && !this.isStreaming
    },
    showSmallEBookIcon() {
      return !this.isSelectionMode && this.showExperimentalFeatures && this.hasEbook
    },
    isMissing() {
      return this.audiobook.isMissing
    },
    isIncomplete() {
      return this.audiobook.isIncomplete
    },
    hasMissingParts() {
      return this.audiobook.hasMissingParts
    },
    hasInvalidParts() {
      return this.audiobook.hasInvalidParts
    },
    errorText() {
      if (this.isMissing) return 'Audiobook directory is missing!'
      else if (this.isIncomplete) return 'Audiobook has no audio tracks & ebook'
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
    }
  },
  methods: {
    setBook(audiobook) {
      this.audiobook = audiobook
    },
    clickCard(e) {
      if (this.isSelectionMode) {
        e.stopPropagation()
        e.preventDefault()
        this.selectBtnClick()
      }
    },
    clickShowMore() {},
    clickReadEBook() {},
    editBtnClick() {},
    selectBtnClick() {
      if (this.processingBatch) return
      this.store.commit('toggleAudiobookSelected', this.audiobookId)
    },
    play() {},
    detach() {
      if (!this.isAttached) return
      if (this.$refs.overlay) {
        this.overlayEl = this.$refs.overlay
        this.overlayEl.remove()
      } else if (this.overlayEl) {
        this.overlayEl.remove()
      }
      this.isAttached = false
    },
    attach() {
      if (this.isAttached) return
      this.isAttached = true

      if (this.overlayEl) {
        this.$refs['overlay-wrapper'].appendChild(this.overlayEl)
      }
    },
    mouseover() {
      this.isHovering = true
    },
    // mouseleave() {
    //   this.isHovering = false
    // },
    destroy() {
      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      this.$el.parentNode.removeChild(this.$el)
    }
  },
  mounted() {}
}
</script>