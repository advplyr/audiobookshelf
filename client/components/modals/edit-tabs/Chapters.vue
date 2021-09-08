<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div v-if="!chapters.length" class="flex my-4 text-center justify-center text-xl">No Chapters</div>
    <table v-else class="text-sm tracksTable">
      <tr class="font-book">
        <th class="text-left w-16"><span class="px-4">Id</span></th>
        <th class="text-left">Title</th>
        <th class="text-center">Start</th>
        <th class="text-center">End</th>
      </tr>
      <template v-for="chapter in chapters">
        <tr :key="chapter.id">
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
      chapters: []
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
  computed: {},
  methods: {
    init() {
      this.chapters = this.audiobook.chapters || []
    }
  }
}
</script>