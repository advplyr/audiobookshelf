<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 md:px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-2 md:pr-4">Audio Tracks</p>
      <div class="h-5 md:h-7 w-5 md:w-7 rounded-full bg-white bg-opacity-10 flex items-center justify-center">
        <span class="text-sm font-mono">{{ tracks.length }}</span>
      </div>
      <!-- <span class="bg-black-400 rounded-xl py-1 px-2 text-sm font-mono">{{ tracks.length }}</span> -->
      <div class="flex-grow" />
      <ui-btn small :color="showFullPath ? 'gray-600' : 'primary'" class="mr-2 hidden md:block" @click.stop="showFullPath = !showFullPath">Full Path</ui-btn>
      <nuxt-link v-if="userCanUpdate" :to="`/audiobook/${libraryItemId}/edit`" class="mr-2 md:mr-4">
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
            <th class="w-10">#</th>
            <th class="text-left">Filename</th>
            <th class="text-left w-20">Size</th>
            <th class="text-left w-20">Duration</th>
            <th v-if="userCanDownload" class="text-center w-20">Download</th>
          </tr>
          <template v-for="track in tracks">
            <tr :key="track.index">
              <td class="text-center">
                <p>{{ track.index }}</p>
              </td>
              <td class="font-sans">{{ showFullPath ? track.metadata.path : track.metadata.filename }}</td>
              <td class="font-mono">
                {{ $bytesPretty(track.metadata.size) }}
              </td>
              <td class="font-mono">
                {{ $secondsToTimestamp(track.duration) }}
              </td>
              <td v-if="userCanDownload" class="text-center">
                <a :href="`/s/item/${libraryItemId}${$encodeUriPath(track.metadata.relPath)}?token=${userToken}`" download><span class="material-icons icon-text">download</span></a>
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
    libraryItemId: String
  },
  data() {
    return {
      showTracks: false,
      showFullPath: false
    }
  },
  computed: {
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