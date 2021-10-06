<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div class="flex mb-4">
      <nuxt-link v-if="userCanUpdate" :to="`/audiobook/${audiobook.id}/edit`">
        <ui-btn color="primary">Edit Track Order</ui-btn>
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
          <td class="font-book">
            {{ track.filename }}
          </td>
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
      audioFiles: null
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
          relativePath: trackPath.replace(audiobookPath)
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