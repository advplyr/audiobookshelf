<template>
  <div ref="wrapper" class="w-full p-2 border border-white/10 rounded-sm">
    <div class="flex">
      <div class="w-16 min-w-16">
        <div class="w-full h-16 bg-primary">
          <img v-if="image" :src="image" class="w-full h-full object-cover" />
        </div>
        <p class="text-gray-400 text-xxs pt-1 text-center">{{ numEpisodes }} {{ $strings.HeaderEpisodes }}</p>
      </div>
      <div class="grow pl-2" :style="{ maxWidth: detailsWidth + 'px' }">
        <p class="mb-1">{{ title }}</p>
        <p class="text-xs mb-1 text-gray-300">{{ author }}</p>
        <p class="text-xs mb-2 text-gray-200">{{ description }}</p>
        <p class="text-xs truncate text-blue-200">
          {{ $strings.LabelFolder }}: <span class="font-mono">{{ folderPath }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    feed: {
      type: Object,
      default: () => {}
    },
    libraryFolderPath: String
  },
  data() {
    return {
      width: 900
    }
  },
  computed: {
    title() {
      return this.metadata.title || 'No Title'
    },
    image() {
      return this.metadata.imageUrl
    },
    description() {
      return this.metadata.description || ''
    },
    author() {
      return this.metadata.author || ''
    },
    metadata() {
      return this.feed || {}
    },
    numEpisodes() {
      return this.feed.numEpisodes || 0
    },
    folderPath() {
      if (!this.libraryFolderPath) return ''
      return `${this.libraryFolderPath}/${this.$sanitizeFilename(this.title)}`
    },
    detailsWidth() {
      return this.width - 85
    }
  },
  methods: {},
  updated() {
    this.width = this.$refs.wrapper.clientWidth
  },
  mounted() {
    this.width = this.$refs.wrapper.clientWidth
  }
}
</script>
