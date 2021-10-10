<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <template v-if="hasTracks">
      <div class="w-full bg-primary px-4 py-2 flex items-center">
        <div class="h-7 w-7 rounded-full bg-white bg-opacity-10 flex items-center justify-center">
          <span class="text-sm font-mono">{{ tracks.length }}</span>
        </div>
        <div class="flex-grow" />
        <ui-btn small :color="showFullPath ? 'gray-600' : 'primary'" class="mr-2" @click.stop="showFullPath = !showFullPath">Full Path</ui-btn>
        <nuxt-link v-if="userCanUpdate" :to="`/audiobook/${audiobook.id}/edit`" class="mr-4">
          <ui-btn small color="primary">Manage Tracks</ui-btn>
        </nuxt-link>
      </div>
      <table class="text-sm tracksTable">
        <tr class="font-book">
          <th>#</th>
          <th class="text-left">Filename</th>
          <th class="text-left">Size</th>
          <th class="text-left">Duration</th>
          <th v-if="showDownload" class="text-center">Download</th>
        </tr>
        <template v-for="track in tracksCleaned">
          <tr :key="track.index">
            <td class="text-center">
              <p>{{ track.index }}</p>
            </td>
            <td class="font-sans">{{ showFullPath ? track.fullPath : track.filename }}</td>
            <td class="font-mono">
              {{ $bytesPretty(track.size) }}
            </td>
            <td class="font-mono">
              {{ $secondsToTimestamp(track.duration) }}
            </td>
            <td v-if="showDownload" class="font-mono text-center">
              <a :href="`/s/book/${audiobook.id}/${track.relativePath}?token=${userToken}`" download><span class="material-icons icon-text">download</span></a>
            </td>
          </tr>
        </template>
      </table>
    </template>
    <div v-else class="flex my-4 text-center justify-center text-xl">No Audio Tracks</div>
  </div>
</template>

<script>
export default {
  props: {
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      tracks: null,
      audioFiles: null,
      showFullPath: false
    }
  },
  watch: {
    audiobook: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    audiobookPath() {
      return this.audiobook.path
    },
    tracksCleaned() {
      return this.tracks.map((track) => {
        var trackPath = track.path.replace(/\\/g, '/')
        var audiobookPath = this.audiobookPath.replace(/\\/g, '/')

        return {
          ...track,
          relativePath: trackPath
            .replace(audiobookPath + '/', '')
            .replace(/%/g, '%25')
            .replace(/#/g, '%23')
        }
      })
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    isMissing() {
      return this.audiobook.isMissing
    },
    showDownload() {
      return this.userCanDownload && !this.isMissing
    },
    hasTracks() {
      return this.audiobook.tracks.length
    }
  },
  methods: {
    init() {
      this.audioFiles = this.audiobook.audioFiles
      this.tracks = this.audiobook.tracks
    }
  }
}
</script>