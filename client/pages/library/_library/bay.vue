<template>
  <div class="page overflow-hidden relative" :class="streamLibraryItem ? 'streaming' : ''">
    <!-- Fixed Toolbar -->
    <div class="w-full h-20 md:h-10 relative z-40">
      <!-- Mobile Toolbar -->
      <div class="flex md:hidden h-10 items-center">
        <app-book-shelf-toolbar page="bay" />
      </div>

      <!-- Main Toolbar Content -->
      <div id="bay-toolbar" class="absolute top-10 md:top-0 left-0 w-full h-10 md:h-full flex items-center px-2 md:px-8 bg-bg text-sm">
        <div class="flex items-center">
          <span class="material-symbols text-2xl mr-2 text-accent hidden md:block">anchor</span>
          <p class="hidden md:block font-semibold whitespace-nowrap leading-none flex items-center">The Bay <span class="bg-primary/30 text-primary-text px-1.5 py-0.5 rounded-full text-[10px] ml-2 font-mono font-bold border border-primary/20 leading-none h-4 uppercase">{{ filteredItems.length }}</span></p>
        </div>

        <div class="grow" />

        <!-- Refresh Button -->
        <ui-btn v-if="userIsAdminOrUp" :loading="refreshing" color="bg-primary" x-small class="mr-2 sm:mr-4 h-7.5 flex items-center justify-center pt-0.5" @click="refreshBay">
          <span class="material-symbols text-base mr-1.5 leading-none">refresh</span>
          <span class="hidden sm:inline leading-none">Refresh All</span>
        </ui-btn>

        <!-- Hide Owned Checkbox -->
        <div class="flex items-center mr-4 hidden sm:flex">
          <ui-checkbox v-model="hideOwned" label="Hide In Library" small />
        </div>

        <!-- Genre Dropdown -->
        <div class="w-36 sm:w-48 h-7.5 ml-1">
          <controls-sort-select v-model="selectedCategory" :items="categoryOptions" :show-descending="false" class="w-full h-full" @change="fetchItems" />
        </div>

        <!-- Search Box -->
        <div class="ml-2 sm:ml-4 h-7.5 w-36 sm:w-52 relative">
          <input v-model="searchQuery" type="text" class="w-full h-full bg-primary/60 border border-gray-500 hover:border-gray-400 rounded-sm px-2 pr-8 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400" placeholder="Search..." @keyup.enter="executeSearch" />
          <span v-if="searchQuery" class="material-symbols absolute right-2 top-1/2 -translate-y-1/2 text-sm cursor-pointer opacity-50 hover:opacity-100" @click="clearSearch">close</span>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div id="bookshelf" class="w-full overflow-y-auto px-4 md:px-8 py-6 pb-32 relative" style="height: calc(100% - 40px)">
      <div v-if="loading" class="flex justify-center py-20">
        <ui-loading-indicator />
      </div>
      
      <div v-else>
        <div v-if="filteredItems.length === 0" class="flex flex-col items-center justify-center py-20 opacity-50 text-center max-w-md mx-auto">
          <span class="material-symbols text-6xl mb-4 text-accent/50">anchor</span>
          <p class="text-xl italic mb-6 leading-relaxed">{{ message || 'The bay is empty.' }}</p>
          <div class="text-left text-[13px] space-y-3 bg-white/5 p-5 rounded-lg border border-white/10 shadow-inner">
            <p class="flex items-start"><span class="material-symbols text-sm mr-2 mt-0.5 text-accent">auto_awesome</span> <span><strong>Recommendation:</strong> Tailored discoveries based on your listening history.</span></p>
            <p class="flex items-start"><span class="material-symbols text-sm mr-2 mt-0.5 text-accent">search</span> <span><strong>Search Result:</strong> Live results from your manual search queries.</span></p>
            <p class="flex items-start"><span class="material-symbols text-sm mr-2 mt-0.5 text-accent">library_books</span> <span><strong>Genres:</strong> Browse official categories from Audible.</span></p>
            <p class="text-center pt-2 text-xs font-semibold uppercase tracking-widest text-primary-text/80">Click "Refresh All" to begin the hunt!</p>
          </div>
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-10 md:gap-x-8 md:gap-y-12">
          <div v-for="item in filteredItems" :key="item.id" class="w-full flex flex-col group">
            <div class="relative rounded-lg overflow-hidden shadow-xl bg-primary/20 aspect-3/4 transition-transform hover:scale-[1.03]">
               <img v-if="item.proxyCoverUrl" :src="item.proxyCoverUrl" class="w-full h-full object-cover" @error="item.proxyCoverUrl = null" />
               <div v-else class="w-full h-full flex items-center justify-center bg-primary/40">
                 <span class="material-symbols text-4xl opacity-20">book</span>
               </div>
               
               <!-- Owned Badge -->
               <div v-if="item.isOwned" class="absolute top-2 right-2 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                 In Library
               </div>

               <!-- Hover Overlay -->
               <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                 <p class="text-xs text-white/90 line-clamp-4 mb-4">{{ item.description || 'No description available.' }}</p>
                 
                 <template v-if="item.isOwned && item.libraryItemId">
                   <ui-btn :color="isPlaying(item) ? 'bg-error' : 'bg-success'" class="w-full mb-2" @click.stop="playPauseItem(item)">
                     <span class="material-symbols text-lg mr-2">{{ isPlaying(item) ? 'pause' : 'play_arrow' }}</span>
                     {{ isPlaying(item) ? 'Pause' : 'Play' }}
                   </ui-btn>
                 </template>
                 <template v-else>
                   <ui-btn v-if="item.downloadUrl" color="bg-accent" x-small class="w-full mb-2" @click.stop="openLink(item.downloadUrl)">
                     <span class="material-symbols text-xs mr-1">download</span>
                     Get Magnet
                   </ui-btn>
                   <ui-btn v-else color="bg-primary" x-small class="w-full mb-2" @click.stop="searchABB(item)">
                     <span class="material-symbols text-xs mr-1">search</span>
                     Search Bay
                   </ui-btn>
                 </template>
                 
                 <ui-btn color="bg-white/20" x-small class="w-full" @click.stop="findSimilar(item)">
                   <span class="material-symbols text-xs mr-1">find_replace</span>
                   Find Similar
                 </ui-btn>
               </div>
            </div>
            <div class="mt-3 px-1">
              <p class="font-semibold text-xs md:text-sm line-clamp-1 leading-tight mb-0.5" :title="item.title">{{ item.title }}</p>
              <p class="text-[11px] md:text-xs opacity-60 truncate">{{ item.author }}</p>
              <div class="flex items-center mt-1">
                <span class="text-[9px] px-1.5 py-0.5 bg-white/10 rounded-sm opacity-50 uppercase font-mono">{{ item.type || 'Discovery' }}</span>
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
  async asyncData({ params }) {
    return {
      libraryId: params.library
    }
  },
  data() {
    return {
      loading: true,
      refreshing: false,
      hideOwned: true,
      items: [],
      categories: [],
      selectedCategory: 'All',
      searchQuery: '',
      message: ''
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    filteredItems() {
      if (this.hideOwned) {
        return this.items.filter(i => !i.isOwned)
      }
      return this.items
    },
    categoryOptions() {
      const baseOptions = ['All', 'Recommendation', 'Search Result']
      const otherGenres = this.categories
        .filter(c => !baseOptions.includes(c))
        .sort((a, b) => a.localeCompare(b))
        
      const allOptions = [...baseOptions, ...otherGenres]
      return allOptions.map(c => ({ text: c, value: c }))
    }
  },
  methods: {
    clearSearch() {
      this.searchQuery = ''
      this.fetchItems()
    },
    executeSearch() {
      if (this.searchQuery) {
         this.selectedCategory = 'All' 
      }
      this.fetchItems()
    },
    async fetchItems() {
      this.loading = true
      try {
        const params = {
          category: this.selectedCategory,
          q: this.searchQuery
        }
        const data = await this.$axios.$get(`/api/libraries/${this.libraryId}/bay`, { params })
        this.items = (data.items || []).map(item => {
          if (item.coverUrl) {
            if (item.type === 'Library') {
              item.proxyCoverUrl = item.coverUrl
            } else {
              const base = this.$store.state.routerBasePath || '/audiobookshelf'
              const origin = window.location.origin
              item.proxyCoverUrl = `${origin}${base}/public/bay/cover-proxy?url=${encodeURIComponent(item.coverUrl)}`
            }
          }
          return item
        })
        this.categories = data.categories || []
        
        if (data.message && this.items.length < 5) {
          this.message = data.message
        } else {
          this.message = ''
        }
      } catch (error) {
        console.error('Failed to fetch bay items', error)
        this.$toast.error('Failed to fetch bay items')
      } finally {
        this.loading = false
      }
    },
    async refreshBay() {
      this.refreshing = true
      try {
        await this.$axios.$post(`/api/libraries/${this.libraryId}/bay/refresh`)
        this.$toast.info('Discovery refresh started in background.')
        setTimeout(() => this.fetchItems(), 5000)
      } catch (error) {
        console.error('Failed to refresh bay', error)
        this.$toast.error('Failed to refresh bay')
      } finally {
        this.refreshing = false
      }
    },
    async playPauseItem(item) {
      if (this.isStreaming(item)) {
        this.$eventBus.$emit('play-pause')
      } else {
        await this.playItem(item.libraryItemId)
      }
    },
    isStreaming(item) {
      return item.isOwned && this.$store.getters['getLibraryItemIdStreaming'] === item.libraryItemId
    },
    isPlaying(item) {
      return this.isStreaming(item) && this.$store.state.streamIsPlaying
    },
    async playItem(libraryItemId) {
      this.$eventBus.$emit('play-item', { libraryItemId })
    },
    findSimilar(item) {
      const query = encodeURIComponent(`"${item.title}" ${item.author}`)
      window.open(`https://www.audible.com/search?keywords=${query}&ipRedirectOverride=true`, '_blank')
    },
    openLink(url) {
      if (!url) return
      window.open(url, '_blank')
    },
    searchABB(item) {
      const query = encodeURIComponent(`"${item.title}"`).replace(/%20/g, '+')
      window.open(`https://audiobookbay.lu/?s=${query}`, '_blank')
    }
  },
  mounted() {
    this.fetchItems()
  }
}
</script>

<style>
#bay-toolbar {
  box-shadow: 0px 8px 6px #111111aa;
}
</style>
