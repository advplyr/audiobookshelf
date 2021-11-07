<template>
  <div class="w-full bg-primary bg-opacity-40">
    <div class="w-full h-14 flex items-center px-4 bg-primary">
      <p>Collection List</p>
      <div class="w-6 h-6 bg-white bg-opacity-10 flex items-center justify-center rounded-full ml-2">
        <p class="font-mono text-sm">{{ books.length }}</p>
      </div>
      <div class="flex-grow" />
      <p v-if="totalDuration">{{ totalDurationPretty }}</p>
    </div>
    <draggable v-model="books" v-bind="dragOptions" class="list-group" handle=".drag-handle" draggable=".item" tag="div" @start="drag = true" @end="drag = false" @update="draggableUpdate">
      <transition-group type="transition" :name="!drag ? 'list-complete' : null">
        <template v-for="book in books">
          <tables-collection-book-table-row :key="book.id" :book="book" :collection-id="collectionId" class="item list-complete-item" @edit="editBook" />
        </template>
      </transition-group>
    </draggable>
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  props: {
    collectionId: String,
    books: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      drag: false,
      dragOptions: {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost'
      }
    }
  },
  computed: {
    totalDuration() {
      var _total = 0
      this.books.forEach((book) => {
        _total += book.duration
      })
      return _total
    },
    totalDurationPretty() {
      return this.$elapsedPretty(this.totalDuration)
    }
  },
  methods: {
    draggableUpdate() {},
    editBook(book) {
      var bookIds = this.books.map((b) => b.id)
      this.$store.commit('setBookshelfBookIds', bookIds)
      this.$store.commit('showEditModal', book)
    }
  },
  mounted() {}
}
</script>

<style>
.list-complete-item {
  transition: all 0.8s ease;
}

.list-complete-enter-from,
.list-complete-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.list-complete-leave-active {
  position: absolute;
}
</style>