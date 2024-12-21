<template>
  <div>
    <div aria-hidden="true" class="rounded-full py-1 bg-primary px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent>
      <span class="material-symbols" :class="selectedSizeIndex === 0 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="decreaseSize" aria-label="Decrease Cover Size" role="button">&#xe15b;</span>
      <p class="px-2 font-mono" style="font-size: 1rem">{{ bookCoverWidth }}</p>
      <span class="material-symbols" :class="selectedSizeIndex === availableSizes.length - 1 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="increaseSize" aria-label="Increase Cover Size" role="button">&#xe145;</span>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      selectedSizeIndex: 3,
      availableSizes: [60, 80, 100, 120, 140, 160, 180, 200, 220]
    }
  },
  watch: {
    selectedSize: {
      immediate: true,
      handler() {
        this.setSelectedIndex()
      }
    }
  },
  computed: {
    selectedSize() {
      return this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
    },
    bookCoverWidth() {
      return this.availableSizes[this.selectedSizeIndex]
    }
  },
  methods: {
    increaseSize() {
      this.selectedSizeIndex = Math.min(this.availableSizes.length - 1, this.selectedSizeIndex + 1)
      this.$store.dispatch('user/updateUserSettings', { bookshelfCoverSize: this.bookCoverWidth })
    },
    decreaseSize() {
      this.selectedSizeIndex = Math.max(0, this.selectedSizeIndex - 1)
      this.$store.dispatch('user/updateUserSettings', { bookshelfCoverSize: this.bookCoverWidth })
    },
    setSelectedIndex() {
      var sizeIndex = this.availableSizes.findIndex((s) => s === this.selectedSize)
      if (!isNaN(sizeIndex)) this.selectedSizeIndex = sizeIndex
    }
  },
  mounted() {}
}
</script>
