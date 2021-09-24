<template>
  <div class="w-full h-10 relative">
    <div id="toolbar" class="absolute top-0 left-0 w-full h-full z-20 flex items-center px-8">
      <p v-if="!selectedSeries" class="font-book">{{ numShowing }} {{ entityName }}</p>
      <div v-else class="flex items-center">
        <div @click="seriesBackArrow" class="rounded-full h-10 w-10 flex items-center justify-center hover:bg-white hover:bg-opacity-10 cursor-pointer">
          <span class="material-icons text-3xl text-white">west</span>
        </div>
        <!-- <span class="material-icons text-2xl cursor-pointer" @click="seriesBackArrow">west</span> -->
        <p class="pl-4 font-book text-lg">
          {{ selectedSeries }} <span class="ml-3 font-mono text-lg bg-black bg-opacity-30 rounded-lg px-1 py-0.5">{{ numShowing }}</span>
        </p>
      </div>
      <div class="flex-grow" />

      <ui-text-input v-show="showSortFilters" v-model="_keywordFilter" placeholder="Keyword Filter" :padding-y="1.5" class="text-xs w-40" />
      <controls-filter-select v-show="showSortFilters" v-model="settings.filterBy" class="w-48 h-7.5 ml-4" @change="updateFilter" />
      <controls-order-select v-show="showSortFilters" v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-48 h-7.5 ml-4" @change="updateOrder" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    page: String,
    selectedSeries: String
  },
  data() {
    return {
      settings: {},
      hasInit: false
    }
  },
  computed: {
    showSortFilters() {
      return this.page === ''
    },
    numShowing() {
      if (this.page === '') {
        return this.$store.getters['audiobooks/getFiltered']().length
      } else {
        var groups = this.$store.getters['audiobooks/getSeriesGroups']()
        if (this.selectedSeries) {
          var group = groups.find((g) => g.name === this.selectedSeries)
          if (group) return group.books.length
          return 0
        }
        return groups.length
      }
    },
    entityName() {
      if (!this.page) return 'Audiobooks'
      if (this.page === 'series') return 'Series'
      if (this.page === 'collections') return 'Collections'
      return ''
    },
    _keywordFilter: {
      get() {
        return this.$store.state.audiobooks.keywordFilter
      },
      set(val) {
        this.$store.commit('audiobooks/setKeywordFilter', val)
      }
    }
  },
  methods: {
    seriesBackArrow() {
      this.$router.replace('/library/series')
      this.$emit('update:selectedSeries', null)
    },
    updateOrder() {
      this.saveSettings()
    },
    updateFilter() {
      this.saveSettings()
    },
    saveSettings() {
      this.$store.dispatch('user/updateUserSettings', this.settings)
    },
    init() {
      this.settings = { ...this.$store.state.user.settings }
    },
    settingsUpdated(settings) {
      for (const key in settings) {
        this.settings[key] = settings[key]
      }
    }
  },
  mounted() {
    this.init()
    this.$store.commit('user/addSettingsListener', { id: 'bookshelftoolbar', meth: this.settingsUpdated })
  },
  beforeDestroy() {
    this.$store.commit('user/removeSettingsListener', 'bookshelftoolbar')
  }
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 8px #111111aa;
}
</style>