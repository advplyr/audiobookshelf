<template>
  <div role="toolbar" aria-orientation="vertical" aria-label="Library Sidebar" class="w-20 bg-bg h-full fixed left-0 box-shadow-side z-50" style="min-width: 80px" :style="{ top: offsetTop + 'px' }">
    <!-- ugly little workaround to cover up the shadow overlapping the bookshelf toolbar -->
    <div v-if="isShowingBookshelfToolbar" class="absolute top-0 -right-4 w-4 bg-bg h-10 pointer-events-none" />

    <div id="siderail-buttons-container" role="navigation" aria-label="Library Navigation" :class="{ 'player-open': streamLibraryItem }" class="w-full overflow-y-auto overflow-x-hidden">
      <nuxt-link :to="`/library/${currentLibraryId}`" class="w-full h-20 flex flex-col items-center justify-center text-white border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="homePage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">home</span>

        <p class="pt-1.5 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonHome }}</p>

        <div v-show="homePage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isPodcastLibrary" :to="`/library/${currentLibraryId}/podcast/latest`" class="w-full h-20 flex flex-col items-center justify-center text-white border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isPodcastLatestPage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">&#xe241;</span>

        <p class="pt-1 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonLatest }}</p>

        <div v-show="isPodcastLatestPage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link :to="`/library/${currentLibraryId}/bookshelf`" class="w-full h-20 flex flex-col items-center justify-center text-white border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="showLibrary ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">import_contacts</span>

        <p class="pt-1.5 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonLibrary }}</p>

        <div v-show="showLibrary" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/series`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isSeriesPage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">view_column</span>

        <p class="pt-1.5 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonSeries }}</p>

        <div v-show="isSeriesPage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/collections`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="paramId === 'collections' ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">&#xe431;</span>

        <p class="pt-1.5 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonCollections }}</p>

        <div v-show="paramId === 'collections'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="showPlaylists" :to="`/library/${currentLibraryId}/bookshelf/playlists`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isPlaylistsPage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2.5xl">&#xe03d;</span>

        <p class="pt-0.5 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonPlaylists }}</p>

        <div v-show="isPlaylistsPage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/authors`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isAuthorsPage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">groups</span>

        <p class="pt-1 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonAuthors }}</p>

        <div v-show="isAuthorsPage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/narrators`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isNarratorsPage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">&#xe91f;</span>

        <p class="pt-1 text-center leading-4" style="font-size: 0.9rem">{{ $strings.LabelNarrators }}</p>

        <div v-show="isNarratorsPage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isBookLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/stats`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isStatsPage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">&#xf190;</span>

        <p class="pt-1 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonStats }}</p>

        <div v-show="isStatsPage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/search`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isPodcastSearchPage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="abs-icons icon-podcast text-xl"></span>

        <p class="pt-1.5 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonAdd }}</p>

        <div v-show="isPodcastSearchPage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/download-queue`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-primary cursor-pointer relative" :class="isPodcastDownloadQueuePage ? 'bg-primary/80' : 'bg-bg/60'">
        <span class="material-symbols text-2xl">&#xf090;</span>

        <p class="pt-1.5 text-center leading-4" style="font-size: 0.9rem">{{ $strings.ButtonDownloadQueue }}</p>

        <div v-show="isPodcastDownloadQueuePage" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <nuxt-link v-if="numIssues" :to="`/library/${currentLibraryId}/bookshelf?filter=issues`" class="w-full h-20 flex flex-col items-center justify-center text-white/80 border-b border-primary/70 hover:bg-error/40 cursor-pointer relative" :class="showingIssues ? 'bg-error/40' : 'bg-error/20'">
        <span class="material-symbols text-2xl">warning</span>

        <p class="pt-1.5 text-center leading-4" style="font-size: 1rem">{{ $strings.ButtonIssues }}</p>

        <div v-show="showingIssues" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
        <div class="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center">
          <p class="text-xs font-mono pb-0.5">{{ numIssues }}</p>
        </div>
      </nuxt-link>
    </div>

    <div class="w-full h-12 px-1 py-2 border-t border-black/20 bg-bg absolute left-0" :style="{ bottom: streamLibraryItem ? '224px' : '65px' }">
      <p class="underline font-mono text-xs text-center text-gray-300 leading-3 mb-1 cursor-pointer" @click="clickChangelog">v{{ $config.version }}</p>
      <a v-if="hasUpdate" :href="githubTagUrl" target="_blank" class="text-warning text-xxs text-center block leading-3">Update</a>
      <p v-else class="text-xxs text-gray-400 leading-3 text-center italic">{{ Source }}</p>
    </div>

    <modals-changelog-view-modal v-model="showChangelogModal" :versionData="versionData" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      showChangelogModal: false
    }
  },
  computed: {
    Source() {
      return this.$store.state.Source
    },
    isMobileLandscape() {
      return this.$store.state.globals.isMobileLandscape
    },
    isShowingBookshelfToolbar() {
      if (!this.$route.name) return false
      return this.$route.name.startsWith('library')
    },
    offsetTop() {
      return 64
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    paramId() {
      return this.$route.params ? this.$route.params.id || '' : ''
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    currentLibraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    isBookLibrary() {
      return this.currentLibraryMediaType === 'book'
    },
    isPodcastLibrary() {
      return this.currentLibraryMediaType === 'podcast'
    },
    isPodcastDownloadQueuePage() {
      return this.$route.name === 'library-library-podcast-download-queue'
    },
    isPodcastSearchPage() {
      return this.$route.name === 'library-library-podcast-search'
    },
    isPodcastLatestPage() {
      return this.$route.name === 'library-library-podcast-latest'
    },
    homePage() {
      return this.$route.name === 'library-library'
    },
    isSeriesPage() {
      return this.$route.name === 'library-library-series-id' || this.paramId === 'series'
    },
    isAuthorsPage() {
      return this.libraryBookshelfPage && this.paramId === 'authors'
    },
    isNarratorsPage() {
      return this.$route.name === 'library-library-narrators'
    },
    isPlaylistsPage() {
      return this.paramId === 'playlists'
    },
    isStatsPage() {
      return this.$route.name === 'library-library-stats'
    },
    libraryBookshelfPage() {
      return this.$route.name === 'library-library-bookshelf-id'
    },
    showLibrary() {
      return this.libraryBookshelfPage && this.paramId === '' && !this.showingIssues
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    showingIssues() {
      if (!this.$route.query) return false
      return this.libraryBookshelfPage && this.$route.query.filter === 'issues'
    },
    numIssues() {
      return this.$store.state.libraries.issues || 0
    },
    versionData() {
      return this.$store.state.versionData || {}
    },
    hasUpdate() {
      return !!this.versionData.hasUpdate
    },
    githubTagUrl() {
      return this.versionData.githubTagUrl
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    showPlaylists() {
      return this.$store.state.libraries.numUserPlaylists > 0
    }
  },
  methods: {
    clickChangelog() {
      this.showChangelogModal = true
    }
  },
  mounted() {}
}
</script>

<style>
#siderail-buttons-container {
  max-height: calc(100vh - 64px - 48px);
}
#siderail-buttons-container.player-open {
  max-height: calc(100vh - 64px - 48px - 160px);
}
</style>
