<template>
  <div>
    <draggable v-if="libraryCopies.length" :list="libraryCopies" v-bind="dragOptions" class="list-group" handle=".drag-handle" draggable=".item" tag="div" @start="startDrag" @end="endDrag">
      <template v-for="library in libraryCopies">
        <div :key="library.id" class="item">
          <tables-library-item :library="library" :selected="currentLibraryId === library.id" :dragging="drag" @edit="editLibrary" @click="setLibrary" />
        </div>
      </template>
    </draggable>
    <div v-if="!libraries.length" class="pb-4">
      <ui-btn @click="clickAddLibrary">{{ $strings.ButtonAddYourFirstLibrary }}</ui-btn>
    </div>

    <p v-if="libraries.length && libraries.some((li) => li.mediaType === 'book')" class="text-xs mt-4 text-gray-200">
      **<strong>{{ $strings.ButtonMatchBooks }}</strong> {{ $strings.MessageMatchBooksDescription }}
    </p>
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  data() {
    return {
      libraryCopies: [],
      currentOrder: [],
      drag: false,
      dragOptions: {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost'
      },
      orderTimeout: null
    }
  },
  computed: {
    currentLibrary() {
      return this.$store.getters['libraries/getCurrentLibrary']
    },
    currentLibraryId() {
      return this.currentLibrary?.id || null
    },
    libraries() {
      return this.$store.getters['libraries/getSortedLibraries']()
    }
  },
  methods: {
    startDrag() {
      this.drag = true
      clearTimeout(this.orderTimeout)
    },
    endDrag(e) {
      this.drag = false
      this.checkOrder()
    },
    checkOrder() {
      clearTimeout(this.orderTimeout)
      this.orderTimeout = setTimeout(() => {
        this.saveOrder()
      }, 500)
    },
    saveOrder() {
      var _newOrder = 1
      var currOrder = this.libraries.map((lib) => lib.id).join(',')
      var libraryOrderData = this.libraryCopies.map((library) => {
        return {
          newOrder: _newOrder++,
          oldOrder: library.displayOrder,
          id: library.id
        }
      })
      var newOrder = libraryOrderData.map((lib) => lib.id).join(',')
      if (currOrder !== newOrder) {
        this.$axios.$post('/api/libraries/order', libraryOrderData).then((response) => {
          if (response.libraries?.length) {
            this.$store.commit('libraries/set', response.libraries)
          }
        })
      }
    },
    async setLibrary(library) {
      await this.$store.dispatch('libraries/fetch', library.id)
      this.$router.push(`/library/${library.id}`)
    },
    clickAddLibrary() {
      this.$emit('showLibraryModal', null)
    },
    editLibrary(library) {
      this.$emit('showLibraryModal', library)
    },
    init() {
      this.libraryCopies = this.libraries.map((lib) => {
        return { ...lib }
      })
    },
    librariesUpdated() {
      this.init()
    }
  },
  mounted() {
    this.$store.commit('libraries/addListener', { id: 'libraries-table', meth: this.librariesUpdated })
    this.init()
  },
  beforeDestroy() {
    this.$store.commit('libraries/removeListener', 'libraries-table')
  }
}
</script>
