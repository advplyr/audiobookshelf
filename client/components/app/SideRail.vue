<template>
  <div role="toolbar" aria-orientation="vertical" aria-label="Library Sidebar" class="w-20 bg-bg h-full fixed left-0 box-shadow-side z-50" style="min-width: 80px" :style="{ top: offsetTop + 'px' }">
    <!-- covers the shadow overlapping the bookshelf toolbar -->
    <div v-if="isShowingBookshelfToolbar" class="absolute top-0 -right-4 w-4 bg-bg h-10 pointer-events-none" />

    <nav id="siderail-buttons-container" aria-label="Library Navigation" :class="{ 'player-open': streamLibraryItem }" class="w-full overflow-y-auto overflow-x-hidden no-scroll px-2 pt-3 pb-2 flex flex-col gap-1">
      <nuxt-link v-for="item in navItems" :key="item.key" :to="item.to" :aria-current="item.active ? 'page' : null" class="nav-pill w-full min-h-16 py-2 rounded-xl flex flex-col items-center justify-center cursor-pointer" :class="[item.active ? 'is-active' : 'text-gray-400', item.danger ? 'bg-error/10 text-error/90' : '']">
        <span v-if="item.absIcon" class="nav-pill-icon abs-icons text-xl" :class="item.absIcon" />
        <span v-else class="nav-pill-icon material-symbols text-2xl" :class="{ fill: item.active }" v-html="item.icon" />
        <span class="pt-1 text-center leading-tight text-[0.72rem] font-medium tracking-wide px-0.5">{{ item.label }}</span>

        <span v-if="item.active" class="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-accent" />
        <span v-if="item.badge" class="absolute top-1.5 right-2 min-w-4 h-4 px-1 rounded-full bg-error text-white flex items-center justify-center text-[0.6rem] font-mono">{{ item.badge }}</span>
      </nuxt-link>
    </nav>

    <div class="w-full h-12 px-1 py-2 border-t border-white/5 bg-bg absolute left-0" :style="{ bottom: streamLibraryItem ? '224px' : '65px' }">
      <p class="font-mono text-xs text-center text-gray-500 hover:text-accent leading-3 mb-1 cursor-pointer transition-colors" @click="clickChangelog">v{{ $config.version }}</p>
      <a v-if="hasUpdate" :href="githubTagUrl" target="_blank" class="text-warning text-xxs text-center block leading-3">Update</a>
      <p v-else class="text-xxs text-gray-600 leading-3 text-center italic">{{ Source }}</p>
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
    },
    navItems() {
      const libPath = `/library/${this.currentLibraryId}`
      const items = [
        { key: 'home', to: libPath, icon: 'home', label: this.$strings.ButtonHome, active: this.homePage, show: true },
        { key: 'latest', to: `${libPath}/podcast/latest`, icon: '&#xe241;', label: this.$strings.ButtonLatest, active: this.isPodcastLatestPage, show: this.isPodcastLibrary },
        { key: 'library', to: `${libPath}/bookshelf`, icon: 'import_contacts', label: this.$strings.ButtonLibrary, active: this.showLibrary, show: true },
        { key: 'series', to: `${libPath}/bookshelf/series`, icon: 'view_column', label: this.$strings.ButtonSeries, active: this.isSeriesPage, show: this.isBookLibrary },
        { key: 'collections', to: `${libPath}/bookshelf/collections`, icon: '&#xe431;', label: this.$strings.ButtonCollections, active: this.paramId === 'collections', show: this.isBookLibrary },
        { key: 'playlists', to: `${libPath}/bookshelf/playlists`, icon: '&#xe03d;', label: this.$strings.ButtonPlaylists, active: this.isPlaylistsPage, show: this.showPlaylists },
        { key: 'authors', to: `${libPath}/bookshelf/authors`, icon: 'groups', label: this.$strings.ButtonAuthors, active: this.isAuthorsPage, show: this.isBookLibrary },
        { key: 'narrators', to: `${libPath}/narrators`, icon: '&#xe91f;', label: this.$strings.LabelNarrators, active: this.isNarratorsPage, show: this.isBookLibrary },
        { key: 'stats', to: `${libPath}/stats`, icon: '&#xf190;', label: this.$strings.ButtonStats, active: this.isStatsPage, show: this.isBookLibrary && this.userIsAdminOrUp },
        { key: 'podcast-search', to: `${libPath}/podcast/search`, absIcon: 'icon-podcast', label: this.$strings.ButtonAdd, active: this.isPodcastSearchPage, show: this.isPodcastLibrary && this.userIsAdminOrUp },
        { key: 'download-queue', to: `${libPath}/podcast/download-queue`, icon: '&#xf090;', label: this.$strings.ButtonDownloadQueue, active: this.isPodcastDownloadQueuePage, show: this.isPodcastLibrary && this.userIsAdminOrUp },
        { key: 'issues', to: `${libPath}/bookshelf?filter=issues`, icon: 'warning', label: this.$strings.ButtonIssues, active: this.showingIssues, show: this.numIssues > 0, danger: true, badge: this.numIssues }
      ]
      return items.filter((item) => item.show)
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
  max-height: calc(100vh - 64px - 48px - 65px);
}
#siderail-buttons-container.player-open {
  max-height: calc(100vh - 64px - 48px - 160px);
}
</style>
