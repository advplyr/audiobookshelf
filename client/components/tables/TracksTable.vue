<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-4">Audio Tracks</p>
      <span class="bg-black-400 rounded-xl py-1 px-2 text-sm font-mono">{{ tracks.length }}</span>
      <div class="flex-grow" />
      <nuxt-link v-if="userCanUpdate" :to="`/audiobook/${audiobookId}/edit`" class="mr-4">
        <ui-btn small color="primary">Manage Tracks</ui-btn>
      </nuxt-link>
      <div class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="showTracks ? 'transform rotate-180' : ''">
        <span class="material-icons text-4xl">expand_more</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full" v-show="showTracks">
        <table class="text-sm tracksTable">
          <tr class="font-book">
            <th>#</th>
            <th class="text-left">Filename</th>
            <th class="text-left">Size</th>
            <th class="text-left">Duration</th>
            <th v-if="userCanDownload" class="text-center">Download</th>
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
              <td v-if="userCanDownload" class="text-center">
                <a :href="`/s/book/${audiobook.id}/${track.relativePath}?token=${userToken}`" download><span class="material-icons icon-text">download</span></a>
              </td>
            </tr>
          </template>
        </table>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    tracks: {
      type: Array,
      default: () => []
    },
    audiobook: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      showTracks: false
    }
  },
  computed: {
    audiobookId() {
      return this.audiobook.id
    },
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
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    }
  },
  methods: {
    clickBar() {
      this.showTracks = !this.showTracks
    }
  },
  mounted() {}
}
</script>