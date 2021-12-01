import Vue from 'vue'
import LazyBookCard from '@/components/cards/LazyBookCard'
import LazySeriesCard from '@/components/cards/LazySeriesCard'
import LazyCollectionCard from '@/components/cards/LazyCollectionCard'

export default {
  data() {
    return {
      cardsHelpers: {
        mountEntityCard: this.mountEntityCard
      }
    }
  },
  methods: {
    getComponentClass() {
      if (this.entityName === 'series') return Vue.extend(LazySeriesCard)
      if (this.entityName === 'collections') return Vue.extend(LazyCollectionCard)
      return Vue.extend(LazyBookCard)
    },
    async mountEntityCard(index) {
      var shelf = Math.floor(index / this.entitiesPerShelf)
      var shelfEl = document.getElementById(`shelf-${shelf}`)
      if (!shelfEl) {
        console.error('invalid shelf', shelf, 'book index', index)
        return
      }
      this.entityIndexesMounted.push(index)
      if (this.entityComponentRefs[index]) {
        var bookComponent = this.entityComponentRefs[index]
        shelfEl.appendChild(bookComponent.$el)
        if (this.isSelectionMode) {
          bookComponent.setSelectionMode(true)
          if (this.selectedAudiobooks.includes(bookComponent.audiobookId) || this.isSelectAll) {
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
      var shelfOffsetY = 16
      var row = index % this.entitiesPerShelf
      var shelfOffsetX = row * this.totalEntityCardWidth + this.bookshelfMarginLeft

      var ComponentClass = this.getComponentClass()

      var _this = this
      var instance = new ComponentClass({
        propsData: {
          index: index,
          width: this.entityWidth
        },
        created() {
          this.$on('edit', (entity) => {
            if (_this.editEntity) _this.editEntity(entity)
          })
          this.$on('select', (entity) => {
            if (_this.selectEntity) _this.selectEntity(entity)
          })
        }
      })
      this.entityComponentRefs[index] = instance

      instance.$mount()
      instance.$el.style.transform = `translate3d(${shelfOffsetX}px, ${shelfOffsetY}px, 0px)`
      shelfEl.appendChild(instance.$el)

      if (this.entities[index]) {
        instance.setEntity(this.entities[index])
      }
      if (this.isSelectionMode) {
        instance.setSelectionMode(true)
        if (this.selectedAudiobooks.includes(instance.audiobookId) || this.isSelectAll) {
          instance.selected = true
        }
      }
    },
  }
}