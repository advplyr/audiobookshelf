<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div v-show="saving" class="absolute z-20 w-full h-full flex items-center justify-center">
      <ui-loading-indicator />
    </div>
    <div class="w-full h-full overflow-y-auto p-8">
      <div class="w-full flex justify-between items-center pb-6 pt-2">
        <p class="text-lg">Drag files into correct track order</p>
        <ui-btn color="success" @click="saveTracklist">Save Tracklist</ui-btn>
      </div>
      <div class="w-full flex items-center text-sm py-4 bg-primary border-l border-r border-t border-gray-600">
        <div class="font-book text-center px-4 w-12">New</div>
        <div class="font-book text-center px-4 w-24 flex items-center cursor-pointer text-white text-opacity-40 hover:text-opacity-100" @click="sortByCurrent" @mousedown.prevent>
          <span class="text-white">Current</span>
          <span class="material-icons ml-1" :class="currentSort === 'current' ? 'text-white text-opacity-100 text-lg' : 'text-sm'">{{ currentSort === 'current' ? 'expand_more' : 'unfold_more' }}</span>
        </div>
        <div class="font-book text-center px-4 w-32 flex items-center cursor-pointer text-white text-opacity-40 hover:text-opacity-100" @click="sortByFilenameTrack" @mousedown.prevent>
          <span class="text-white">Track From Filename</span>
          <span class="material-icons ml-1" :class="currentSort === 'track-filename' ? 'text-white text-opacity-100 text-lg' : 'text-sm'">{{ currentSort === 'track-filename' ? 'expand_more' : 'unfold_more' }}</span>
        </div>
        <div class="font-book text-center px-4 w-32 flex items-center cursor-pointer text-white text-opacity-40 hover:text-opacity-100" @click="sortByMetadataTrack" @mousedown.prevent>
          <span class="text-white">Track From Metadata</span>
          <span class="material-icons ml-1" :class="currentSort === 'metadata' ? 'text-white text-opacity-100 text-lg' : 'text-sm'">{{ currentSort === 'metadata' ? 'expand_more' : 'unfold_more' }}</span>
        </div>
        <div class="font-mono w-20 text-center">Disc From Filename</div>
        <div class="font-mono w-20 text-center">Disc From Metadata</div>
        <div class="font-book text-center px-4 flex-grow flex items-center cursor-pointer text-white text-opacity-40 hover:text-opacity-100" @click="sortByFilename" @mousedown.prevent>
          <span class="text-white">Filename</span>
          <span class="material-icons ml-1" :class="currentSort === 'filename' ? 'text-white text-opacity-100 text-lg' : 'text-sm'">{{ currentSort === 'filename' ? 'expand_more' : 'unfold_more' }}</span>
        </div>
        <!-- <div class="font-book truncate px-4 flex-grow">Filename</div> -->

        <div class="font-mono w-20 text-center">Size</div>
        <div class="font-mono w-20 text-center">Duration</div>
        <div class="font-mono text-center w-20">Status</div>
        <div class="font-mono w-56">Notes</div>
        <div class="font-book w-40">Include in Tracklist</div>
      </div>
      <draggable v-model="files" v-bind="dragOptions" class="list-group border border-gray-600" draggable=".item" tag="ul" @start="drag = true" @end="drag = false" @update="draggableUpdate">
        <transition-group type="transition" :name="!drag ? 'flip-list' : null">
          <li v-for="(audio, index) in files" :key="audio.ino" :class="audio.include ? 'item' : 'exclude'" class="w-full list-group-item flex items-center relative">
            <div v-if="audiofilesEncoding[audio.ino]" class="absolute top-0 left-0 w-full h-full bg-success bg-opacity-25" />

            <div class="font-book text-center px-4 py-1 w-12">
              {{ audio.include ? index - numExcluded + 1 : -1 }}
            </div>
            <div class="font-book text-center px-4 w-24">{{ audio.index }}</div>
            <div class="font-book text-center px-2 w-32">
              {{ audio.trackNumFromFilename }}
            </div>
            <div class="font-book text-center w-32">
              {{ audio.trackNumFromMeta }}
            </div>
            <div class="font-book truncate px-4 w-20">
              {{ audio.discNumFromFilename }}
            </div>
            <div class="font-book truncate px-4 w-20">
              {{ audio.discNumFromMeta }}
            </div>
            <div class="font-book truncate px-4 flex-grow">
              {{ audio.metadata.filename }}
            </div>

            <div class="font-mono w-20 text-center">
              {{ $bytesPretty(audio.metadata.size) }}
            </div>
            <div class="font-mono w-20">
              {{ $secondsToTimestamp(audio.duration) }}
            </div>
            <div class="font-mono text-center w-20">
              <span class="material-icons text-sm" :class="audio.invalid ? 'text-error' : 'text-success'">{{ getStatusIcon(audio) }}</span>
            </div>
            <div class="font-sans text-xs font-normal w-56">
              {{ audio.error }}
            </div>
            <div class="font-sans text-xs font-normal w-40 flex items-center justify-center">
              <ui-toggle-switch v-model="audio.include" :off-color="'error'" @input="includeToggled(audio)" />
            </div>
          </li>
        </transition-group>
      </draggable>
    </div>
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
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
    if (libraryItem.isFile) {
      console.error('No need to edit library item that is 1 file...')
      return redirect('/')
    }
    return {
      libraryItem,
      files: libraryItem.media.audioFiles ? libraryItem.media.audioFiles.map((af) => ({ ...af, include: !af.exclude })) : []
    }
  },
  data() {
    return {
      drag: false,
      dragOptions: {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost'
      },
      saving: false,
      currentSort: 'current'
    }
  },
  computed: {
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || []
    },
    audioFiles() {
      return this.media.audioFiles || []
    },
    numExcluded() {
      var count = 0
      this.files.forEach((file) => {
        if (!file.include) count++
      })
      return count
    },
    missingParts() {
      return this.media.missingParts || []
    },
    libraryItemId() {
      return this.libraryItem.id
    },
    title() {
      return this.mediaMetadata.title || 'No Title'
    },
    author() {
      return this.mediaMetadata.authorName || 'Unknown'
    },
    tracks() {
      return this.media.tracks
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    draggableUpdate(e) {
      this.currentSort = ''
    },
    sortByCurrent() {
      this.files.sort((a, b) => {
        if (a.index === null) return 1
        return a.index - b.index
      })
      this.currentSort = 'current'
    },
    sortByMetadataTrack() {
      this.files.sort((a, b) => {
        if (a.trackNumFromMeta === null) return 1
        return a.trackNumFromMeta - b.trackNumFromMeta
      })
      this.currentSort = 'metadata'
    },
    sortByFilenameTrack() {
      this.files.sort((a, b) => {
        if (a.trackNumFromFilename === null) return 1
        return a.trackNumFromFilename - b.trackNumFromFilename
      })
      this.currentSort = 'track-filename'
    },
    sortByFilename() {
      this.files.sort((a, b) => {
        return (a.metadata.filename || '').toLowerCase().localeCompare((b.metadata.filename || '').toLowerCase())
      })
      this.currentSort = 'filename'
    },
    includeToggled(audio) {
      var new_index = 0
      if (audio.include) {
        new_index = this.numExcluded
      }
      var old_index = this.files.findIndex((f) => f.ino === audio.ino)
      if (new_index >= this.files.length) {
        var k = new_index - this.files.length + 1
        while (k--) {
          this.files.push(undefined)
        }
      }
      this.files.splice(new_index, 0, this.files.splice(old_index, 1)[0])
    },
    saveTracklist() {
      var orderedFileData = this.files.map((file) => {
        return {
          index: file.index,
          filename: file.metadata.filename,
          ino: file.ino,
          exclude: !file.include
        }
      })

      this.saving = true
      this.$axios
        .$patch(`/api/items/${this.libraryItem.id}/tracks`, { orderedFileData })
        .then((data) => {
          console.log('Finished patching files', data)
          this.saving = false
          this.$toast.success('Tracks Updated')
          this.$router.push(`/item/${this.libraryItemId}`)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.saving = false
        })
    },
    getStatusIcon(audio) {
      if (audio.invalid) {
        return 'error_outline'
      } else {
        return 'check_circle'
      }
    }
  }
}
</script>
