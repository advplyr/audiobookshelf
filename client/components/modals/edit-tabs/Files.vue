<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div class="mb-4">
      <template v-if="hasTracks">
        <div class="w-full bg-primary px-4 py-2 flex items-center">
          <p class="pr-4">Audio Tracks</p>
          <div class="h-7 w-7 rounded-full bg-white bg-opacity-10 flex items-center justify-center">
            <span class="text-sm font-mono">{{ tracks.length }}</span>
          </div>
          <div class="flex-grow" />
          <ui-btn small :color="showFullPath ? 'gray-600' : 'primary'" class="mr-2 hidden md:block" @click.stop="showFullPath = !showFullPath">Full Path</ui-btn>
          <nuxt-link v-if="userCanUpdate" :to="`/item/${libraryItem.id}/edit`">
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
          <template v-for="track in tracks">
            <tr :key="track.index">
              <td class="text-center">
                <p>{{ track.index }}</p>
              </td>
              <td class="font-sans">{{ showFullPath ? track.path : track.filename }}</td>
              <td class="font-mono">
                {{ $bytesPretty(track.metadata.size) }}
              </td>
              <td class="font-mono">
                {{ $secondsToTimestamp(track.duration) }}
              </td>
              <td v-if="showDownload" class="font-mono text-center">
                <a :href="`/s/item/${libraryItem.id}/${track.metadata.relPath}?token=${userToken}`" download><span class="material-icons icon-text">download</span></a>
              </td>
            </tr>
          </template>
        </table>
      </template>
      <div v-else class="flex my-4 text-center justify-center text-xl">No Audio Tracks</div>
    </div>

    <tables-library-files-table :files="libraryFiles" :library-item-id="libraryItem.id" :is-missing="isMissing" />
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      tracks: [],
      showFullPath: false
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    media() {
      return this.libraryItem.media || {}
    },
    libraryFiles() {
      return this.libraryItem.libraryFiles || []
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
      return this.libraryItem.isMissing
    },
    showDownload() {
      return this.userCanDownload && !this.isMissing
    },
    hasTracks() {
      return this.tracks.length
    }
  },
  methods: {
    init() {
      this.tracks = this.media.tracks || []
    }
  }
}
</script>