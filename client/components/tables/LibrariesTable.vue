<template>
  <div id="librariesTable" class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
    <div class="flex items-center mb-2">
      <h1 class="text-xl">Libraries</h1>
      <div class="mx-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center" @click="clickAddLibrary">
        <span class="material-icons" style="font-size: 1.4rem">add</span>
      </div>
    </div>
    <draggable v-model="libraryCopies" v-bind="dragOptions" class="list-group" draggable=".item" tag="div" @start="startDrag" @end="endDrag">
      <!-- <transition-group type="transition" :name="!drag ? 'flip-list' : null"> -->
      <template v-for="library in libraryCopies">
        <modals-libraries-library-item :key="library.id" :library="library" :selected="currentLibraryId === library.id" :show-edit="true" :dragging="drag" @edit="editLibrary" @click="setLibrary" class="item" />
      </template>
      <!-- </transition-group> -->
    </draggable>
    <modals-edit-library-modal v-model="showLibraryModal" :library="selectedLibrary" />
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
      showLibraryModal: false,
      selectedLibrary: null,
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
    }
  },
  methods: {
    startDrag() {
      this.drag = true
      clearTimeout(this.orderTimeout)
    },
    endDrag() {
      this.drag = false
      this.checkOrder()
      console.log('DRAG END')
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
        this.$axios.$patch('/api/libraries/order', libraryOrderData).then((libraries) => {
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
      this.selectedLibrary = null
      this.showLibraryModal = true
    },
    editLibrary(library) {
      this.selectedLibrary = library
      this.showLibraryModal = true
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