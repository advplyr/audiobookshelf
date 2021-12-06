<template>
  <div class="w-full h-20 md:h-10 relative">
    <div class="flex md:hidden h-10 items-center">
      <nuxt-link :to="`/library/${currentLibraryId}`" class="flex-grow h-full flex justify-center items-center" :class="homePage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p>Home</p>
      </nuxt-link>
      <nuxt-link :to="`/library/${currentLibraryId}/bookshelf`" class="flex-grow h-full flex justify-center items-center" :class="showLibrary ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p>Library</p>
      </nuxt-link>
      <nuxt-link :to="`/library/${currentLibraryId}/bookshelf/series`" class="flex-grow h-full flex justify-center items-center" :class="paramId === 'series' ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p>Series</p>
      </nuxt-link>
    </div>
    <div id="toolbar" class="absolute top-10 md:top-0 left-0 w-full h-10 md:h-full z-30 flex items-center px-2 md:px-8">
      <template v-if="page !== 'search' && !isHome">
        <p v-if="!selectedSeries" class="font-book hidden md:block">{{ numShowing }} {{ entityName }}</p>
        <div v-else class="items-center hidden md:flex">
          <div @click="seriesBackArrow" class="rounded-full h-9 w-9 flex items-center justify-center hover:bg-white hover:bg-opacity-10 cursor-pointer">
            <span class="material-icons text-2xl text-white">west</span>
          </div>
          <!-- <span class="material-icons text-2xl cursor-pointer" @click="seriesBackArrow">west</span> -->
          <p class="pl-4 font-book text-lg">
            {{ selectedSeries }}
          </p>
          <div class="w-6 h-6 rounded-full bg-black bg-opacity-30 flex items-center justify-center ml-3">
            <span class="font-mono">{{ numShowing }}</span>
          </div>
        </div>
        <div class="flex-grow hidden md:inline-block" />

        <!-- <ui-text-input v-show="showSortFilters" v-model="keywordFilter" @input="keywordFilterInput" placeholder="Keyword Filter" :padding-y="1.5" clearable class="text-xs w-40 hidden md:block" /> -->
        <controls-filter-select v-show="showSortFilters" v-model="settings.filterBy" class="w-48 h-7.5 ml-4" @change="updateFilter" />
        <controls-order-select v-show="showSortFilters" v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-48 h-7.5 ml-4" @change="updateOrder" />
        <!-- <div v-show="showSortFilters" class="h-7 ml-4 flex border border-white border-opacity-25 rounded-md">
          <div class="h-full px-2 text-white flex items-center rounded-l-md hover:bg-primary hover:bg-opacity-75 cursor-pointer" :class="isGridMode ? 'bg-primary' : 'text-opacity-70'" @click="$emit('update:viewMode', 'grid')">
            <span class="material-icons" style="font-size: 1.4rem">view_module</span>
          </div>
          <div class="h-full px-2 text-white flex items-center rounded-r-md hover:bg-primary hover:bg-opacity-75 cursor-pointer" :class="!isGridMode ? 'bg-primary' : 'text-opacity-70'" @click="$emit('update:viewMode', 'list')">
            <span class="material-icons" style="font-size: 1.4rem">view_list</span>
          </div>
        </div> -->
      </template>
      <template v-else-if="page === 'search'">
        <div @click="searchBackArrow" class="rounded-full h-10 w-10 flex items-center justify-center hover:bg-white hover:bg-opacity-10 cursor-pointer">
          <span class="material-icons text-3xl text-white">west</span>
        </div>
        <!-- <p class="font-book pl-4">{{ numShowing }} showing</p> -->
        <div class="flex-grow" />
        <p>Search results for "{{ searchQuery }}"</p>
        <div class="flex-grow" />
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    page: String,
    isHome: Boolean,
    selectedSeries: String,
    searchQuery: String,
    viewMode: String
  },
  data() {
    return {
      settings: {},
      hasInit: false,
      totalEntities: 0,
      keywordFilter: null,
      keywordTimeout: null
    }
  },
  computed: {
    isGridMode() {
      return this.viewMode === 'grid'
    },
    showSortFilters() {
      return this.page === ''
    },
    numShowing() {
      return this.totalEntities
    },
    entityName() {
      if (!this.page) return 'Books'
      if (this.page === 'series') return 'Series'
      if (this.page === 'collections') return 'Collections'
      return ''
    },
    // _keywordFilter: {
    //   get() {
    //     return this.$store.state.audiobooks.keywordFilter
    //   },
    //   set(val) {
    //     this.$store.commit('audiobooks/setKeywordFilter', val)
    //   }
    // },
    paramId() {
      return this.$route.params ? this.$route.params.id || '' : ''
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    homePage() {
      return this.$route.name === 'library-library'
    },
    libraryBookshelfPage() {
      return this.$route.name === 'library-library-bookshelf-id'
    },
    showLibrary() {
      return this.libraryBookshelfPage && this.paramId === '' && !this.showingIssues
    }
  },
  methods: {
    searchBackArrow() {
      this.$router.replace(`/library/${this.currentLibraryId}/bookshelf`)
    },
    seriesBackArrow() {
      this.$router.replace(`/library/${this.currentLibraryId}/bookshelf/series`)
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
    },
    setBookshelfTotalEntities(totalEntities) {
      this.totalEntities = totalEntities
    },
    keywordFilterInput() {
      clearTimeout(this.keywordTimeout)
      this.keywordTimeout = setTimeout(() => {
        this.keywordUpdated(this.keywordFilter)
      }, 1000)
    },
    keywordUpdated() {
      this.$eventBus.$emit('bookshelf-keyword-filter', this.keywordFilter)
    }
  },
  mounted() {
    this.init()
    this.$store.commit('user/addSettingsListener', { id: 'bookshelftoolbar', meth: this.settingsUpdated })
    this.$eventBus.$on('bookshelf-total-entities', this.setBookshelfTotalEntities)
  },
  beforeDestroy() {
    this.$store.commit('user/removeSettingsListener', 'bookshelftoolbar')
    this.$eventBus.$off('bookshelf-total-entities', this.setBookshelfTotalEntities)
  }
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 6px #111111aa;
}
</style>