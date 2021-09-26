<template>
  <div class="relative">
    <div class="rounded-sm h-full overflow-hidden relative" :style="{ padding: `16px ${paddingX}px` }" @mouseover="isHovering = true" @mouseleave="isHovering = false" @click="clickCard">
      <nuxt-link :to="`/library/series?${groupType}=${groupEncode}`" class="cursor-pointer">
        <div class="w-full relative" :class="isHovering ? 'bg-black-400' : 'bg-primary'" :style="{ height: height + 'px', width: height + 'px' }">
          <cards-group-cover ref="groupcover" :name="groupName" :book-items="bookItems" :width="height" :height="height" />

          <div v-if="hasValidCovers" class="bg-black bg-opacity-60 absolute top-0 left-0 w-full h-full flex items-center justify-center text-center transition-opacity" :class="isHovering ? '' : 'opacity-0'" :style="{ padding: `${sizeMultiplier}rem` }">
            <p class="font-book" :style="{ fontSize: sizeMultiplier + 'rem' }">{{ groupName }}</p>
          </div>

          <div class="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black bg-opacity-90 text-gray-300 box-shadow-book flex items-center justify-center border border-white border-opacity-25 pointer-events-none">
            <p class="font-book text-xl">{{ bookItems.length }}</p>
          </div>
          <div class="absolute bottom-0 left-0 w-full h-1 flex flex-nowrap">
            <div v-for="userProgress in userProgressItems" :key="userProgress.audiobookId" class="h-full w-full" :class="userProgress.isRead ? 'bg-success' : userProgress.progress > 0 ? 'bg-yellow-400' : ''" />
          </div>
        </div>
      </nuxt-link>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    group: {
      type: Object,
      default: () => null
    },
    width: {
      type: Number,
      default: 120
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  watch: {
    width(newVal) {
      this.$nextTick(() => {
        if (this.$refs.groupcover) {
          this.$refs.groupcover.init()
        }
      })
    }
  },
  computed: {
    _group() {
      return this.group || {}
    },
    height() {
      return this.width * 1.6
    },
    sizeMultiplier() {
      return this.width / 120
    },
    paddingX() {
      return 16 * this.sizeMultiplier
    },
    bookItems() {
      return this._group.books || []
    },
    userAudiobooks() {
      return Object.values(this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {})
    },
    userProgressItems() {
      return this.bookItems.map((item) => {
        var userAudiobook = this.userAudiobooks.find((ab) => ab.audiobookId === item.id)
        return userAudiobook || {}
      })
    },
    groupName() {
      return this._group.name || 'No Name'
    },
    groupType() {
      return this._group.type
    },
    groupEncode() {
      return this.$encode(this.groupName)
    },
    filter() {
      return `${this.groupType}.${this.$encode(this.groupName)}`
    },
    hasValidCovers() {
      var validCovers = this.bookItems.map((bookItem) => bookItem.book.cover)
      return !!validCovers.length
    }
  },
  methods: {
    clickCard() {
      this.$emit('click', this.group)
    }
  }
}
</script>