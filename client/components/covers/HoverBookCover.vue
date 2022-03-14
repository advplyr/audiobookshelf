<template>
  <div ref="container" @mouseover="mouseover" @mouseleave="mouseleave" class="relative">
    <covers-book-cover :width="24" :audiobook="audiobook" />
  </div>
</template>

<script>
export default {
  props: {
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    placeholderUrl() {
      return '/book_placeholder.jpg'
    },
    fullCoverUrl() {
      return this.$store.getters['globals/getLibraryItemCoverSrc'](this.audiobook, this.placeholderUrl)
    },
    hasCover() {
      return !!this.audiobook.book.cover
    }
  },
  methods: {
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    }
  },
  mounted() {}
}
</script>