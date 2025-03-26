<template>
  <div>
    <!-- Year in review banner shown at the top in December and January -->
    <stats-year-in-review-banner v-if="showYearInReviewBanner" />

    <app-settings-content :header-text="$strings.HeaderYourStats" class="mb-4!">
      <div class="flex justify-center">
        <div class="flex p-2">
          <div class="hidden sm:block">
            <span class="hidden sm:block material-symbols text-5xl lg:text-6xl">auto_stories</span>
          </div>
          <div class="px-3">
            <p class="text-4xl md:text-5xl font-bold">{{ $formatNumber(userItemsFinished.length) }}</p>
            <p class="text-xs md:text-sm text-white/80">{{ $strings.LabelStatsItemsFinished }}</p>
          </div>
        </div>

        <div class="flex p-2">
          <div class="hidden sm:block">
            <span class="hidden sm:block material-symbols text-5xl lg:text-6xl">event</span>
          </div>
          <div class="px-1">
            <p class="text-4xl md:text-5xl font-bold">{{ $formatNumber(totalDaysListened) }}</p>
            <p class="text-xs md:text-sm text-white/80">{{ $strings.LabelStatsDaysListened }}</p>
          </div>
        </div>

        <div class="flex p-2">
          <div class="hidden sm:block">
            <span class="material-symbols text-5xl lg:text-6xl">watch_later</span>
          </div>
          <div class="px-1">
            <p class="text-4xl md:text-5xl font-bold">{{ $formatNumber(totalMinutesListening) }}</p>
            <p class="text-xs md:text-sm text-white/80">{{ $strings.LabelStatsMinutesListening }}</p>
          </div>
        </div>
      </div>
      <div class="flex flex-col md:flex-row overflow-hidden max-w-full">
        <stats-daily-listening-chart :listening-stats="listeningStats" class="origin-top-left transform scale-75 lg:scale-100" />
        <div class="w-80 my-6 mx-auto">
          <div class="flex mb-4 items-center">
            <h1 class="text-2xl">{{ $strings.HeaderStatsRecentSessions }}</h1>
            <div class="grow" />
            <ui-btn v-if="isAdminOrUp" :to="`/config/users/${user.id}/sessions`" class="text-xs" :padding-x="1.5" :padding-y="1">{{ $strings.ButtonViewAll }}</ui-btn>
          </div>
          <p v-if="!mostRecentListeningSessions.length">{{ $strings.MessageNoListeningSessions }}</p>
          <template v-for="(item, index) in mostRecentListeningSessions">
            <div :key="item.id" class="w-full py-0.5">
              <div class="flex items-center mb-1">
                <p class="text-sm text-white/70 w-8">{{ index + 1 }}.&nbsp;</p>
                <div class="w-56">
                  <p class="text-sm text-white/80 truncate">{{ item.mediaMetadata ? item.mediaMetadata.title : '' }}</p>
                  <p class="text-xs text-white/50">{{ $dateDistanceFromNow(item.updatedAt) }}</p>
                </div>
                <div class="grow" />
                <div class="w-18 text-right">
                  <p class="text-sm font-bold">{{ $elapsedPretty(item.timeListening) }}</p>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      <stats-heatmap v-if="listeningStats" :days-listening="listeningStats.days" class="my-2" />
    </app-settings-content>

    <!-- Year in review banner shown at the bottom Feb - Nov -->
    <stats-year-in-review-banner v-if="!showYearInReviewBanner" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      listeningStats: null,
      windowWidth: 0,
      showYearInReviewBanner: false
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
    isAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    user() {
      return this.$store.state.user.user
    },
    username() {
      return this.user.username
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    userMediaProgress() {
      return this.user.mediaProgress || []
    },
    userItemsFinished() {
      return this.userMediaProgress.filter((lip) => !!lip.isFinished)
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

      let month = new Date().getMonth()
      // January and December show year in review banner
      if (month === 11 || month === 0) {
        this.showYearInReviewBanner = true
      }
    }
  },
  mounted() {
    this.init()
  }
}
</script>
