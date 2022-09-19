<template>
  <modals-modal v-model="show" name="batchQuickMatch" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 class="text-2xl">Quick Match {{ selectedBookIds.length }} Books</h1>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false
    }
  },
  computed: {
    show: {
      get() {
		  console.log("Getter")
        return this.$store.state.globals.showBatchQuickMatchModal
      },
      set(val) {
		  console.log("Setter")
        this.$store.commit('globals/setShowBatchQuickMatchModal', val)
      }
    },
    title() {
      return `${this.selectedBookIds.length} Items Selected`
    },
    showBatchQuickMatchModal() {
      return this.$store.state.globals.showBatchQuickMatchModal
    },
    selectedBookIds() {
      return this.$store.state.selectedLibraryItems || []
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
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