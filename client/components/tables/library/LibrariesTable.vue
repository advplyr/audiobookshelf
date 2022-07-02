<template>
  <div id="librariesTable" class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
    <div class="flex items-center mb-2">
      <h1 class="text-xl">Libraries</h1>
      <div class="mx-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center" @click="clickAddLibrary">
        <span class="material-icons" style="font-size: 1.4rem">add</span>
      </div>
    </div>
    <draggable v-if="libraryCopies.length" :list="libraryCopies" v-bind="dragOptions" class="list-group" draggable=".item" tag="div" @start="startDrag" @end="endDrag">
      <template v-for="library in libraryCopies">
        <div :key="library.id" class="item">
          <tables-library-item :library="library" :selected="currentLibraryId === library.id" :dragging="drag" @edit="editLibrary" @click="setLibrary" />
        </div>
      </template>
    </draggable>
    <div v-if="!libraries.length" class="pb-4">
      <ui-btn @click="clickAddLibrary">Add your first library</ui-btn>
    </div>

    <p v-if="libraries.length" class="text-xs mt-4 text-gray-200">*<strong>Force Re-Scan</strong> will scan all files again like a fresh scan. Audio file ID3 tags, OPF files, and text files will be probed/parsed and used for book details.</p>

    <p v-if="libraries.length && libraries.some((li) => li.mediaType === 'book')" class="text-xs mt-4 text-gray-200">**<strong>Match Books</strong> will attempt to match books in library with a book from the selected search provider and fill in empty details and cover art. Does not overwrite details.</p>
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
      return this.currentLibrary ? this.currentLibrary.id : null
    },
    libraries() {
      return this.$store.getters['libraries/getSortedLibraries']()
    },
    libraryScans() {
      return this.$store.state.scanners.libraryScans
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
        this.$axios.$post('/api/libraries/order', libraryOrderData).then((libraries) => {
          if (libraries && libraries.length) {
            this.$toast.success('Library order saved', { timeout: 1500 })
            this.$store.commit('libraries/set', libraries)
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