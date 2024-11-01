<template>
  <div class="flex items-center px-4 py-4 justify-start relative bg-primary hover:bg-opacity-25" :class="wrapperClass" @click.stop="click" @mouseover="mouseover" @mouseleave="mouseleave">
    <div class="w-16 max-w-16 text-center">
      <p class="text-sm font-mono text-gray-400">
        {{ this.$secondsToTimestamp(bookmark.time) }}
      </p>
    </div>
    <div class="flex-grow overflow-hidden px-2">
      <template v-if="isEditing">
        <form @submit.prevent="submitUpdate">
          <div class="flex items-center">
            <div class="flex-grow pr-2">
              <ui-text-input v-model="newBookmarkTitle" placeholder="Note" class="w-full" />
            </div>
            <ui-btn type="submit" color="success" :padding-x="4" class="h-10"><span class="material-symbols text-2xl -mt-px">forward</span></ui-btn>
            <div class="pl-2 flex items-center">
              <span class="material-symbols text-3xl text-white text-opacity-70 hover:text-opacity-95 cursor-pointer" @click.stop.prevent="cancelEditing">close</span>
            </div>
          </div>
        </form>
      </template>
      <p v-else class="pl-2 pr-2 truncate">{{ bookmark.title }}</p>
    </div>
    <div v-if="!isEditing" class="h-full flex items-center justify-end transform" :class="isHovering ? 'transition-transform translate-0 w-16' : 'translate-x-40 w-0'">
      <span class="material-symbols text-xl mr-2 text-gray-200 hover:text-yellow-400" @click.stop="editClick">edit</span>
      <span class="material-symbols text-xl text-gray-200 hover:text-error cursor-pointer" @click.stop="deleteClick">delete</span>
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
      isHovering: false,
      isEditing: false,
      newBookmarkTitle: null
    }
  },
  computed: {
    wrapperClass() {
      var classes = []
      if (this.highlight) classes.push('bg-bg bg-opacity-60')
      if (!this.isEditing) classes.push('cursor-pointer')
      return classes.join(' ')
    }
  },
  methods: {
    mouseover() {
      if (this.isEditing) return
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    click(e) {
      if (this.isEditing) {
        if (e) e.stopPropagation()
        return
      }
      this.$emit('click', this.bookmark)
    },
    deleteClick() {
      if (this.isEditing) return
      this.$emit('delete', this.bookmark)
    },
    editClick() {
      this.newBookmarkTitle = this.bookmark.title
      this.isEditing = true
      this.isHovering = false
    },
    cancelEditing() {
      this.isEditing = false
    },
    submitUpdate() {
      if (this.newBookmarkTitle === this.bookmark.title) {
        return this.cancelEditing()
      }
      var bookmark = { ...this.bookmark }
      bookmark.title = this.newBookmarkTitle
      this.$emit('update', bookmark)
    }
  },
  mounted() {}
}
</script>