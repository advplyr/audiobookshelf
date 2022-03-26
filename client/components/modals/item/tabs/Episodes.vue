<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div class="w-full mb-4">
      <div class="w-full p-4 bg-primary">
        <p>Podcast Episodes</p>
      </div>
      <div v-if="!episodes.length" class="flex my-4 text-center justify-center text-xl">No Episodes</div>
      <table v-else class="text-sm tracksTable">
        <tr class="font-book">
          <th class="text-left w-16"><span class="px-4">#</span></th>
          <th class="text-left">Title</th>
          <th class="text-center w-28">Duration</th>
          <th class="text-center w-28">Size</th>
        </tr>
        <tr v-for="episode in episodes" :key="episode.id">
          <td class="text-left">
            <p class="px-4">{{ episode.index }}</p>
          </td>
          <td class="font-book">
            {{ episode.title }}
          </td>
          <td class="font-mono text-center">
            {{ $secondsToTimestamp(episode.duration) }}
          </td>
          <td class="font-mono text-center">
            {{ $bytesPretty(episode.size) }}
          </td>
        </tr>
      </table>
    </div>
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
    return {}
  },
  computed: {
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    episodes() {
      return this.media.episodes || []
    }
  },
  methods: {}
}
</script>