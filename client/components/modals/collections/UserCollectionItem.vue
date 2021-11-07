<template>
  <div class="flex items-center px-4 py-2 justify-start relative hover:bg-bg" :class="wrapperClass" @mouseover="mouseover" @mouseleave="mouseleave">
    <div v-if="isBookIncluded" class="absolute top-0 left-0 h-full w-1 bg-success z-10" />
    <!-- <span class="material-icons" :class="highlight ? 'text-success' : 'text-white text-opacity-80'">{{ highlight ? 'bookmark' : 'bookmark_border' }}</span> -->
    <div class="w-20 max-w-20 text-center">
      <!-- <img src="/Logo.png" /> -->
      <covers-collection-cover :book-items="books" :width="80" :height="40 * 1.6" />
    </div>
    <div class="flex-grow overflow-hidden px-2">
      <!-- <template v-if="isEditing">
        <form @submit.prevent="submitUpdate">
          <div class="flex items-center">
            <div class="flex-grow pr-2">
              <ui-text-input v-model="newBookmarkTitle" placeholder="Note" class="w-full" />
            </div>
            <ui-btn type="submit" color="success" :padding-x="4" class="h-10"><span class="material-icons -mt-px">forward</span></ui-btn>
            <div class="pl-2 flex items-center">
              <span class="material-icons text-3xl text-white text-opacity-70 hover:text-opacity-95 cursor-pointer" @click.stop.prevent="cancelEditing">close</span>
            </div>
          </div>
        </form>
      </template> -->
      <nuxt-link :to="`/collection/${collection.id}`" class="pl-2 pr-2 truncate hover:underline cursor-pointer" @click.native="clickNuxtLink">{{ collection.name }}</nuxt-link>
    </div>
    <div v-if="!isEditing" class="h-full flex items-center justify-end transform" :class="isHovering ? 'transition-transform translate-0 w-16' : 'translate-x-40 w-0'">
      <ui-btn v-if="!isBookIncluded" color="success" :padding-x="3" small class="h-9" @click.stop="clickAdd"><span class="material-icons pt-px">add</span></ui-btn>
      <ui-btn v-else color="error" :padding-x="3" class="h-9" small @click.stop="clickRem"><span class="material-icons pt-px">remove</span></ui-btn>
      <!-- <span class="material-icons text-xl mr-2 text-gray-200 hover:text-yellow-400" @click.stop="editClick">edit</span>
      <span class="material-icons text-xl text-gray-200 hover:text-error cursor-pointer" @click.stop="deleteClick">delete</span> -->
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
    highlight: Boolean
  },
  data() {
    return {
      isHovering: false,
      isEditing: false
    }
  },
  computed: {
    isBookIncluded() {
      return !!this.collection.isBookIncluded
    },
    wrapperClass() {
      var classes = []
      if (this.highlight) classes.push('bg-bg bg-opacity-60')
      if (!this.isEditing) classes.push('cursor-pointer')
      return classes.join(' ')
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
      if (this.isEditing) return
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
    },
    deleteClick() {
      if (this.isEditing) return
      this.$emit('delete', this.collection)
    },
    editClick() {
      this.isEditing = true
      this.isHovering = false
    },
    cancelEditing() {
      this.isEditing = false
    }
  },
  mounted() {}
}
</script>