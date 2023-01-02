<template>
  <div class="h-full w-full">
    <div id="viewer" class="border border-gray-100 bg-white text-black shadow-md h-screen overflow-y-auto p-4" v-html="pageHtml"></div>
  </div>
</template>

<script>
export default {
  props: {
    url: String,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      bookInfo: {},
      page: 0,
      numPages: 0,
      pageHtml: '',
      progress: 0
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    hasPrev() {
      return this.page > 0
    },
    hasNext() {
      return this.page < this.numPages - 1
    }
  },
  methods: {
    prev() {
      if (!this.hasPrev) return
      this.page--
      this.loadPage()
    },
    next() {
      if (!this.hasNext) return
      this.page++
      this.loadPage()
    },
    keyUp() {
      if ((e.keyCode || e.which) == 37) {
        this.prev()
      } else if ((e.keyCode || e.which) == 39) {
        this.next()
      }
    },
    loadPage() {
      this.$axios
        .$get(`/api/ebooks/${this.libraryItemId}/page/${this.page}?dev=${this.$isDev ? 1 : 0}`)
        .then((html) => {
          this.pageHtml = html
        })
        .catch((error) => {
          console.error('Failed to load page', error)
          this.$toast.error('Failed to load page')
        })
    },
    loadInfo() {
      this.$axios
        .$get(`/api/ebooks/${this.libraryItemId}/info?dev=${this.$isDev ? 1 : 0}`)
        .then((bookInfo) => {
          this.bookInfo = bookInfo
          this.numPages = bookInfo.pages
          this.page = 0
          this.loadPage()
        })
        .catch((error) => {
          console.error('Failed to load page', error)
          this.$toast.error('Failed to load info')
        })
    },
    initEpub() {
      if (!this.libraryItemId) return
      this.loadInfo()
    }
  },
  mounted() {
    this.initEpub()
  }
}
</script>
