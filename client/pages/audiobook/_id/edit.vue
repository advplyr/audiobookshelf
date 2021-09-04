<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden relative" :class="streamAudiobook ? 'streaming' : ''">
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
        <div class="font-book text-center px-4 w-12">Old</div>
        <div class="font-book text-center px-4 w-32">Track Parsed from Filename</div>
        <div class="font-book text-center px-4 w-32">Track From Metadata</div>
        <div class="font-book truncate px-4 flex-grow">Filename</div>

        <div class="font-mono w-20 text-center">Size</div>
        <div class="font-mono w-20 text-center">Duration</div>
        <div class="font-mono text-center w-20">Status</div>
        <div class="font-mono w-56">Notes</div>
        <div class="font-book w-40">Include in Tracklist</div>
      </div>
      <draggable v-model="files" v-bind="dragOptions" class="list-group border border-gray-600" draggable=".item" tag="ul" @start="drag = true" @end="drag = false">
        <transition-group type="transition" :name="!drag ? 'flip-list' : null">
          <li v-for="(audio, index) in files" :key="audio.path" :class="audio.include ? 'item' : 'exclude'" class="w-full list-group-item flex items-center">
            <div class="font-book text-center px-4 py-1 w-12">
              {{ audio.include ? index - numExcluded + 1 : -1 }}
            </div>
            <div class="font-book text-center px-4 w-12">{{ audio.index }}</div>
            <div class="font-book text-center px-2 w-32">
              {{ audio.trackNumFromFilename }}
            </div>
            <div class="font-book text-center w-32">
              {{ audio.trackNumFromMeta }}
            </div>
            <div class="font-book truncate px-4 flex-grow">
              {{ audio.filename }}
            </div>

            <div class="font-mono w-20 text-center">
              {{ $bytesPretty(audio.size) }}
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
            <div class="font-sans text-xs font-normal w-40 flex justify-center">
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
    var audiobook = await app.$axios.$get(`/api/audiobook/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!audiobook) {
      console.error('No audiobook...', params.id)
      return redirect('/')
    }
    return {
      audiobook,
      files: audiobook.audioFiles ? audiobook.audioFiles.map((af) => ({ ...af, include: !af.exclude })) : []
      // files: audiobook.audioFiles ? audiobook.audioFiles.map((af) => ({ ...af, index: ++index })) : []
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
      saving: false
    }
  },
  computed: {
    audioFiles() {
      return this.audiobook.audioFiles || []
    },
    numExcluded() {
      var count = 0
      this.files.forEach((file) => {
        if (!file.include) count++
      })
      return count
    },
    missingPartChunks() {
      if (this.missingParts === 1) return this.missingParts[0]
      var chunks = []

      var currentIndex = this.missingParts[0]
      var currentChunk = [this.missingParts[0]]

      for (let i = 1; i < this.missingParts.length; i++) {
        var partIndex = this.missingParts[i]
        if (currentIndex === partIndex - 1) {
          currentChunk.push(partIndex)
          currentIndex = partIndex
        } else {
          // console.log('Chunk ended', currentChunk.join(', '), currentIndex, partIndex)
          if (currentChunk.length === 0) {
            console.error('How is current chunk 0?', currentChunk.join(', '))
          }
          chunks.push(currentChunk)
          currentChunk = [partIndex]
          currentIndex = partIndex
        }
      }
      if (currentChunk.length) {
        chunks.push(currentChunk)
      }
      chunks = chunks.map((chunk) => {
        if (chunk.length === 1) return chunk[0]
        else return `${chunk[0]}-${chunk[chunk.length - 1]}`
      })
      return chunks
    },
    missingParts() {
      return this.audiobook.missingParts || []
    },
    invalidParts() {
      return this.audiobook.invalidParts || []
    },
    audiobookId() {
      return this.audiobook.id
    },
    title() {
      return this.book.title || 'No Title'
    },
    author() {
      return this.book.author || 'Unknown'
    },
    tracks() {
      return this.audiobook.tracks
    },
    durationPretty() {
      return this.audiobook.durationPretty
    },
    sizePretty() {
      return this.audiobook.sizePretty
    },
    book() {
      return this.audiobook.book || {}
    },
    tracks() {
      return this.audiobook.tracks || []
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    }
  },
  methods: {
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
          filename: file.filename,
          ino: file.ino,
          exclude: !file.include
        }
      })

      this.saving = true
      this.$axios
        .$patch(`/api/audiobook/${this.audiobook.id}/tracks`, { orderedFileData })
        .then((data) => {
          console.log('Finished patching files', data)
          this.saving = false
          this.$toast.success('Tracks Updated')
          this.$router.push(`/audiobook/${this.audiobookId}`)
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
  },
  mounted() {}
}
</script>

<style>
.flip-list-move {
  transition: transform 0.5s;
}
.no-move {
  transition: transform 0s;
}
.ghost {
  opacity: 0.5;
  background-color: rgba(255, 255, 255, 0.25);
}
.list-group {
  min-height: 30px;
}
.list-group-item:not(.exclude) {
  cursor: n-resize;
}
.list-group-item.exclude {
  cursor: not-allowed;
}
.list-group-item:not(.ghost):not(.exclude):hover {
  background-color: rgba(0, 0, 0, 0.1);
}
.list-group-item:nth-child(even):not(.ghost):not(.exclude) {
  background-color: rgba(0, 0, 0, 0.25);
}
.list-group-item:nth-child(even):not(.ghost):not(.exclude):hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.list-group-item.exclude:not(.ghost) {
  background-color: rgba(255, 0, 0, 0.25);
}
.list-group-item.exclude:not(.ghost):hover {
  background-color: rgba(223, 0, 0, 0.25);
}
</style>