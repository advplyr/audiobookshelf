<template>
  <div id="bookshelf" class="w-full overflow-y-auto">
    <template v-for="shelf in totalShelves">
      <div :key="shelf" class="w-full px-8 bookshelfRow relative" :id="`shelf-${shelf - 1}`" :style="{ height: shelfHeight + 'px' }">
        <div class="absolute top-0 left-0 bottom-0 p-4 z-10">
          <p class="text-white text-2xl">{{ shelf }}</p>
        </div>
        <div class="bookshelfDivider w-full absolute bottom-0 left-0 right-0 z-10" :class="`h-${shelfDividerHeightIndex}`" />
      </div>
    </template>
  </div>
</template>

<script>
import Vue from 'vue'
import LazyBookCard from '../cards/LazyBookCard'

export default {
  data() {
    return {
      initialized: false,
      bookshelfHeight: 0,
      bookshelfWidth: 0,
      shelvesPerPage: 0,
      booksPerShelf: 8,
      currentPage: 0,
      totalBooks: 0,
      books: [],
      pagesLoaded: {},
      bookIndexesMounted: [],
      bookComponentRefs: {},
      bookWidth: 120,
      pageLoadQueue: [],
      isFetchingBooks: false,
      scrollTimeout: null,
      booksPerFetch: 100,
      totalShelves: 0,
      bookshelfMarginLeft: 0
    }
  },
  computed: {
    sortBy() {
      return this.$store.getters['user/getUserSetting']('orderBy')
    },
    sortDesc() {
      return this.$store.getters['user/getUserSetting']('orderDesc')
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    bookHeight() {
      return this.bookWidth * 1.6
    },
    shelfDividerHeightIndex() {
      return 6
    },
    shelfHeight() {
      return this.bookHeight + 40
    },
    totalBookCardWidth() {
      // Includes margin
      return this.bookWidth + 24
    },
    booksPerPage() {
      return this.shelvesPerPage * this.booksPerShelf
    }
  },
  methods: {
    async fetchBooks(page = 0) {
      var startIndex = page * this.booksPerFetch

      this.isFetchingBooks = true
      var payload = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/books/all?sort=${this.sortBy}&desc=${this.sortDesc}&filter=${this.filterBy}&limit=${this.booksPerFetch}&page=${page}`).catch((error) => {
        console.error('failed to fetch books', error)
        return null
      })
      if (payload) {
        console.log('Received payload with start index', startIndex, 'pages loaded', this.pagesLoaded)
        if (!this.initialized) {
          this.initialized = true
          this.totalBooks = payload.total
          this.totalShelves = Math.ceil(this.totalBooks / this.booksPerShelf)
          this.books = new Array(this.totalBooks)
        }

        for (let i = 0; i < payload.results.length; i++) {
          var bookIndex = i + startIndex
          this.books[bookIndex] = payload.results[i]

          if (this.bookComponentRefs[bookIndex]) {
            this.bookComponentRefs[bookIndex].setBook(this.books[bookIndex])
          }
        }
      }
    },
    loadPage(page) {
      this.pagesLoaded[page] = true
      this.fetchBooks(page)
    },
    async mountBookCard(index) {
      var shelf = Math.floor(index / this.booksPerShelf)
      var shelfEl = document.getElementById(`shelf-${shelf}`)
      if (!shelfEl) {
        console.error('invalid shelf', shelf)
        return
      }
      this.bookIndexesMounted.push(index)
      if (this.bookComponentRefs[index] && !this.bookIndexesMounted.includes(index)) {
        shelfEl.appendChild(this.bookComponentRefs[index].$el)
        return
      }

      var shelfOffsetY = 16
      var row = index % this.booksPerShelf
      var shelfOffsetX = row * this.totalBookCardWidth + this.bookshelfMarginLeft

      var ComponentClass = Vue.extend(LazyBookCard)

      var _this = this
      var instance = new ComponentClass({
        propsData: {
          index: index,
          bookWidth: this.bookWidth
        },
        created() {
          // this.$on('action', (func) => {
          //   if (_this[func]) _this[func]()
          // })
        }
      })
      this.bookComponentRefs[index] = instance

      instance.$mount()
      instance.$el.style.transform = `translate3d(${shelfOffsetX}px, ${shelfOffsetY}px, 0px)`
      shelfEl.appendChild(instance.$el)

      if (this.books[index]) {
        instance.setBook(this.books[index])
      }
    },
    showHideBookPlaceholder(index, show) {
      var el = document.getElementById(`book-${index}-placeholder`)
      if (el) el.style.display = show ? 'flex' : 'none'
    },
    unmountBookCard(index) {
      if (this.bookComponentRefs[index]) {
        this.bookComponentRefs[index].detach()
      }
    },
    mountBooks(fromIndex, toIndex) {
      for (let i = fromIndex; i < toIndex; i++) {
        this.mountBookCard(i)
      }
    },
    handleScroll(scrollTop) {
      var firstShelfIndex = Math.floor(scrollTop / this.shelfHeight)
      var lastShelfIndex = Math.ceil((scrollTop + this.bookshelfHeight) / this.shelfHeight)

      var topShelfPage = Math.floor(firstShelfIndex / this.shelvesPerPage)
      var bottomShelfPage = Math.floor(lastShelfIndex / this.shelvesPerPage)
      if (!this.pagesLoaded[topShelfPage]) {
        this.loadPage(topShelfPage)
      }
      if (!this.pagesLoaded[bottomShelfPage]) {
        this.loadPage(bottomShelfPage)
      }
      console.log('Shelves in view', firstShelfIndex, 'to', lastShelfIndex)

      var firstBookIndex = firstShelfIndex * this.booksPerShelf
      var lastBookIndex = lastShelfIndex * this.booksPerShelf + this.booksPerShelf

      this.bookIndexesMounted = this.bookIndexesMounted.filter((_index) => {
        if (_index < firstBookIndex || _index >= lastBookIndex) {
          var el = document.getElementById(`book-card-${_index}`)
          if (el) el.remove()
          return false
        }
        return true
      })
      this.mountBooks(firstBookIndex, lastBookIndex)
    },
    scroll(e) {
      if (!e || !e.target) return
      var { scrollTop } = e.target
      // clearTimeout(this.scrollTimeout)
      // this.scrollTimeout = setTimeout(() => {
      this.handleScroll(scrollTop)
      // }, 250)
    },
    async init(bookshelf) {
      var { clientHeight, clientWidth } = bookshelf
      this.bookshelfHeight = clientHeight
      this.bookshelfWidth = clientWidth
      this.booksPerShelf = Math.floor((this.bookshelfWidth - 64) / this.totalBookCardWidth)
      this.shelvesPerPage = Math.ceil(this.bookshelfHeight / this.shelfHeight) + 2
      this.bookshelfMarginLeft = (this.bookshelfWidth - this.booksPerShelf * this.totalBookCardWidth) / 2
      console.log('Shelves per page', this.shelvesPerPage, 'books per page =', this.booksPerShelf * this.shelvesPerPage)

      this.pagesLoaded[0] = true
      await this.fetchBooks(0)
      var lastBookIndex = this.shelvesPerPage * this.booksPerShelf
      this.mountBooks(0, lastBookIndex)
    }
  },
  mounted() {
    var bookshelf = document.getElementById('bookshelf')
    if (bookshelf) {
      this.init(bookshelf)
      bookshelf.addEventListener('scroll', this.scroll)
    }
  },
  beforeDestroy() {
    var bookshelf = document.getElementById('bookshelf')
    if (bookshelf) {
      bookshelf.removeEventListener('scroll', this.scroll)
    }
  }
}
</script>

<style>
.bookshelfRow {
  background-image: var(--bookshelf-texture-img);
}
.bookshelfDivider {
  background: rgb(149, 119, 90);
  background: var(--bookshelf-divider-bg);
  box-shadow: 2px 14px 8px #111111aa;
}
</style>