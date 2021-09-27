<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-4">Other Audio Files</p>
      <span class="bg-black-400 rounded-xl py-1 px-2 text-sm font-mono">{{ files.length }}</span>
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
            <th class="text-left">Filename</th>
            <th class="text-left">Size</th>
            <th class="text-left">Duration</th>
            <th class="text-left">Notes</th>
          </tr>
          <template v-for="track in files">
            <tr :key="track.path">
              <td class="font-book pl-2">
                {{ track.filename }}<span class="text-white text-opacity-50 pl-4">({{ track.ino }})</span>
              </td>
              <td class="font-mono">
                {{ $bytesPretty(track.size) }}
              </td>
              <td class="font-mono">
                {{ $secondsToTimestamp(track.duration) }}
              </td>
              <td class="text-xs">
                <p>{{ track.error || '' }}</p>
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
    files: {
      type: Array,
      default: () => []
    },
    audiobookId: String
  },
  data() {
    return {
      showTracks: false
    }
  },
  computed: {
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