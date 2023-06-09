<template>
  <nuxt-link :to="`/author/${author.id}?library=${currentLibraryId}`">
    <div @mouseover="mouseover" @mouseleave="mouseleave">
      <div :style="{ width: width + 'px', height: height + 'px' }" class="bg-primary box-shadow-book rounded-md relative overflow-hidden">
        <!-- Image or placeholder -->
        <covers-author-image :author="author" />

        <!-- Author name & num books overlay -->
        <div v-show="!searching && !nameBelow" class="absolute bottom-0 left-0 w-full py-1 bg-black bg-opacity-60 px-2">
          <p class="text-center font-semibold truncate" :style="{ fontSize: sizeMultiplier * 0.75 + 'rem' }">{{ name }}</p>
          <p class="text-center text-gray-200" :style="{ fontSize: sizeMultiplier * 0.65 + 'rem' }">{{ numBooks }} Book{{ numBooks === 1 ? '' : 's' }}</p>
        </div>

        <!-- Search icon btn -->
        <div v-show="!searching && isHovering && userCanUpdate" class="absolute top-0 left-0 p-2 cursor-pointer hover:text-white text-gray-200 transform hover:scale-125 duration-150" @click.prevent.stop="searchAuthor">
          <ui-tooltip :text="$strings.ButtonQuickMatch" direction="bottom">
            <span class="material-icons text-lg">search</span>
          </ui-tooltip>
        </div>
        <div v-show="isHovering && !searching && userCanUpdate" class="absolute top-0 right-0 p-2 cursor-pointer hover:text-white text-gray-200 transform hover:scale-125 duration-150" @click.prevent.stop="$emit('edit', author)">
          <ui-tooltip :text="$strings.LabelEdit" direction="bottom">
            <span class="material-icons text-lg">edit</span>
          </ui-tooltip>
        </div>

        <!-- Loading spinner -->
        <div v-show="searching" class="absolute top-0 left-0 z-10 w-full h-full bg-black bg-opacity-50 flex items-center justify-center">
          <widgets-loading-spinner size="" />
        </div>
      </div>
      <div v-show="nameBelow" class="w-full py-1 px-2">
        <p class="text-center font-semibold truncate text-gray-200" :style="{ fontSize: sizeMultiplier * 0.75 + 'rem' }">{{ name }}</p>
      </div>
    </div>
  </nuxt-link>
</template>

<script>
export default {
  props: {
    author: {
      type: Object,
      default: () => {}
    },
    width: Number,
    height: Number,
    sizeMultiplier: {
      type: Number,
      default: 1
    },
    nameBelow: Boolean
  },
  data() {
    return {
      searching: false,
      isHovering: false
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    _author() {
      return this.author || {}
    },
    authorId() {
      return this._author.id
    },
    name() {
      return this._author.name || ''
    },
    asin() {
      return this._author.asin || ''
    },
    numBooks() {
      return this._author.numBooks || 0
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryProvider() {
      return this.$store.getters['libraries/getLibraryProvider'](this.currentLibraryId) || 'google'
    }
  },
  methods: {
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    async searchAuthor() {
      this.searching = true
      const payload = {}
      if (this.asin) payload.asin = this.asin
      else payload.q = this.name

      payload.region = 'us'
      if (this.libraryProvider.startsWith('audible.')) {
        payload.region = this.libraryProvider.split('.').pop() || 'us'
      }

      var response = await this.$axios.$post(`/api/authors/${this.authorId}/match`, payload).catch((error) => {
        console.error('Failed', error)
        return null
      })
      if (!response) {
        this.$toast.error(`Author ${this.name} not found`)
      } else if (response.updated) {
        if (response.author.imagePath) this.$toast.success(`Author ${response.author.name} was updated`)
        else this.$toast.success(`Author ${response.author.name} was updated (no image found)`)
      } else {
        this.$toast.info(`No updates were made for Author ${response.author.name}`)
      }
      this.searching = false
    },
    setSearching(isSearching) {
      this.searching = isSearching
    }
  },
  mounted() {
    this.$eventBus.$on(`searching-author-${this.authorId}`, this.setSearching)
  },
  beforeDestroy() {
    this.$eventBus.$off(`searching-author-${this.authorId}`, this.setSearching)
  }
}
</script>