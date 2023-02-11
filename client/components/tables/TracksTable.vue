<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 md:px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-2 md:pr-4">{{ title }}</p>
      <div class="h-5 md:h-7 w-5 md:w-7 rounded-full bg-white bg-opacity-10 flex items-center justify-center">
        <span class="text-sm font-mono">{{ tracks.length }}</span>
      </div>
      <!-- <span class="bg-black-400 rounded-xl py-1 px-2 text-sm font-mono">{{ tracks.length }}</span> -->
      <div class="flex-grow" />
      <ui-btn small :color="showFullPath ? 'gray-600' : 'primary'" class="mr-2 hidden md:block" @click.stop="showFullPath = !showFullPath">{{ $strings.ButtonFullPath }}</ui-btn>
      <nuxt-link v-if="userCanUpdate && !isFile" :to="`/audiobook/${libraryItemId}/edit`" class="mr-2 md:mr-4" @mousedown.prevent>
        <ui-btn small color="primary">{{ $strings.ButtonManageTracks }}</ui-btn>
      </nuxt-link>
      <div class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="showTracks ? 'transform rotate-180' : ''">
        <span class="material-icons text-4xl">expand_more</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full" v-show="showTracks">
        <table class="text-sm tracksTable">
          <tr>
            <th class="w-10">#</th>
            <th class="text-left">{{ $strings.LabelFilename }}</th>
            <th class="text-left w-20">{{ $strings.LabelSize }}</th>
            <th class="text-left w-20">{{ $strings.LabelDuration }}</th>
            <th v-if="userCanDownload" class="text-center w-20">{{ $strings.LabelDownload }}</th>
            <th v-if="showExperimentalFeatures" class="text-center w-20">
              <div class="flex items-center">
                <p>Tone</p>
                <ui-tooltip text="Experimental feature for testing Tone library metadata scan results. Results logged in browser console." class="ml-2 w-2" direction="left">
                  <span class="material-icons-outlined text-sm">information</span>
                </ui-tooltip>
              </div>
            </th>
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
                <a :href="`${$config.routerBasePath}/s/item/${libraryItemId}/${$encodeUriPath(track.metadata.relPath).replace(/^\//, '')}?token=${userToken}`" download><span class="material-icons icon-text pt-1">download</span></a>
              </td>
              <td v-if="showExperimentalFeatures" class="text-center">
                <ui-icon-btn borderless :loading="toneProbing" icon="search" @click="toneProbe(track.index)" />
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
    title: {
      type: String,
      default: 'Audio Tracks'
    },
    tracks: {
      type: Array,
      default: () => []
    },
    libraryItemId: String,
    isFile: Boolean
  },
  data() {
    return {
      showTracks: false,
      showFullPath: false,
      toneProbing: false
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
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    }
  },
  methods: {
    clickBar() {
      this.showTracks = !this.showTracks
    },
    toneProbe(index) {
      this.toneProbing = true

      this.$axios
        .$post(`/api/items/${this.libraryItemId}/tone-scan/${index}`)
        .then((data) => {
          console.log('Tone probe data', data)
          if (data.error) {
            this.$toast.error('Tone probe error: ' + data.error)
          } else {
            this.$toast.success('Tone probe successful! Check browser console')
          }
        })
        .catch((error) => {
          console.error('Failed to tone probe', error)
          this.$toast.error('Tone probe failed')
        })
        .finally(() => {
          this.toneProbing = false
        })
    }
  },
  mounted() {}
}
</script>