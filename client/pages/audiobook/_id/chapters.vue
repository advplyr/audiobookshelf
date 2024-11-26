<template>
  <div id="page-wrapper" class="bg-bg page overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex items-center py-4 px-2 md:px-0 max-w-7xl mx-auto">
      <nuxt-link :to="`/item/${libraryItem.id}`" class="hover:underline">
        <h1 class="text-lg lg:text-xl">{{ title }}</h1>
      </nuxt-link>
      <button class="w-7 h-7 flex items-center justify-center mx-4 hover:scale-110 duration-100 transform text-gray-200 hover:text-white" @click="editItem">
        <span class="material-symbols text-base">edit</span>
      </button>
      <div class="flex-grow hidden md:block" />
      <p class="text-base hidden md:block">{{ $strings.LabelDuration }}:</p>
      <p class="text-base font-mono ml-4 hidden md:block">{{ $secondsToTimestamp(mediaDurationRounded) }}</p>
    </div>

    <div class="flex flex-wrap-reverse justify-center py-4 px-2">
      <div class="w-full max-w-3xl py-4">
        <div class="flex items-center">
          <div class="w-12 hidden lg:block" />
          <p class="text-lg mb-4 font-semibold">{{ $strings.HeaderChapters }}</p>
          <div class="flex-grow" />
          <ui-checkbox v-model="showSecondInputs" checkbox-bg="primary" small label-class="text-sm text-gray-200 pl-1" :label="$strings.LabelShowSeconds" class="mx-2" />
          <div class="w-32 hidden lg:block" />
        </div>
        <div class="flex items-center mb-3 py-1 -mx-1">
          <div class="w-12 hidden lg:block" />
          <ui-btn v-if="chapters.length" color="primary" small class="mx-1" @click.stop="removeAllChaptersClick">{{ $strings.ButtonRemoveAll }}</ui-btn>
          <ui-btn v-if="newChapters.length > 1" :color="showShiftTimes ? 'bg' : 'primary'" class="mx-1" small @click="showShiftTimes = !showShiftTimes">{{ $strings.ButtonShiftTimes }}</ui-btn>
          <ui-btn color="primary" small :class="{ 'mx-1': newChapters.length > 1 }" @click="showFindChaptersModal = true">{{ $strings.ButtonLookup }}</ui-btn>
          <div class="flex-grow" />
          <ui-btn v-if="hasChanges" small class="mx-1" @click.stop="resetChapters">{{ $strings.ButtonReset }}</ui-btn>
          <ui-btn v-if="hasChanges" color="success" class="mx-1" :disabled="!hasChanges" small @click="saveChapters">{{ $strings.ButtonSave }}</ui-btn>
          <div class="w-32 hidden lg:block" />
        </div>

        <div class="overflow-hidden">
          <transition name="slide">
            <div v-if="showShiftTimes" class="flex mb-4">
              <div class="w-12 hidden lg:block" />
              <div class="flex-grow">
                <div class="flex items-center">
                  <p class="text-sm mb-1 font-semibold pr-2">{{ $strings.LabelTimeToShift }}</p>
                  <ui-text-input v-model="shiftAmount" type="number" class="max-w-20" style="height: 30px" />
                  <ui-btn color="primary" class="mx-1" small @click="shiftChapterTimes">{{ $strings.ButtonAdd }}</ui-btn>
                  <div class="flex-grow" />
                  <span class="material-symbols text-gray-200 hover:text-white cursor-pointer" @click="showShiftTimes = false">expand_less</span>
                </div>
                <p class="text-xs py-1.5 text-gray-300 max-w-md">{{ $strings.NoteChapterEditorTimes }}</p>
              </div>
              <div class="w-32 hidden lg:block" />
            </div>
          </transition>
        </div>

        <div class="flex text-xs uppercase text-gray-300 font-semibold mb-2">
          <div class="w-8 min-w-8 md:w-12 md:min-w-12"></div>
          <div class="w-24 min-w-24 md:w-32 md:min-w-32 px-2">{{ $strings.LabelStart }}</div>
          <div class="flex-grow px-2">{{ $strings.LabelTitle }}</div>
          <div class="w-32"></div>
        </div>
        <template v-for="chapter in newChapters">
          <div :key="chapter.id" class="flex py-1">
            <div class="w-8 min-w-8 md:w-12 md:min-w-12">#{{ chapter.id + 1 }}</div>
            <div class="w-24 min-w-24 md:w-32 md:min-w-32 px-1">
              <ui-text-input v-if="showSecondInputs" v-model="chapter.start" type="number" class="text-xs" @change="checkChapters" />
              <ui-time-picker v-else class="text-xs" v-model="chapter.start" :show-three-digit-hour="mediaDuration >= 360000" @change="checkChapters" />
            </div>
            <div class="flex-grow px-1">
              <ui-text-input v-model="chapter.title" @change="checkChapters" class="text-xs" />
            </div>
            <div class="w-32 min-w-32 px-2 py-1">
              <div class="flex items-center">
                <ui-tooltip :text="$strings.MessageRemoveChapter" direction="bottom">
                  <button v-if="newChapters.length > 1" class="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-error transform hover:scale-110 duration-150" @click="removeChapter(chapter)">
                    <span class="material-symbols text-base">remove</span>
                  </button>
                </ui-tooltip>

                <ui-tooltip :text="$strings.MessageInsertChapterBelow" direction="bottom">
                  <button class="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-success transform hover:scale-110 duration-150" @click="addChapter(chapter)">
                    <span class="material-symbols text-lg">add</span>
                  </button>
                </ui-tooltip>

                <ui-tooltip :text="selectedChapterId === chapter.id && isPlayingChapter ? $strings.MessagePauseChapter : $strings.MessagePlayChapter" direction="bottom">
                  <button class="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-white transform hover:scale-110 duration-150" @click="playChapter(chapter)">
                    <widgets-loading-spinner v-if="selectedChapterId === chapter.id && isLoadingChapter" />
                    <span v-else-if="selectedChapterId === chapter.id && isPlayingChapter" class="material-symbols text-base">pause</span>
                    <span v-else class="material-symbols text-base">play_arrow</span>
                  </button>
                </ui-tooltip>

                <ui-tooltip v-if="chapter.error" :text="chapter.error" direction="left">
                  <button class="w-7 h-7 rounded-full flex items-center justify-center text-error">
                    <span class="material-symbols text-lg">error_outline</span>
                  </button>
                </ui-tooltip>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="w-full max-w-xl py-4 px-2">
        <div class="flex items-center mb-4 py-1">
          <p class="text-lg font-semibold">{{ $strings.HeaderAudioTracks }}</p>
          <div class="flex-grow" />
          <ui-btn small @click="setChaptersFromTracks">{{ $strings.ButtonSetChaptersFromTracks }}</ui-btn>
          <ui-tooltip :text="$strings.MessageSetChaptersFromTracksDescription" direction="top" class="flex items-center mx-1 cursor-default">
            <span class="material-symbols text-xl text-gray-200">info</span>
          </ui-tooltip>
        </div>
        <div class="flex text-xs uppercase text-gray-300 font-semibold mb-2">
          <div class="flex-grow">{{ $strings.LabelFilename }}</div>
          <div class="w-20">{{ $strings.LabelDuration }}</div>
          <div class="w-20 hidden md:block text-center">{{ $strings.HeaderChapters }}</div>
        </div>
        <template v-for="track in audioTracks">
          <div :key="track.ino" class="flex items-center py-2" :class="currentTrackIndex === track.index && isPlayingChapter ? 'bg-success bg-opacity-10' : ''">
            <div class="flex-grow max-w-[calc(100%-80px)] pr-2">
              <p class="text-xs truncate max-w-sm">{{ track.metadata.filename }}</p>
            </div>
            <div class="w-20" style="min-width: 80px">
              <p class="text-xs font-mono text-gray-200">{{ $secondsToTimestamp(Math.round(track.duration), false, true) }}</p>
            </div>
            <div class="w-20 hidden md:flex justify-center" style="min-width: 80px">
              <span v-if="(track.chapters || []).length" class="material-symbols text-success text-sm">check</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="saving" class="w-full h-full absolute top-0 left-0 bottom-0 right-0 z-30 bg-black bg-opacity-25 flex items-center justify-center">
      <ui-loading-indicator />
    </div>

    <modals-modal v-model="showFindChaptersModal" name="edit-book" :width="500" :processing="findingChapters">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
          <p class="text-3xl text-white truncate pointer-events-none">{{ $strings.HeaderFindChapters }}</p>
        </div>
      </template>
      <div class="w-full h-full max-h-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative">
        <div v-if="!chapterData" class="flex p-20">
          <ui-text-input-with-label v-model.trim="asinInput" label="ASIN" />
          <ui-dropdown v-model="regionInput" :label="$strings.LabelRegion" small :items="audibleRegions" class="w-32 mx-1" />
          <ui-btn small color="primary" class="mt-5" @click="findChapters">{{ $strings.ButtonSearch }}</ui-btn>
        </div>
        <div v-else class="w-full p-4">
          <div class="flex justify-between mb-4">
            <p>
              {{ $strings.LabelDurationFound }} <span class="font-semibold">{{ $secondsToTimestamp(chapterData.runtimeLengthSec) }}</span
              ><br />
              <span class="font-semibold" :class="{ 'text-warning': chapters.length !== chapterData.chapters.length }">{{ chapterData.chapters.length }}</span> {{ $strings.LabelChaptersFound }}
            </p>
            <p>
              {{ $strings.LabelYourAudiobookDuration }}: <span class="font-semibold">{{ $secondsToTimestamp(mediaDurationRounded) }}</span
              ><br />
              Your audiobook has <span class="font-semibold" :class="{ 'text-warning': chapters.length !== chapterData.chapters.length }">{{ chapters.length }}</span> chapters
            </p>
          </div>
          <widgets-alert v-if="chapterData.runtimeLengthSec > mediaDurationRounded" type="warning" class="mb-2"> {{ $strings.MessageYourAudiobookDurationIsShorter }} </widgets-alert>
          <widgets-alert v-else-if="chapterData.runtimeLengthSec < mediaDurationRounded" type="warning" class="mb-2"> {{ $strings.MessageYourAudiobookDurationIsLonger }} </widgets-alert>

          <div class="flex py-0.5 text-xs font-semibold uppercase text-gray-300 mb-1">
            <div class="w-24 px-2">{{ $strings.LabelStart }}</div>
            <div class="flex-grow px-2">{{ $strings.LabelTitle }}</div>
          </div>
          <div class="w-full max-h-80 overflow-y-auto my-2">
            <div v-for="(chapter, index) in chapterData.chapters" :key="index" class="flex py-0.5 text-xs" :class="chapter.startOffsetSec > mediaDuration ? 'bg-error bg-opacity-20' : chapter.startOffsetSec + chapter.lengthMs / 1000 > mediaDuration ? 'bg-warning bg-opacity-20' : index % 2 === 0 ? 'bg-primary bg-opacity-30' : ''">
              <div class="w-24 min-w-24 px-2">
                <p class="font-mono">{{ $secondsToTimestamp(chapter.startOffsetSec) }}</p>
              </div>
              <div class="flex-grow px-2">
                <p class="truncate max-w-sm">{{ chapter.title }}</p>
              </div>
            </div>
          </div>
          <div v-if="chapterData.runtimeLengthSec > mediaDurationRounded" class="w-full pt-2">
            <div class="flex items-center">
              <div class="w-2 h-2 bg-warning bg-opacity-50" />
              <p class="pl-2">{{ $strings.MessageChapterEndIsAfter }}</p>
            </div>
            <div class="flex items-center">
              <div class="w-2 h-2 bg-error bg-opacity-50" />
              <p class="pl-2">{{ $strings.MessageChapterStartIsAfter }}</p>
            </div>
          </div>
          <div class="flex items-center pt-2">
            <ui-btn small color="primary" class="mr-1" @click="applyChapterNamesOnly">{{ $strings.ButtonMapChapterTitles }}</ui-btn>
            <ui-tooltip :text="$strings.MessageMapChapterTitles" direction="top" class="flex items-center">
              <span class="material-symbols text-xl text-gray-200">info</span>
            </ui-tooltip>
            <div class="flex-grow" />
            <ui-btn small color="success" @click="applyChapterData">{{ $strings.ButtonApplyChapters }}</ui-btn>
          </div>
        </div>
      </div>
    </modals-modal>
  </div>
