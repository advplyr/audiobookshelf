<template>
  <div class="relative">
    <div class="rounded-sm h-full relative" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }" @mouseover="mouseoverCard" @mouseleave="mouseleaveCard" @click="clickCard">
      <nuxt-link :to="groupTo" class="cursor-pointer">
        <div class="w-full h-full relative" :class="isHovering ? 'bg-black-400' : 'bg-primary'">
          <covers-group-cover ref="groupcover" :id="groupEncode" :name="groupName" :type="groupType" :book-items="bookItems" :width="cardWidth" :height="cardHeight" :book-cover-aspect-ratio="bookCoverAspectRatio" />

          <div v-if="hasValidCovers" class="bg-black bg-opacity-60 absolute top-0 left-0 w-full h-full flex items-center justify-center text-center transition-opacity z-30" :class="isHovering ? '' : 'opacity-0'" :style="{ padding: `${sizeMultiplier}rem` }">
            <p :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">{{ groupName }}</p>
          </div>

          <div class="absolute z-10 top-1.5e right-1.5e rounded-md leading-3e p-1e font-semibold text-white flex items-center justify-center" :style="{ fontSize: 0.8 + 'em' }" style="background-color: #cd9d49dd">{{ bookItems.length }}</div>
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
    width: Number,
    height: {
      type: Number,
      default: 192
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    cardWidth() {
      return this.width || this.cardHeight * 2
    },
    cardHeight() {
      return this.height * this.sizeMultiplier
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    _group() {
      return this.group || {}
    },
    groupType() {
      return this._group.type
    },
    groupTo() {
      return `/library/${this.currentLibraryId}/bookshelf?filter=${this.filter}`
    },
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    bookItems() {
      return this._group.books || []
    },
    groupName() {
      return this._group.name || 'No Name'
    },
    groupEncode() {
      return this.$encode(this.groupName)
    },
    filter() {
      return `${this.groupType}.${this.$encode(this.groupName)}`
    },
    hasValidCovers() {
      var validCovers = this.bookItems.map((bookItem) => bookItem.media.coverPath)
      return !!validCovers.length
    }
  },
  methods: {
    mouseoverCard() {
      this.isHovering = true
    },
    mouseleaveCard() {
      this.isHovering = false
    },
    clickCard() {
      this.$emit('click', this.group)
    }
  }
}
</script>
