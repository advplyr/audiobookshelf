<template>
  <div class="w-full h-full">
    <!-- <img :src="cover" class="w-40 h-60" /> -->
    <div class="flex">
      <cards-book-cover :audiobook="audiobook" />
      <div class="flex-grow px-8">
        <ui-text-input-with-label v-model="imageUrl" label="Image URL" />
      </div>
    </div>
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
      cover: null,
      imageUrl: null
    }
  },
  watch: {
    audiobook: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {},
  methods: {
    init() {
      this.cover = this.audiobook.cover || '/book_placeholder.jpg'
    }
  }
}
</script>