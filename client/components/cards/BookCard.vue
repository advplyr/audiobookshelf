<template>
  <div ref="wrapper" class="relative">
    <!-- New Book Flag -->
    <div v-show="isNew" class="absolute top-4 left-0 w-4 h-10 pr-2 bg-darkgreen box-shadow-xl z-20">
      <div class="absolute top-0 left-0 w-full h-full transform -rotate-90 flex items-center justify-center">
        <p class="text-center text-sm">New</p>
      </div>
      <div class="absolute -bottom-4 left-0 triangle-right" />
    </div>

    <div class="rounded-sm h-full overflow-hidden relative" :style="{ padding: `${paddingY}px ${paddingX}px` }">
      <nuxt-link :to="isSelectionMode ? '' : `/audiobook/${audiobookId}`" class="cursor-pointer">
        <div class="w-full relative box-shadow-book" :style="{ height: height + 'px' }" @click="clickCard" @mouseover="isHovering = true" @mouseleave="isHovering = false">
          <covers-book-cover :audiobook="audiobook" :author-override="authorFormat" :width="width" />

          <!-- Hidden SM and DOWN -->
          <div v-show="isHovering || isSelectionMode || isMoreMenuOpen" class="absolute top-0 left-0 w-full h-full bg-black rounded hidden md:block" :class="overlayWrapperClasslist">
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

            <!-- More Icon -->
            <div ref="moreIcon" v-show="!isSelectionMode" class="hidden md:block absolute cursor-pointer hover:text-yellow-300" :style="{ bottom: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="clickShowMore">
              <span class="material-icons" :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">more_vert</span>
            </div>
          </div>

          <div v-if="volumeNumber && showVolumeNumber && !isHovering && !isSelectionMode" class="absolute rounded-lg bg-black bg-opacity-90 box-shadow-md" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem` }">
            <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">#{{ volumeNumber }}</p>
          </div>

          <!-- EBook Icon -->
          <div
            v-if="showSmallEBookIcon"
            class="absolute rounded-full bg-blue-500 flex items-center justify-center bg-opacity-90 hover:scale-125 transform duration-200"
            :style="{ bottom: 0.375 * sizeMultiplier + 'rem', left: 0.375 * sizeMultiplier + 'rem', padding: `${0.1 * sizeMultiplier}rem ${0.25 * sizeMultiplier}rem`, width: 1.5 * sizeMultiplier + 'rem', height: 1.5 * sizeMultiplier + 'rem' }"
            @click.stop.prevent="clickReadEBook"
          >
            <!-- <p :style="{ fontSize: sizeMultiplier * 0.8 + 'rem' }">EBook</p> -->
            <span class="material-icons text-white" :style="{ fontSize: sizeMultiplier * 1 + 'rem' }">auto_stories</span>
          </div>

          <div v-show="!isSelectionMode" class="absolute bottom-0 left-0 h-1 shadow-sm max-w-full" :class="userIsRead ? 'bg-success' : 'bg-yellow-400'" :style="{ width: width * userProgressPercent + 'px' }"></div>

          <ui-tooltip v-if="showError" :text="errorText" class="absolute bottom-4 left-0">
            <div :style="{ height: 1.5 * sizeMultiplier + 'rem', width: 2.5 * sizeMultiplier + 'rem' }" class="bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
              <span class="material-icons text-red-100 pr-1" :style="{ fontSize: 0.875 * sizeMultiplier + 'rem' }">priority_high</span>
            </div>
          </ui-tooltip>
        </div>
      </nuxt-link>
    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import MoreMenu from '@/components/widgets/MoreMenu'

export default {
  props: {
    audiobook: {
      type: Object,
      default: () => null
    },
    userProgress: {
      type: Object,
      default: () => null
    },
    width: {
      type: Number,
      default: 120
    },
    paddingY: {
      type: Number,
      default: 16
    },
    showVolumeNumber: Boolean
  },
  data() {
    return {
      isHovering: false,
      isMoreMenuOpen: false,
      isProcessingReadUpdate: false,
      rescanning: false
    }
  },
  computed: {
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    isNew() {
      return this.tags.includes('New')
    },
    tags() {
      return this.audiobook.tags || []
    },
    audiobookId() {
      return this.audiobook.id
    },
    hasEbook() {
      return this.audiobook.numEbooks
    },
    hasTracks() {
      return this.audiobook.numTracks
    },
    isSelectionMode() {
      return !!this.selectedAudiobooks.length
    },
    selectedAudiobooks() {
      return this.$store.state.selectedAudiobooks
    },
    selected() {
      return this.$store.getters['getIsAudiobookSelected'](this.audiobookId)
    },
    processingBatch() {
      return this.$store.state.processingBatch
    },
    book() {
      return this.audiobook.book || {}
    },
    height() {
      return this.width * 1.6
    },
    sizeMultiplier() {
      return this.width / 120
    },
    paddingX() {
      return 16 * this.sizeMultiplier
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
    authorFormat() {
      if (!this.orderBy || !this.orderBy.startsWith('book.author')) return null
      return this.orderBy === 'book.authorLF' ? this.authorLF : this.authorFL
    },
    volumeNumber() {
      return this.book.volumeNumber || null
    },
    orderBy() {
      return this.$store.getters['user/getUserSetting']('orderBy')
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
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
      return this.$store.getters['getAudiobookIdStreaming'] === this.audiobookId
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
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    userIsRoot() {
      return this.$store.getters['user/getIsRoot']
    },
    moreMenuItems() {
      var items = [
        {
          func: 'toggleRead',
          text: `Mark as ${this.userIsRead ? 'Not Read' : 'Read'}`
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
    selectBtnClick() {
      if (this.processingBatch) return
      this.$store.commit('toggleAudiobookSelected', this.audiobookId)
    },
    clickError(e) {
      e.stopPropagation()
      this.$router.push(`/audiobook/${this.audiobookId}`)
    },
    play() {
      this.$store.commit('setStreamAudiobook', this.audiobook)
      this.$root.socket.emit('open_stream', this.audiobookId)
    },
    editClick() {
      // this.$store.commit('showEditModal', this.audiobook)
      this.$emit('edit', this.audiobook)
    },
    clickCard(e) {
      if (this.isSelectionMode) {
        e.stopPropagation()
        e.preventDefault()
        this.selectBtnClick()
      }
    },
    clickReadEBook() {
      this.$store.commit('showEReader', this.audiobook)
    },
    toggleRead() {
      // More menu func
      var updatePayload = {
        isRead: !this.userIsRead
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/user/audiobook/${this.audiobookId}`, updatePayload)
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
    audiobookScanComplete(result) {
      this.rescanning = false
      if (!result) {
        this.$toast.error(`Re-Scan Failed for "${this.title}"`)
      } else if (result === 'UPDATED') {
        this.$toast.success(`Re-Scan complete audiobook was updated`)
      } else if (result === 'UPTODATE') {
        this.$toast.success(`Re-Scan complete audiobook was up to date`)
      } else if (result === 'REMOVED') {
        this.$toast.error(`Re-Scan complete audiobook was removed`)
      }
    },
    rescan() {
      this.rescanning = true
      this.$root.socket.once('audiobook_scan_complete', this.audiobookScanComplete)
      this.$root.socket.emit('scan_audiobook', this.audiobookId)
    },
    showEditModalTracks() {
      // More menu func
      this.$store.commit('showEditModalOnTab', { audiobook: this.audiobook, tab: 'tracks' })
    },
    showEditModalMatch() {
      // More menu func
      this.$store.commit('showEditModalOnTab', { audiobook: this.audiobook, tab: 'match' })
    },
    showEditModalDownload() {
      // More menu func
      this.$store.commit('showEditModalOnTab', { audiobook: this.audiobook, tab: 'download' })
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
    }
  }
}
</script>
