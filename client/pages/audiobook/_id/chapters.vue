<template>
  <div id="page-wrapper" class="bg-bg page overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex items-center py-4 max-w-7xl mx-auto">
      <nuxt-link :to="`/item/${libraryItem.id}`" class="hover:underline">
        <h1 class="text-xl">{{ title }}</h1>
      </nuxt-link>
      <button class="w-7 h-7 flex items-center justify-center mx-4 hover:scale-110 duration-100 transform text-gray-200 hover:text-white" @click="editItem">
        <span class="material-icons text-base">edit</span>
      </button>
      <div class="flex-grow" />
      <p class="text-base">Duration:</p>
      <p class="text-base font-mono ml-8">{{ mediaDuration }}</p>
    </div>

    <div class="flex flex-wrap-reverse justify-center py-4">
      <div class="w-full max-w-3xl py-4">
        <div class="flex items-center">
          <p class="text-lg mb-4 font-semibold">Audiobook Chapters</p>
          <div class="flex-grow" />
          <ui-btn color="primary" small class="mx-2" @click="showFindChaptersModal = true">Lookup</ui-btn>
          <ui-btn color="success" small @click="saveChapters">Save</ui-btn>
          <div class="w-40" />
        </div>

      <div class="w-full max-w-3xl py-4" v-if="overdriveMediaMarkersExist">
          <div class="flex items-center">
            <p class="text-sm mb-4">Overdrive Media Markers Found! Would you like to generate chapter data from them?</p>
            <div class="flex-grow" />
              <ui-btn color="primary" small class="mx-2" @click="this.generateChaptersFromOverdriveMediaMarkers">Yes</ui-btn>
              <!-- <ui-btn color="error" small @click="saveChapters">No</ui-btn> -->
            <div class="w-40" />
          </div>
        </div>

        <div class="flex text-xs uppercase text-gray-300 font-semibold mb-2">
          <div class="w-12"></div>
          <div class="w-32 px-2">Start</div>
          <div class="flex-grow px-2">Title</div>
          <div class="w-40"></div>
        </div>
        <template v-for="chapter in newChapters">
          <div :key="chapter.id" class="flex py-1">
            <div class="w-12">#{{ chapter.id + 1 }}</div>
            <div class="w-32 px-1">
              <ui-text-input v-model="chapter.start" type="number" class="text-xs" @change="checkChapters" />
            </div>
            <div class="flex-grow px-1">
              <ui-text-input v-model="chapter.title" class="text-xs" />
            </div>
            <div class="w-40 px-2 py-1">
              <div class="flex items-center">
                <button v-if="newChapters.length > 1" class="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-error transform hover:scale-110 duration-150" @click="removeChapter(chapter)">
                  <span class="material-icons-outlined text-base">remove</span>
                </button>

                <ui-tooltip text="Insert chapter below" direction="bottom">
                  <button class="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-success transform hover:scale-110 duration-150" @click="addChapter(chapter)">
                    <span class="material-icons text-lg">add</span>
                  </button>
                </ui-tooltip>

                <button class="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-white transform hover:scale-110 duration-150" @click="playChapter(chapter)">
                  <widgets-loading-spinner v-if="selectedChapterId === chapter.id && isLoadingChapter" />
                  <span v-else-if="selectedChapterId === chapter.id && isPlayingChapter" class="material-icons-outlined text-base">pause</span>
                  <span v-else class="material-icons-outlined text-base">play_arrow</span>
                </button>

                <ui-tooltip v-if="chapter.error" :text="chapter.error" direction="left">
                  <button class="w-7 h-7 rounded-full flex items-center justify-center text-error">
                    <span class="material-icons-outlined text-lg">error_outline</span>
                  </button>
                </ui-tooltip>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="w-full max-w-xl py-4">
        <p class="text-lg mb-4 font-semibold py-1">Audio Tracks</p>
        <div class="flex text-xs uppercase text-gray-300 font-semibold mb-2">
          <div class="flex-grow">Filename</div>
          <div class="w-20">Duration</div>
          <div class="w-20 text-center">Chapters</div>
        </div>
        <template v-for="track in audioTracks">
          <div :key="track.ino" class="flex items-center py-2" :class="currentTrackIndex === track.index && isPlayingChapter ? 'bg-success bg-opacity-10' : ''">
            <div class="flex-grow">
              <p class="text-xs truncate max-w-sm">{{ track.metadata.filename }}</p>
            </div>
            <div class="w-20" style="min-width: 80px">
              <p class="text-xs font-mono text-gray-200">{{ track.duration }}</p>
            </div>
            <div class="w-20 flex justify-center" style="min-width: 80px">
              <span v-if="(track.chapters || []).length" class="material-icons text-success text-sm">check</span>
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
          <p class="font-book text-3xl text-white truncate pointer-events-none">Find Chapters</p>
        </div>
      </template>
      <div class="w-full h-full max-h-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative">
        <div v-if="!chapterData" class="flex p-20">
          <ui-text-input-with-label v-model="asinInput" label="ASIN" />
          <ui-btn small color="primary" class="mt-5 ml-2" @click="findChapters">Find</ui-btn>
        </div>
        <div v-else class="w-full p-4">
          <p class="mb-4">Duration found: {{ chapterData.runtimeLengthSec }}</p>
          <div v-if="chapterData.runtimeLengthSec > mediaDuration" class="w-full bg-error bg-opacity-25 p-4 text-center mb-2 rounded border border-white border-opacity-10 text-gray-100 text-sm">
            <p>Chapter data invalid duration<br />Your media duration is shorter than duration found</p>
          </div>

          <div class="flex py-0.5 text-xs font-semibold uppercase text-gray-300 mb-1">
            <div class="w-24 px-2">Start</div>
            <div class="flex-grow px-2">Title</div>
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
          <div class="flex pt-2">
            <div class="flex-grow" />
            <ui-btn small color="success" @click="applyChapterData">Apply Chapters</ui-btn>
          </div>
        </div>
      </div>
    </modals-modal>

    <modals-modal v-model="showImportOverdriveMediaMarkersModal" name="edit-book2" :width="500" :processing="findingChapters">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
          <p class="font-book text-3xl text-white truncate pointer-events-none">Find Chapters</p>
        </div>
      </template>
      <div class="w-full h-full max-h-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative">
        <div v-if="!chapterData" class="flex p-20">
          <ui-text-input-with-label v-model="asinInput" label="NOT ASIN" />
          <ui-btn small color="primary" class="mt-5 ml-2" @click="findChapters">Find</ui-btn>
        </div>
        <div v-else class="w-full p-4">
          <p class="mb-4">Duration found: {{ chapterData.runtimeLengthSec }}</p>
          <div v-if="chapterData.runtimeLengthSec > mediaDuration" class="w-full bg-error bg-opacity-25 p-4 text-center mb-2 rounded border border-white border-opacity-10 text-gray-100 text-sm">
            <p>Chapter data invalid duration<br />Your media duration is shorter than duration found</p>
          </div>

          <div class="flex py-0.5 text-xs font-semibold uppercase text-gray-300 mb-1">
            <div class="w-24 px-2">Start</div>
            <div class="flex-grow px-2">Title</div>
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
          <div class="flex pt-2">
            <div class="flex-grow" />
            <ui-btn small color="success" @click="applyChapterData">Apply Chapters</ui-btn>
          </div>
        </div>
      </div>
    </modals-modal>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
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
    return {
      libraryItem
    }
  },
  data() {
    return {
      newChapters: [],
      selectedChapter: null,
      audioEl: null,
      isPlayingChapter: false,
      isLoadingChapter: false,
      currentTrackIndex: 0,
      saving: false,
      asinInput: null,
      findingChapters: false,
      showFindChaptersModal: false,
      showImportOverdriveMediaMarkersModal: false,
      chapterData: null
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
    overdriveMediaMarkersExist() {
      return (this.overdriveMediaMarkers?.length > 0 ? true : false ) || false
    },
    overdriveMediaMarkers() {
      return this.audioFiles.map((af) => af.metaTags.tagOverdriveMediaMarker).filter(notUndefined => notUndefined !== undefined) || []
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
      return this.audioFiles.filter((af) => !af.exclude && !af.invalid)
    },
    selectedChapterId() {
      return this.selectedChapter ? this.selectedChapter.id : null
    }
  },
  methods: {
    checkForOverdriveMediaMarkers() {
      if (this.overdriveMediaMarkersExist) {
        this.$toast.success('Your book has overdrive media markers!')
      } else {
        this.$toast.error('Your book DOES NOT have overdrive media markers!')
      }
    },
    editItem() {
      this.$store.commit('showEditModal', this.libraryItem)
    },
    addChapter(chapter) {
      console.log('Add chapter', chapter)
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
      var previousStart = 0
      for (let i = 0; i < this.newChapters.length; i++) {
        this.newChapters[i].id = i
        this.newChapters[i].start = Number(this.newChapters[i].start)

        if (i === 0 && this.newChapters[i].start !== 0) {
          this.newChapters[i].error = 'First chapter must start at 0'
        } else if (this.newChapters[i].start <= previousStart && i > 0) {
          this.newChapters[i].error = 'Invalid start time must be >= previous chapter start time'
        } else if (this.newChapters[i].start >= this.mediaDuration) {
          this.newChapters[i].error = 'Invalid start time must be < duration'
        } else {
          this.newChapters[i].error = null
        }
        previousStart = this.newChapters[i].start
      }
    },
    playChapter(chapter) {
      console.log('Play Chapter', chapter.id)
      if (this.selectedChapterId === chapter.id) {
        console.log('Chapter already playing', this.isLoadingChapter, this.isPlayingChapter)
        if (this.isLoadingChapter) return
        if (this.isPlayingChapter) {
          console.log('Destroying chapter')
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
      console.log('audio track', audioTrack)

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
        src = `http://localhost:3333${src}`
      }
      console.log('src', src)

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
          this.$toast.error('Chapters have errors')
          return
        }
        if (!this.newChapters[i].title) {
          this.$toast.error('Chapters must have titles')
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

      console.log('udpated chapters', this.newChapters)
      const payload = {
        chapters: this.newChapters
      }
      this.$axios
        .$post(`/api/items/${this.libraryItem.id}/chapters`, payload)
        .then((data) => {
          this.saving = false
          if (data.updated) {
            this.$toast.success('Chapters updated')
            this.$router.push(`/item/${this.libraryItem.id}`)
          } else {
            this.$toast.info('No changes needed updating')
          }
        })
        .catch((error) => {
          this.saving = false
          console.error('Failed to update chapters', error)
          this.$toast.error('Failed to update chapters')
        })
    },
    applyChapterData() {
      var index = 0
      this.newChapters = this.chapterData.chapters
        .filter((chap) => chap.startOffsetSec < this.mediaDuration)
        .map((chap) => {
          var chapEnd = Math.min(this.mediaDuration, (chap.startOffsetMs + chap.lengthMs) / 1000)
          return {
            id: index++,
            start: chap.startOffsetMs / 1000,
            end: chapEnd,
            title: chap.title
          }
        })
      console.log(`newChapters - ${JSON.stringify(this.newChapters)}`)
      this.showFindChaptersModal = false
      this.chapterData = null
    },
    findChapters() {
      if (!this.asinInput) {
        this.$toast.error('Must input an ASIN')
        return
      }
      this.findingChapters = true
      this.chapterData = null
      this.$axios
        .$get(`/api/search/chapters?asin=${this.asinInput}`)
        .then((data) => {
          this.findingChapters = false

          if (data.error) {
            this.$toast.error(data.error)
            this.showFindChaptersModal = false
          } else {
            console.log('Chapter data', JSON.stringify(data))
            this.chapterData = data
          }
        })
        .catch((error) => {
          this.findingChapters = false
          console.error('Failed to get chapter data', error)
          this.$toast.error('Failed to find chapters')
          this.showFindChaptersModal = false
        })
    },
    // overdrive
    generateChaptersFromOverdriveMediaMarkers() {
      var parseString = require('xml2js').parseString; // function to convert xml to JSON
      var overdriveMediaMarkers = this.overdriveMediaMarkers // an array of XML. 1 Part.mp3 to 1 array index. Each index holds 1 XML that holds multiple chapters
      
      var parsedOverdriveMediaMarkers = [] // an array of objects. each object being a chapter with a name and time key. the values are arrays of strings

      overdriveMediaMarkers.forEach(function (item, index) {     
        var parsed_result
        parseString(item, function (err, result) {
          // result.Markers.Marker is the result of parsing the XML for the MediaMarker tags for the MP3 file (Part##.mp3)
          // it is shaped like this:
          // [
          //   {
          //     "Name": [
          //       "Chapter 1:  "
          //     ],
          //     "Time": [
          //       "0:00.000"
          //     ]
          //   },
          //   {
          //     "Name": [
          //       "Chapter 2: "
          //     ],
          //     "Time": [
          //       "15:51.000"
          //     ]
          //   }
          // ]

          parsed_result = result.Markers.Marker
          
          // The values for Name and Time in parsed_results are returned as Arrays from parseString
          // update them to be strings
          parsed_result.forEach((item, index) => {
            Object.keys(item).forEach(key => {
              item[key] = item[key].toString()
            })
          })
        })

        parsedOverdriveMediaMarkers.push(parsed_result)
      })

      // go from an array of arrays of objects to an array of objects
      // end result looks like:
      // [
      //   {
      //     "Name": "Chapter 1:  The Worst Birthday",
      //     "Time": "0:00.000"
      //   },
      //   {
      //     "Name": "Chapter 2:  Dobby's Warning",
      //     "Time": "15:51.000"
      //   },
      //   { redacted }
      // ]
      parsedOverdriveMediaMarkers = parsedOverdriveMediaMarkers

      var index = 0
      
      var time = 0.0
      

      // actually generate the chapter object
      // logic ported over from benonymity's OverdriveChapterizer:
      //    https://github.com/benonymity/OverdriveChapterizer/blob/main/chapters.py
      var length = 0.0
      var newOChapters = []
      this.audioTracks.forEach((track, track_index) => {
        parsedOverdriveMediaMarkers[track_index].forEach((chapter) => {
          time = chapter.Time.split(":")
          time = length + parseFloat(time[0]) * 60 + parseFloat(time[1])
          newOChapters.push(
            {
              id: index++,
              start: time,
              end: length,
              title: chapter.Name
            }
          )
        })
        length += track.duration
      })

      this.newChapters = newOChapters
    }
  },

  mounted() {
    this.checkForOverdriveMediaMarkers()
    var dismissed = false
    this.asinInput = this.mediaMetadata.asin || null
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
  }
}
</script>