<template>
  <div class="flex flex-wrap justify-center mt-6">
    <div class="flex p-2">
      <svg class="h-14 w-14" viewBox="0 0 24 24">
        <path fill="currentColor" d="M9 3V18H12V3H9M12 5L16 18L19 17L15 4L12 5M5 5V18H8V5H5M3 19V21H21V19H3Z" />
      </svg>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalItems) }}</p>
        <p class="text-xs md:text-sm text-white text-opacity-80">{{ $strings.LabelStatsItemsInLibrary }}</p>
      </div>
    </div>

    <div class="flex p-2">
      <span class="material-symbols text-5xl py-1">show_chart</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalTime) }}</p>
        <p class="text-xs md:text-sm text-white text-opacity-80">{{ useOverallHours ? $strings.LabelStatsOverallHours : $strings.LabelStatsOverallDays }}</p>
      </div>
    </div>

    <div v-if="isBookLibrary" class="flex p-2">
      <svg class="h-14 w-14" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17V18.1H18.1V17C18.1,16.36 14.97,14.9 12,14.9Z" />
      </svg>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalAuthors) }}</p>
        <p class="text-xs md:text-sm text-white text-opacity-80">{{ $strings.LabelStatsAuthors }}</p>
      </div>
    </div>

    <div class="flex p-2">
      <span class="material-symbols text-5xl pt-1">insert_drive_file</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(totalSizeNum) }}</p>
        <p class="text-xs md:text-sm text-white text-opacity-80">{{ $strings.LabelSize }} ({{ totalSizeMod }})</p>
      </div>
    </div>

    <div class="flex p-2">
      <span class="material-symbols text-5xl pt-1">audio_file</span>
      <div class="px-1">
        <p class="text-4.5xl leading-none font-bold">{{ $formatNumber(numAudioTracks) }}</p>
        <p class="text-xs md:text-sm text-white text-opacity-80">{{ $strings.LabelStatsAudioTracks }}</p>
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
