<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div v-if="!audiobooks.length" class="text-center py-8 text-lg">No Audiobooks</div>
    <template v-for="audiobook in audiobooks">
      <div :key="audiobook.id" class="w-full mb-4">
        <div class="w-full p-4 bg-primary">
          <p>Audiobook Chapters ({{ audiobook.name }})</p>
        </div>
        <div v-if="!audiobook.chapters.length" class="flex my-4 text-center justify-center text-xl">No Chapters</div>
        <table v-else class="text-sm tracksTable">
          <tr class="font-book">
            <th class="text-left w-16"><span class="px-4">Id</span></th>
            <th class="text-left">Title</th>
            <th class="text-center">Start</th>
            <th class="text-center">End</th>
          </tr>
          <tr v-for="chapter in audiobook.chapters" :key="chapter.id">
            <td class="text-left">
              <p class="px-4">{{ chapter.id }}</p>
            </td>
            <td class="font-book">
              {{ chapter.title }}
            </td>
            <td class="font-mono text-center">
              {{ $secondsToTimestamp(chapter.start) }}
            </td>
            <td class="font-mono text-center">
              {{ $secondsToTimestamp(chapter.end) }}
            </td>
          </tr>
        </table>
      </div>
    </template>
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
    audiobooks() {
      return this.media.audiobooks || []
    }
  },
  methods: {}
}
</script>