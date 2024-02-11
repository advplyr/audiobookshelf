<template>
  <div>
    <div v-if="sidebarOpen" class="w-full h-full overflow-y-scroll absolute inset-0 bg-black/20 z-20" @click.stop.prevent="toggleSidebar"></div>
    <div class="w-96 h-full max-h-full absolute top-0 left-0 shadow-xl transition-transform z-50 group-data-[theme=dark]:bg-primary group-data-[theme=dark]:text-white group-data-[theme=light]:bg-white group-data-[theme=light]:text-black" :class="sidebarOpen ? 'translate-x-0' : '-translate-x-96'" @click.stop.prevent>
      <div class="flex flex-col p-4 h-full">
        <div class="flex items-center mb-2">
          <button @click.stop.prevent="toggleSidebar" type="button" aria-label="Close table of contents" class="inline-flex opacity-80 hover:opacity-100">
            <span class="material-icons text-2xl">arrow_back</span>
          </button>

          <p class="text-lg font-semibold ml-2">{{ sidebarTitle }}</p>
        </div>

        <template v-if="!bookmarksOpen">
          <form @submit.prevent="searchBook">
            <ui-text-input clearable ref="input" @clear="searchBook" v-model="searchQuery" :placeholder="$strings.PlaceholderSearch" class="h-8 w-full text-sm flex mb-2" />
          </form>
        </template>
        <div class="overflow-y-auto">
          <div v-if="isSearching && !searchResults.length" class="w-full h-40 justify-center">
            <p class="text-center text-xl py-4">{{ $strings.MessageNoResults }}</p>
          </div>

          <div v-if="bookmarksOpen && !bookmarks.length" class="w-full h-40 justify-center">
            <p class="text-center text-xl py-4">{{ $strings.MessageNoBookmarks }}</p>
          </div>
          <div v-else-if="!chapters.length" class="w-full h-40 justify-center">
            <p class="text-center text-xl py-4">{{ $strings.MessageNoChapters }}</p>
          </div>

          <ul>
            <li v-for="chapter in contents" :key="chapter.id" class="py-1">
              <a :href="chapter.href" class="opacity-80 hover:opacity-100" @click.prevent="goToChapter(chapter.href)">{{ chapter.title }}</a>
              <div v-for="searchResults in chapter.searchResults" :key="searchResults.cfi" class="text-sm py-1 pl-4">
                <a :href="searchResults.cfi" class="opacity-50 hover:opacity-100" @click.prevent="goToChapter(searchResults.cfi)">{{ searchResults.excerpt }}</a>
              </div>

              <ul v-if="chapter.subitems.length">
                <li v-for="subchapter in chapter.subitems" :key="subchapter.id" class="py-1 pl-4">
                  <a :href="subchapter.href" class="opacity-80 hover:opacity-100" @click.prevent="goToChapter(subchapter.href)">{{ subchapter.title }}</a>
                  <div v-for="subChapterSearchResults in subchapter.searchResults" :key="subChapterSearchResults.cfi" class="text-sm py-1 pl-4">
                    <a :href="subChapterSearchResults.cfi" class="opacity-50 hover:opacity-100" @click.prevent="goToChapter(subChapterSearchResults.cfi)">{{ subChapterSearchResults.excerpt }}</a>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      searchQuery: '',
      isSearching: false,
      searchResults: []
    }
  },
  props: {
    sidebarOpen: false,
    bookmarksOpen: false,
    chapters: [],
    bookmarks: []
  },
  computed: {
    sidebarTitle() {
      return this.bookmarksOpen ? this.$strings.LabelYourBookmarks : this.$strings.HeaderTableOfContents
    },
    contents() {
      return !this.bookmarksOpen ? (this.isSearching ? this.searchResults : this.chapters) : this.bookmarks
    }
  },

  methods: {
    toggleSidebar() {
      this.$emit('toggle-sidebar')
    },
    goToChapter(target) {
      this.$emit('goToChapter', target)
    },
    async searchBook() {
      if (this.searchQuery.length > 1) {
        this.searchResults = await this.$parent.$refs.readerComponent.searchBook(this.searchQuery)
        this.isSearching = true
      } else {
        this.isSearching = false
        this.searchResults = []
      }
    }
  }
}
</script>