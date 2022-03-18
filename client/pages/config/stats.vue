<template>
  <div>
    <div class="flex justify-center">
      <div class="flex p-2">
        <svg class="h-14 w-14 md:h-18 md:w-18" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M19 1L14 6V17L19 12.5V1M21 5V18.5C19.9 18.15 18.7 18 17.5 18C15.8 18 13.35 18.65 12 19.5V6C10.55 4.9 8.45 4.5 6.5 4.5C4.55 4.5 2.45 4.9 1 6V20.65C1 20.9 1.25 21.15 1.5 21.15C1.6 21.15 1.65 21.1 1.75 21.1C3.1 20.45 5.05 20 6.5 20C8.45 20 10.55 20.4 12 21.5C13.35 20.65 15.8 20 17.5 20C19.15 20 20.85 20.3 22.25 21.05C22.35 21.1 22.4 21.1 22.5 21.1C22.75 21.1 23 20.85 23 20.6V6C22.4 5.55 21.75 5.25 21 5M10 18.41C8.75 18.09 7.5 18 6.5 18C5.44 18 4.18 18.19 3 18.5V7.13C3.91 6.73 5.14 6.5 6.5 6.5C7.86 6.5 9.09 6.73 10 7.13V18.41Z"
          />
        </svg>
        <div class="px-3">
          <p class="text-4xl md:text-5xl font-bold">{{ userItemsFinished.length }}</p>
          <p class="font-book text-xs md:text-sm text-white text-opacity-80">Items Finished</p>
        </div>
      </div>

      <div class="flex p-2">
        <span class="material-icons-outlined" style="font-size: 4.1rem">event</span>
        <div class="px-1">
          <p class="text-4xl md:text-5xl font-bold">{{ totalDaysListened }}</p>
          <p class="font-book text-xs md:text-sm text-white text-opacity-80">Days Listened</p>
        </div>
      </div>

      <div class="flex p-2">
        <span class="material-icons-outlined" style="font-size: 4.1rem">watch_later</span>
        <div class="px-1">
          <p class="text-4xl md:text-5xl font-bold">{{ totalMinutesListening }}</p>
          <p class="font-book text-xs md:text-sm text-white text-opacity-80">Minutes Listening</p>
        </div>
      </div>
    </div>
    <div class="flex flex-col md:flex-row">
      <stats-daily-listening-chart :listening-stats="listeningStats" />
      <div class="w-80 my-6 mx-auto">
        <h1 class="text-2xl mb-4 font-book">Recent Listening Sessions</h1>
        <p v-if="!mostRecentListeningSessions.length">No Listening Sessions</p>
        <template v-for="(item, index) in mostRecentListeningSessions">
          <div :key="item.id" class="w-full py-0.5">
            <div class="flex items-center mb-1">
              <p class="text-sm font-book text-white text-opacity-70 w-6 truncate">{{ index + 1 }}.&nbsp;</p>
              <div class="w-56">
                <p class="text-sm font-book text-white text-opacity-80 truncate">{{ item.mediaMetadata.title }}</p>
                <p class="text-xs text-white text-opacity-50">{{ $dateDistanceFromNow(item.lastUpdate) }}</p>
              </div>
              <div class="flex-grow" />
              <div class="w-18 text-right">
                <p class="text-sm font-bold">{{ $elapsedPretty(item.timeListening) }}</p>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      listeningStats: null
    }
  },
  watch: {
    currentLibraryId(newVal, oldVal) {
      if (newVal) {
        this.init()
      }
    }
  },
  computed: {
    user() {
      return this.$store.state.user.user
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    userItemProgress() {
      return this.user.libraryItemProgress || []
    },
    userItemsFinished() {
      return this.userItemProgress.filter((lip) => !!lip.isFinished)
    },
    mostRecentListeningSessions() {
      if (!this.listeningStats) return []
      return this.listeningStats.recentSessions || []
    },
    totalMinutesListening() {
      if (!this.listeningStats) return 0
      return Math.round(this.listeningStats.totalTime / 60)
    },
    totalDaysListened() {
      if (!this.listeningStats) return 0
      return Object.values(this.listeningStats.days).length
    }
  },
  methods: {
    async init() {
      this.listeningStats = await this.$axios.$get(`/api/me/listening-stats`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return []
      })
      console.log('Loaded user listening data', this.listeningStats)
    }
  },
  mounted() {
    this.init()
  }
}
</script>