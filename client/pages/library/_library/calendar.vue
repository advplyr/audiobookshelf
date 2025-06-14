<template>
  <div class="page" :class="libraryItemIdStreaming ? 'streaming' : ''">
    <app-book-shelf-toolbar page="calendar" />

    <div id="bookshelf" class="w-full overflow-y-auto px-2 py-6 sm:px-4 md:p-12 relative">
      <div class="w-full max-w-6xl mx-auto py-4">
        <!-- Mobile Layout (stacked) -->
        <div class="block md:hidden mb-4 px-2 relative z-50">
          <div class="text-center mb-3">
            <p class="text-xl font-semibold">{{ $strings.HeaderCalendar }}</p>
          </div>

          <div class="flex items-center justify-center space-x-2 mb-3">
            <ui-btn small @click="navigateMonth(-1)" :disabled="processing" class="h-9 px-2">
              <span class="material-symbols text-lg">chevron_left</span>
            </ui-btn>

            <div class="flex items-center space-x-2 relative z-50">
              <ui-dropdown v-model="selectedMonth" :items="monthOptions" small class="w-28" @input="onMonthYearChange" :disabled="processing" />
              <ui-dropdown v-model="selectedYear" :items="yearOptions" small class="w-20" @input="onMonthYearChange" :disabled="processing" />
            </div>

            <ui-btn small @click="navigateMonth(1)" :disabled="processing" class="h-9 px-2">
              <span class="material-symbols text-lg">chevron_right</span>
            </ui-btn>
          </div>

          <div class="flex justify-center">
            <ui-btn small @click="goToToday" :disabled="processing || isCurrentMonth" class="h-9">
              {{ $strings.ButtonToday }}
            </ui-btn>
          </div>
        </div>

        <!-- Desktop Layout (single row) -->
        <div class="hidden md:flex items-center justify-between mb-4 px-4 md:px-0 relative z-50">
          <p class="text-xl font-semibold">{{ $strings.HeaderCalendar }}</p>

          <div class="flex items-center space-x-2">
            <ui-btn small @click="navigateMonth(-1)" :disabled="processing" class="h-9 px-2">
              <span class="material-symbols text-lg">chevron_left</span>
            </ui-btn>

            <div class="flex items-center space-x-2 min-w-64 relative z-50">
              <ui-dropdown v-model="selectedMonth" :items="monthOptions" small class="w-32" @input="onMonthYearChange" :disabled="processing" />
              <ui-dropdown v-model="selectedYear" :items="yearOptions" small class="w-20" @input="onMonthYearChange" :disabled="processing" />
            </div>

            <ui-btn small @click="navigateMonth(1)" :disabled="processing" class="h-9 px-2">
              <span class="material-symbols text-lg">chevron_right</span>
            </ui-btn>

            <ui-btn small @click="goToToday" :disabled="processing || isCurrentMonth" class="ml-2 h-9">
              {{ $strings.ButtonToday }}
            </ui-btn>
          </div>
        </div>

        <div v-if="processing" class="flex justify-center py-8">
          <ui-loading-indicator />
        </div>

        <div v-else class="bg-primary/25 rounded-lg overflow-hidden">
          <div class="grid grid-cols-7 bg-primary/40">
            <div v-for="day in weekDays" :key="day" class="p-2 sm:p-4 text-center font-semibold text-gray-200 border-r border-black/20 last:border-r-0">
              <span class="text-sm sm:text-base">{{ day }}</span>
            </div>
          </div>

          <div class="grid grid-cols-7">
            <div
              v-for="day in calendarDays"
              :key="`${day.date}-${day.isCurrentMonth}`"
              class="min-h-24 sm:min-h-32 border-r border-b border-black/20 last:border-r-0 relative"
              :class="{
                'bg-black/20': !day.isCurrentMonth,
                'bg-blue-600/30': day.isCurrentMonth && day.isToday,
                'bg-transparent': day.isCurrentMonth && !day.isToday
              }"
            >
              <div v-if="day.isToday" class="absolute inset-0 border-2 border-blue-500 pointer-events-none" style="z-index: 5"></div>
              <div v-if="day.isToday" class="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" style="z-index: 6"></div>
              <div class="p-1 sm:p-2 relative" style="z-index: 1">
                <span
                  class="text-xs sm:text-sm font-medium"
                  :class="{
                    'text-gray-500': !day.isCurrentMonth,
                    'text-blue-200 font-semibold': day.isCurrentMonth && day.isToday,
                    'text-gray-200': day.isCurrentMonth && !day.isToday
                  }"
                >
                  {{ day.dayNumber }}
                </span>
              </div>

              <div class="px-1 sm:px-2 pb-1 sm:pb-2 space-y-1 relative" style="z-index: 1">
                <div v-for="episode in day.episodes" :key="episode.id" @click="clickEpisode(episode)" class="p-1 rounded text-xs cursor-pointer hover:bg-white/10 transition-colors" :class="getEpisodeColorClass(episode)">
                  <div class="font-medium truncate text-xs">
                    {{ episode.podcastTitle }}
                  </div>
                  <div class="text-gray-300 truncate text-xs">
                    <span v-if="episode.season || episode.episode" class="mr-1">
                      <span v-if="episode.season">S{{ episode.season }}</span
                      ><span v-if="episode.episode">E{{ episode.episode }}</span>
                    </span>
                    {{ episode.title }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, store }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    const library = libraryData.library
    if (library.mediaType === 'book') {
      return redirect(`/library/${libraryId}`)
    }

    return {
      libraryId
    }
  },
  data() {
    return {
      currentDate: new Date(),
      episodes: [],
      processing: false,
      openingItem: false,
      selectedMonth: new Date().getMonth(),
      selectedYear: new Date().getFullYear(),
      itemColors: [
        'bg-blue-600/80',
        'bg-sky-600/80',
        'bg-cyan-600/80',
        'bg-indigo-600/80',
        'bg-green-600/80',
        'bg-emerald-600/80',
        'bg-teal-600/80',
        'bg-lime-600/80',
        'bg-purple-600/80',
        'bg-violet-600/80',
        'bg-fuchsia-600/80',
        'bg-pink-600/80',
        'bg-red-600/80',
        'bg-rose-600/80',
        'bg-orange-600/80',
        'bg-amber-600/80',
        'bg-yellow-600/80',
        'bg-yellow-500/80',
        'bg-slate-600/80',
        'bg-gray-600/80',
        'bg-zinc-600/80',
        'bg-stone-600/80',
        'bg-blue-500/80',
        'bg-green-500/80',
        'bg-purple-500/80',
        'bg-red-500/80',
        'bg-orange-500/80',
        'bg-pink-500/80',
        'bg-indigo-500/80',
        'bg-teal-500/80'
      ]
    }
  },
  computed: {
    libraryItemIdStreaming() {
      return this.$store.getters['getLibraryItemIdStreaming']
    },
    firstDayOfWeek() {
      return this.$store.state.serverSettings?.calendarFirstDayOfWeek || 0
    },
    monthOptions() {
      const monthNames = [
        this.$strings.LabelCalendarJanuary,
        this.$strings.LabelCalendarFebruary,
        this.$strings.LabelCalendarMarch,
        this.$strings.LabelCalendarApril,
        this.$strings.LabelCalendarMay,
        this.$strings.LabelCalendarJune,
        this.$strings.LabelCalendarJuly,
        this.$strings.LabelCalendarAugust,
        this.$strings.LabelCalendarSeptember,
        this.$strings.LabelCalendarOctober,
        this.$strings.LabelCalendarNovember,
        this.$strings.LabelCalendarDecember
      ]

      return monthNames.map((name, index) => ({
        text: name,
        value: index
      }))
    },
    yearOptions() {
      const currentYear = new Date().getFullYear()
      const startYear = currentYear - 10
      const endYear = currentYear + 2

      const years = []
      for (let year = endYear; year >= startYear; year--) {
        years.push({
          text: year.toString(),
          value: year
        })
      }
      return years
    },
    weekDays() {
      const allDays = [this.$strings.LabelCalendarSundayShort, this.$strings.LabelCalendarMondayShort, this.$strings.LabelCalendarTuesdayShort, this.$strings.LabelCalendarWednesdayShort, this.$strings.LabelCalendarThursdayShort, this.$strings.LabelCalendarFridayShort, this.$strings.LabelCalendarSaturdayShort]

      if (this.firstDayOfWeek === 1) {
        return [...allDays.slice(1), allDays[0]]
      }
      return allDays
    },
    isCurrentMonth() {
      const today = new Date()
      return this.currentDate.getFullYear() === today.getFullYear() && this.currentDate.getMonth() === today.getMonth()
    },
    calendarDays() {
      const year = this.currentDate.getFullYear()
      const month = this.currentDate.getMonth()

      const firstDay = new Date(year, month, 1)
      const firstCalendarDay = new Date(firstDay)

      let daysToSubtract = firstDay.getDay() - this.firstDayOfWeek
      if (daysToSubtract < 0) {
        daysToSubtract += 7
      }
      firstCalendarDay.setDate(firstCalendarDay.getDate() - daysToSubtract)

      const days = []
      const today = new Date()
      const currentDay = new Date(firstCalendarDay)

      for (let i = 0; i < 42; i++) {
        const dayKey = this.formatDateKey(currentDay)
        const dayEpisodes = this.episodes.filter((episode) => {
          if (!episode.publishedAt) return false
          const episodeDate = new Date(episode.publishedAt)
          return this.formatDateKey(episodeDate) === dayKey
        })

        days.push({
          date: new Date(currentDay),
          dayNumber: currentDay.getDate(),
          isCurrentMonth: currentDay.getMonth() === month,
          isToday: this.isSameDay(currentDay, today),
          episodes: dayEpisodes
        })

        currentDay.setDate(currentDay.getDate() + 1)
      }

      return days
    }
  },
  watch: {
    currentDate: {
      handler(newDate) {
        this.selectedMonth = newDate.getMonth()
        this.selectedYear = newDate.getFullYear()
      },
      immediate: true
    }
  },
  methods: {
    async navigateMonth(direction) {
      const newDate = new Date(this.currentDate)
      newDate.setMonth(newDate.getMonth() + direction)
      this.currentDate = newDate
      await this.loadMonthEpisodes()
    },
    async goToToday() {
      if (this.isCurrentMonth) return
      this.currentDate = new Date()
      await this.loadMonthEpisodes()
    },
    async onMonthYearChange() {
      const newDate = new Date(this.selectedYear, this.selectedMonth, 1)
      this.currentDate = newDate
      await this.loadMonthEpisodes()
    },
    async loadMonthEpisodes() {
      this.processing = true

      const year = this.currentDate.getFullYear()
      const month = this.currentDate.getMonth()
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0)

      const startDate = new Date(startOfMonth)
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date(endOfMonth)
      endDate.setDate(endDate.getDate() + 7)

      try {
        const episodePayload = await this.$axios.$get(`/api/libraries/${this.libraryId}/episodes-calendar`, {
          params: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        })

        this.episodes = episodePayload.episodes || []
      } catch (error) {
        console.error('Failed to get calendar episodes', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        this.episodes = []
      } finally {
        this.processing = false
      }
    },
    async clickEpisode(episode) {
      if (this.openingItem) return
      this.openingItem = true

      try {
        const fullLibraryItem = await this.$axios.$get(`/api/items/${episode.libraryItemId}`)
        this.$store.commit('setSelectedLibraryItem', fullLibraryItem)
        this.$store.commit('globals/setSelectedEpisode', episode)
        this.$store.commit('globals/setShowViewPodcastEpisodeModal', true)
      } catch (error) {
        console.error('Failed to get library item', error)
        this.$toast.error('Failed to get library item')
      } finally {
        this.openingItem = false
      }
    },
    formatDateKey(date) {
      return date.toISOString().split('T')[0]
    },
    isSameDay(date1, date2) {
      return this.formatDateKey(date1) === this.formatDateKey(date2)
    },
    getEpisodeColorClass(episode) {
      const podcastId = episode.podcastId || episode.libraryItemId
      const hash = this.simpleHash(podcastId)
      return this.itemColors[hash % this.itemColors.length]
    },
    simpleHash(str) {
      let hash = 0
      if (!str) return hash

      const stringToHash = str.toString()
      for (let i = 0; i < stringToHash.length; i++) {
        const char = stringToHash.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
      }
      return Math.abs(hash)
    }
  },
  mounted() {
    this.loadMonthEpisodes()
  }
}
</script>

<style scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
</style>
