<template>
  <div class="flex flex-wrap justify-center mt-6">
    <div class="flex p-2">
      <span class="material-symbols text-5xl py-1">newsstand</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalItems) }}</p>
        <p class="text-xs md:text-sm text-white/80">{{ $strings.LabelStatsItemsInLibrary }}</p>
      </div>
    </div>

    <div class="flex p-2">
      <span class="material-symbols text-5xl py-1">show_chart</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalTime) }}</p>
        <p class="text-xs md:text-sm text-white/80">{{ useOverallHours ? $strings.LabelStatsOverallHours : $strings.LabelStatsOverallDays }}</p>
      </div>
    </div>

    <div v-if="isBookLibrary" class="flex p-2">
      <span class="material-symbols text-5xl py-1">person</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalAuthors) }}</p>
        <p class="text-xs md:text-sm text-white/80">{{ $strings.LabelStatsAuthors }}</p>
      </div>
    </div>

    <div class="flex p-2">
      <span class="material-symbols text-5xl pt-1">insert_drive_file</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalSizeNum) }}</p>
        <p class="text-xs md:text-sm text-white/80">{{ $strings.LabelSize }} ({{ totalSizeMod }})</p>
      </div>
    </div>

    <div class="flex p-2">
      <span class="material-symbols text-5xl pt-1">audio_file</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(numAudioTracks) }}</p>
        <p class="text-xs md:text-sm text-white/80">{{ $strings.LabelStatsAudioTracks }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryStats: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {}
  },
  computed: {
    currentLibraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    isBookLibrary() {
      return this.currentLibraryMediaType === 'book'
    },
    user() {
      return this.$store.state.user.user
    },
    totalItems() {
      return this.libraryStats?.totalItems || 0
    },
    totalAuthors() {
      return this.libraryStats?.totalAuthors || 0
    },
    numAudioTracks() {
      return this.libraryStats?.numAudioTracks || 0
    },
    totalDuration() {
      return this.libraryStats?.totalDuration || 0
    },
    totalHours() {
      return Math.round(this.totalDuration / (60 * 60))
    },
    totalSizePretty() {
      var totalSize = this.libraryStats?.totalSize || 0
      return this.$bytesPretty(totalSize, 1)
    },
    totalSizeNum() {
      return this.totalSizePretty.split(' ')[0]
    },
    totalSizeMod() {
      return this.totalSizePretty.split(' ')[1]
    },
    useOverallHours() {
      return this.totalHours < 10000
    },
    totalTime() {
      if (this.useOverallHours) return this.totalHours
      return Math.round(this.totalHours / 24)
    }
  },
  methods: {},
  mounted() {}
}
</script>
