<template>
  <div class="flex items-center px-4 py-2 justify-start relative hover:bg-bg" @mouseover="mouseover" @mouseleave="mouseleave">
    <div v-if="isBookIncluded" class="absolute top-0 left-0 h-full w-1 bg-success z-10" />
    <div class="w-20 max-w-20 text-center">
      <covers-collection-cover :book-items="books" :width="80" :height="40 * bookCoverAspectRatio" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    </div>
    <div class="flex-grow overflow-hidden px-2">
      <nuxt-link :to="`/collection/${collection.id}`" class="pl-2 pr-2 truncate hover:underline cursor-pointer" @click.native="clickNuxtLink">{{ collection.name }}</nuxt-link>
    </div>
    <div class="h-full flex items-center justify-end transform" :class="isHovering ? 'transition-transform translate-0 w-16' : 'translate-x-40 w-0'">
      <ui-btn v-if="!isBookIncluded" color="success" :padding-x="3" small class="h-9" @click.stop="clickAdd"><span class="material-symbols text-2xl pt-px">add</span></ui-btn>
      <ui-btn v-else color="error" :padding-x="3" class="h-9" small @click.stop="clickRem"><span class="material-symbols text-2xl pt-px">remove</span></ui-btn>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    collection: {
      type: Object,
      default: () => {}
    },
    bookCoverAspectRatio: Number
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    isBookIncluded() {
      return !!this.collection.isBookIncluded
    },
    books() {
      return this.collection.books || []
    }
  },
  methods: {
    clickNuxtLink() {
      this.$emit('close')
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    clickAdd() {
      this.$emit('add', this.collection)
    },
    clickRem() {
      this.$emit('remove', this.collection)
    }
  },
  mounted() {}
}
</script>