import Vue from 'vue'
import LazyBookCard from '@/components/cards/LazyBookCard'
import LazySeriesCard from '@/components/cards/LazySeriesCard'
import LazyCollectionCard from '@/components/cards/LazyCollectionCard'
import LazyPlaylistCard from '@/components/cards/LazyPlaylistCard'
import AuthorCard from '@/components/cards/AuthorCard'

export default {
  data() {
    return {
      cardsHelpers: {
        mountEntityCard: this.mountEntityCard,
        setCardSize: this.setCardSize
      }
    }
  },
  methods: {
    getComponentClass() {
      if (this.entityName === 'series') return Vue.extend(LazySeriesCard)
      if (this.entityName === 'collections') return Vue.extend(LazyCollectionCard)
      if (this.entityName === 'playlists') return Vue.extend(LazyPlaylistCard)
      if (this.entityName === 'authors') return Vue.extend(AuthorCard)
      return Vue.extend(LazyBookCard)
    },
    getComponentName() {
      if (this.entityName === 'series') return 'cards-lazy-series-card'
      if (this.entityName === 'collections') return 'cards-lazy-collection-card'
      if (this.entityName === 'playlists') return 'cards-lazy-playlist-card'
      if (this.entityName === 'authors') return 'cards-author-card'
      return 'cards-lazy-book-card'
    },
    async setCardSize() {
      this.cardWidth = 0
      this.cardHeight = 0
      // load a dummy card to get the its width and height
      const ComponentClass = this.getComponentClass()
      const props = {
        index: -1,
        bookshelfView: this.bookshelfView,
        sortingIgnorePrefix: !!this.sortingIgnorePrefix
      }
      if (this.entityName === 'items') {
        props.filterBy = this.filterBy
        props.orderBy = this.orderBy
      } else if (this.entityName === 'series') {
        props.orderBy = this.seriesSortBy
      }
      const instance = new ComponentClass({
        propsData: props,
        parent: this
      })
      instance.$mount()
      this.resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          this.cardWidth = entry.borderBoxSize[0].inlineSize
          this.cardHeight = entry.borderBoxSize[0].blockSize
        }
        this.coverHeight = instance.coverHeight
        this.resizeObserver.disconnect()
        this.$refs.bookshelf.removeChild(instance.$el)
      })
      instance.$el.style.visibility = 'hidden'
      instance.$el.style.position = 'absolute'
      this.$refs.bookshelf.appendChild(instance.$el)
      this.resizeObserver.observe(instance.$el)
      const timeBefore = performance.now()
      await new Promise((resolve) => {
        const unwatch = this.$watch('cardWidth', (value) => {
          if (value) {
            unwatch()
            resolve()
          }
        })
      })
      const timeAfter = performance.now()
    },
    mountEntityCard(index) {
      var shelf = Math.floor(index / this.entitiesPerShelf)
      var shelfEl = document.getElementById(`shelf-${shelf}`)
      if (!shelfEl) {
        console.error('invalid shelf', shelf, 'book index', index)
        return
      }
      this.entityIndexesMounted.push(index)
      if (this.entityComponentRefs[index]) {
        const bookComponent = this.entityComponentRefs[index]
        shelfEl.appendChild(bookComponent.$el)
        if (this.isSelectionMode) {
          bookComponent.setSelectionMode(true)
          if (this.selectedMediaItems.some((i) => i.id === bookComponent.libraryItemId) || this.isSelectAll) {
            bookComponent.selected = true
          } else {
            bookComponent.selected = false
          }
        } else {
          bookComponent.setSelectionMode(false)
        }
        bookComponent.isHovering = false
        return
      }
      const ComponentClass = this.getComponentClass()

      const props = {
        index,
        bookshelfView: this.bookshelfView,
        sortingIgnorePrefix: !!this.sortingIgnorePrefix
      }

      if (this.entityName === 'items') {
        props.filterBy = this.filterBy
        props.orderBy = this.orderBy
      } else if (this.entityName === 'series') {
        props.orderBy = this.seriesSortBy
      }

      const _this = this
      const instance = new ComponentClass({
        propsData: props,
        parent: this,
        created() {
          this.$on('edit', (entity, tab) => {
            if (_this.editEntity) _this.editEntity(entity, tab)
          })
          this.$on('select', ({ entity, shiftKey }) => {
            if (_this.selectEntity) _this.selectEntity(entity, shiftKey)
          })
        }
      })
      this.entityComponentRefs[index] = instance

      instance.$mount()
      instance.$el.style.transform = this.entityTransform((index % this.entitiesPerShelf) + 1)
      instance.$el.classList.add('absolute', 'top-0', 'left-0', 'z-10')
      shelfEl.appendChild(instance.$el)

      if (this.entities[index]) {
        instance.setEntity(this.entities[index])
      }
      if (this.isSelectionMode) {
        instance.setSelectionMode(true)
        if ((instance.libraryItemId && this.selectedMediaItems.some((i) => i.id === instance.libraryItemId)) || this.isSelectAll) {
          instance.selected = true
        }
      }
    }
  }
}