</template>

<script>
import path from 'path'

export default {
  async asyncData({ store, params, app, redirect, from }) {
    if (!store.getters['user/getUserCanUpdate']) {
      return redirect('/?error=unauthorized')
    }
    var libraryItem = await app.$axios.$get(`/api/items/${params.id}?expanded=1`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!libraryItem) {
      console.error('Not found...', params.id)
      return redirect('/')
    }
    if (libraryItem.mediaType != 'book') {
      console.error('Invalid media type')
      return redirect('/')
    }

    var previousRoute = from ? from.fullPath : null
    if (from && from.path === '/login') previousRoute = null
    return {
      libraryItem,
      previousRoute
    }
  },
  data() {
    return {
      newChapters: [],
      selectedChapter: null,
      showShiftTimes: false,
      shiftAmount: 0,
      audioEl: null,
      isPlayingChapter: false,
      isLoadingChapter: false,
      currentTrackIndex: 0,
      saving: false,
      asinInput: null,
      regionInput: 'US',
      findingChapters: false,
      showFindChaptersModal: false,
      chapterData: null,
      showSecondInputs: false,
      audibleRegions: ['US', 'CA', 'UK', 'AU', 'FR', 'DE', 'JP', 'IT', 'IN', 'ES'],
      hasChanges: false
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    title() {
      return this.mediaMetadata.title
    },
    mediaDuration() {
      return this.media.duration
    },
    mediaDurationRounded() {
      return Math.round(this.mediaDuration)
    },
    chapters() {
      return this.media.chapters || []
    },
    tracks() {
      return this.media.tracks || []
    },
    audioFiles() {
      return this.media.audioFiles || []
    },
    audioTracks() {
      return this.audioFiles.filter((af) => !af.exclude)
    },
    selectedChapterId() {
      return this.selectedChapter ? this.selectedChapter.id : null
    }
  },
  methods: {
    setChaptersFromTracks() {
      let currentStartTime = 0
      let index = 0
      const chapters = []
      for (const track of this.audioTracks) {
        chapters.push({
          id: index++,
          title: path.basename(track.metadata.filename, path.extname(track.metadata.filename)),
          start: currentStartTime,
          end: currentStartTime + track.duration
        })
        currentStartTime += track.duration
      }
      this.newChapters = chapters

      this.checkChapters()
    },
    shiftChapterTimes() {
      if (!this.shiftAmount || isNaN(this.shiftAmount) || this.newChapters.length <= 1) {
        return
      }

      const amount = Number(this.shiftAmount)

      const lastChapter = this.newChapters[this.newChapters.length - 1]
      if (lastChapter.start + amount > this.mediaDurationRounded) {
        this.$toast.error('Invalid shift amount. Last chapter start time would extend beyond the duration of this audiobook.')
        return
      }

      if (this.newChapters[0].end + amount <= 0) {
        this.$toast.error('Invalid shift amount. First chapter would have zero or negative length.')
        return
      }

      for (let i = 0; i < this.newChapters.length; i++) {
        const chap = this.newChapters[i]
        chap.end = Math.min(chap.end + amount, this.mediaDuration)
        if (i > 0) {
          chap.start = Math.max(0, chap.start + amount)
        }
      }
      this.checkChapters()
    },
    editItem() {
      this.$store.commit('showEditModal', this.libraryItem)
    },
    addChapter(chapter) {
      const newChapter = {
        id: chapter.id + 1,
        start: chapter.start,
        end: chapter.end,
        title: ''
      }
      this.newChapters.splice(chapter.id + 1, 0, newChapter)
      this.checkChapters()
    },
    removeChapter(chapter) {
      this.newChapters = this.newChapters.filter((ch) => ch.id !== chapter.id)
      this.checkChapters()
    },
    checkChapters() {
      let previousStart = 0
      let hasChanges = this.newChapters.length !== this.chapters.length

      for (let i = 0; i < this.newChapters.length; i++) {
        this.newChapters[i].id = i
        this.newChapters[i].start = Number(this.newChapters[i].start)
        this.newChapters[i].title = (this.newChapters[i].title || '').trim()

        if (i === 0 && this.newChapters[i].start !== 0) {
          this.newChapters[i].error = this.$strings.MessageChapterErrorFirstNotZero
        } else if (this.newChapters[i].start <= previousStart && i > 0) {
          this.newChapters[i].error = this.$strings.MessageChapterErrorStartLtPrev
        } else if (this.newChapters[i].start >= this.mediaDuration) {
          this.newChapters[i].error = this.$strings.MessageChapterErrorStartGteDuration
        } else {
          this.newChapters[i].error = null
        }
        previousStart = this.newChapters[i].start

        if (hasChanges) {
          continue
        }

        const existingChapter = this.chapters[i]
        if (existingChapter) {
          const { start, end, title } = this.newChapters[i]
          if (start !== existingChapter.start || end !== existingChapter.end || title !== existingChapter.title) {
            hasChanges = true
          }
        } else {
          hasChanges = true
        }
      }

      this.hasChanges = hasChanges
    },
    playChapter(chapter) {
      console.log('Play Chapter', chapter.id)
      if (this.selectedChapterId === chapter.id) {
        console.log('Chapter already playing', this.isLoadingChapter, this.isPlayingChapter)
        if (this.isLoadingChapter) return
        if (this.isPlayingChapter) {
          this.destroyAudioEl()
          return
        }
      }
      if (this.selectedChapterId) {
        this.destroyAudioEl()
      }

      const audioTrack = this.tracks.find((at) => {
        return chapter.start >= at.startOffset && chapter.start < at.startOffset + at.duration
      })
      this.selectedChapter = chapter
      this.isLoadingChapter = true

      const trackOffset = chapter.start - audioTrack.startOffset
      this.playTrackAtTime(audioTrack, trackOffset)
    },
    playTrackAtTime(audioTrack, trackOffset) {
      this.currentTrackIndex = audioTrack.index

      const audioEl = this.audioEl || document.createElement('audio')
      var src = audioTrack.contentUrl + `?token=${this.userToken}`
      if (this.$isDev) {
        src = `${process.env.serverUrl}${src}`
      }

      audioEl.src = src
      audioEl.id = 'chapter-audio'
      document.body.appendChild(audioEl)

      audioEl.addEventListener('loadeddata', () => {
        console.log('Audio loaded data', audioEl.duration)
        audioEl.currentTime = trackOffset
        audioEl.play()
        console.log('Playing audio at current time', trackOffset)
      })
      audioEl.addEventListener('play', () => {
        console.log('Audio playing')
        this.isLoadingChapter = false
        this.isPlayingChapter = true
      })
      audioEl.addEventListener('ended', () => {
        console.log('Audio ended')
        const nextTrack = this.tracks.find((t) => t.index === this.currentTrackIndex + 1)
        if (nextTrack) {
          console.log('Playing next track', nextTrack.index)
          this.currentTrackIndex = nextTrack.index
          this.playTrackAtTime(nextTrack, 0)
        } else {
          console.log('No next track')
          this.destroyAudioEl()
        }
      })
      this.audioEl = audioEl
    },
    destroyAudioEl() {
      if (!this.audioEl) return
      this.audioEl.remove()
      this.audioEl = null
      this.selectedChapter = null
      this.isPlayingChapter = false
      this.isLoadingChapter = false
    },
    saveChapters() {
      this.checkChapters()

      for (let i = 0; i < this.newChapters.length; i++) {
        if (this.newChapters[i].error) {
          this.$toast.error(this.$strings.ToastChaptersHaveErrors)
          return
        }
        if (!this.newChapters[i].title) {
          this.$toast.error(this.$strings.ToastChaptersMustHaveTitles)
          return
        }

        const nextChapter = this.newChapters[i + 1]
        if (nextChapter) {
          this.newChapters[i].end = nextChapter.start
        } else {
          this.newChapters[i].end = this.mediaDuration
        }
      }

      this.saving = true

      const payload = {
        chapters: this.newChapters
      }
      this.$axios
        .$post(`/api/items/${this.libraryItem.id}/chapters`, payload)
        .then((data) => {
          this.saving = false
          if (data.updated) {
            this.$toast.success(this.$strings.ToastChaptersUpdated)
            if (this.previousRoute) {
              this.$router.push(this.previousRoute)
            } else {
              this.$router.push(`/item/${this.libraryItem.id}`)
            }
          } else {
            this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
          }
        })
        .catch((error) => {
          this.saving = false
          console.error('Failed to update chapters', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
    },
    applyChapterNamesOnly() {
      this.newChapters.forEach((chapter, index) => {
        if (this.chapterData.chapters[index]) {
          chapter.title = this.chapterData.chapters[index].title
        }
      })

      this.showFindChaptersModal = false
      this.chapterData = null

      this.checkChapters()
    },
    applyChapterData() {
      let index = 0
      this.newChapters = this.chapterData.chapters
        .filter((chap) => chap.startOffsetSec < this.mediaDuration)
        .map((chap) => {
          return {
            id: index++,
            start: chap.startOffsetMs / 1000,
            end: Math.min(this.mediaDuration, (chap.startOffsetMs + chap.lengthMs) / 1000),
            title: chap.title
          }
        })
      this.showFindChaptersModal = false
      this.chapterData = null

      this.checkChapters()
    },
    findChapters() {
      if (!this.asinInput) {
        this.$toast.error(this.$strings.ToastAsinRequired)
        return
      }

      // Update local storage region
      if (this.regionInput !== localStorage.getItem('audibleRegion')) {
        localStorage.setItem('audibleRegion', this.regionInput)
      }

      this.findingChapters = true
      this.chapterData = null
      this.$axios
        .$get(`/api/search/chapters?asin=${this.asinInput}&region=${this.regionInput}`)
        .then((data) => {
          this.findingChapters = false

          if (data.error) {
            this.$toast.error(data.error)
            this.showFindChaptersModal = false
          } else {
            console.log('Chapter data', data)
            this.chapterData = data
          }
        })
        .catch((error) => {
          this.findingChapters = false
          console.error('Failed to get chapter data', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
          this.showFindChaptersModal = false
        })
    },
    resetChapters() {
      const payload = {
        message: this.$strings.MessageResetChaptersConfirm,
        callback: (confirmed) => {
          if (confirmed) {
            this.initChapters()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    initChapters() {
      this.newChapters = this.chapters.map((c) => ({ ...c }))
      if (!this.newChapters.length) {
        this.newChapters = [
          {
            id: 0,
            start: 0,
            end: this.mediaDuration,
            title: ''
          }
        ]
      }
      this.checkChapters()
    },
    removeAllChaptersClick() {
      const payload = {
        message: this.$strings.MessageConfirmRemoveAllChapters,
        callback: (confirmed) => {
          if (confirmed) {
            this.removeAllChapters()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    removeAllChapters() {
      this.saving = true
      const payload = {
        chapters: []
      }
      this.$axios
        .$post(`/api/items/${this.libraryItem.id}/chapters`, payload)
        .then((data) => {
          if (data.updated) {
            this.$toast.success(this.$strings.ToastChaptersRemoved)
            if (this.previousRoute) {
              this.$router.push(this.previousRoute)
            } else {
              this.$router.push(`/item/${this.libraryItem.id}`)
            }
          } else {
            this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
          }
        })
        .catch((error) => {
          console.error('Failed to remove chapters', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.saving = false
        })
    },
    libraryItemUpdated(libraryItem) {
      if (libraryItem.id === this.libraryItem.id) {
        if (!!libraryItem.media.metadata.asin && this.mediaMetadata.asin !== libraryItem.media.metadata.asin) {
          this.asinInput = libraryItem.media.metadata.asin
        }
        this.libraryItem = libraryItem
      }
    }
  },
  mounted() {
    this.regionInput = localStorage.getItem('audibleRegion') || 'US'
    this.asinInput = this.mediaMetadata.asin || null
    this.initChapters()

    this.$eventBus.$on(`${this.libraryItem.id}_updated`, this.libraryItemUpdated)
  },
  beforeDestroy() {
    this.destroyAudioEl()

    this.$eventBus.$off(`${this.libraryItem.id}_updated`, this.libraryItemUpdated)
  }
}
</script>
