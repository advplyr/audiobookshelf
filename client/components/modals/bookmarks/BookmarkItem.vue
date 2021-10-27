<template>
  <div :key="bookmark.id" :id="`bookmark-row-${bookmark.id}`" class="flex items-center px-4 py-4 justify-start cursor-pointer hover:bg-bg relative" :class="highlight ? 'bg-bg bg-opacity-60' : ' bg-opacity-20'" @click="click" @mouseover="isHovering = true" @mouseleave="isHovering = false">
    <span class="material-icons" :class="highlight ? 'text-success' : 'text-white text-opacity-60'">{{ highlight ? 'bookmark' : 'bookmark_border' }}</span>
    <div class="flex-grow overflow-hidden">
      <p class="pl-2 pr-2 truncate">{{ bookmark.title }}</p>
    </div>
    <div class="h-full flex items-center w-16 justify-end">
      <span class="font-mono text-sm text-gray-300">{{ $secondsToTimestamp(bookmark.time) }}</span>
    </div>
    <div class="h-full flex items-center justify-end transform" :class="isHovering ? 'transition-transform translate-0 w-16' : 'translate-x-40 w-0'">
      <span class="material-icons text-lg mr-2 text-gray-200 hover:text-yellow-400" @click.stop="editClick">edit</span>
      <span class="material-icons text-lg text-gray-200 hover:text-error cursor-pointer" @click.stop="deleteClick">delete</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    bookmark: {
      type: Object,
      default: () => {}
    },
    highlight: Boolean
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {},
  methods: {
    click() {
      this.$emit('click', this.bookmark)
    },
    deleteClick() {
      this.$emit('delete', this.bookmark)
    },
    editClick() {
      this.$emit('edit', this.bookmark)
    }
  },
  mounted() {}
}
</script>