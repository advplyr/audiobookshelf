<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 md:px-6 py-2 flex items-center">
      <p class="pr-2 md:pr-4">{{ $strings.HeaderDownloadQueue }}</p>
      <div class="h-5 md:h-7 w-5 md:w-7 rounded-full bg-white/10 flex items-center justify-center">
        <span class="text-sm font-mono">{{ queue.length }}</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full">
        <table class="text-sm tracksTable">
          <tr>
            <th class="text-left px-4 min-w-48">{{ $strings.LabelPodcast }}</th>
            <th class="text-left w-32 min-w-32">{{ $strings.LabelEpisode }}</th>
            <th class="text-left px-4">{{ $strings.LabelEpisodeTitle }}</th>
            <th class="text-left px-4 w-48">{{ $strings.LabelPubDate }}</th>
          </tr>
          <template v-for="downloadQueued in queue">
            <tr :key="downloadQueued.id">
              <td class="px-4">
                <div class="flex items-center">
                  <nuxt-link :to="`/item/${downloadQueued.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ downloadQueued.podcastTitle }}</nuxt-link>
                  <widgets-explicit-indicator v-if="downloadQueued.podcastExplicit" />
                </div>
              </td>
              <td>
                <div class="flex items-center">
                  <div v-if="downloadQueued.season">{{ downloadQueued.season }}x</div>
                  <div v-if="downloadQueued.episode">{{ downloadQueued.episode }}</div>
                  <widgets-podcast-type-indicator :type="downloadQueued.episodeType" />
                </div>
              </td>
              <td dir="auto" class="px-4">
                {{ downloadQueued.episodeDisplayTitle }}
              </td>
              <td class="text-xs">
                <div class="flex items-center">
                  <p>{{ $dateDistanceFromNow(downloadQueued.publishedAt) }}</p>
                </div>
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
    queue: {
      type: Array,
      default: () => []
    },
    libraryItemId: String
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script>
