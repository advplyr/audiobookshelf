<template>
  <div class="pb-3e" :style="{ minWidth: cardWidth + 'px', maxWidth: cardWidth + 'px' }">
    <nuxt-link :to="`/author/${author?.id}`">
      <div cy-id="card" @mouseover="mouseover" @mouseleave="mouseleave">
        <div cy-id="imageArea" :style="{ height: cardHeight + 'px' }" class="bg-primary box-shadow-book rounded-md relative overflow-hidden">
          <!-- Image or placeholder -->
          <covers-author-image :author="author" />

          <!-- Author name & num books overlay -->
          <div cy-id="textInline" v-show="!searching && !nameBelow" class="absolute bottom-0 left-0 w-full py-1e bg-black/60 px-2e">
            <p class="text-center font-semibold truncate" :style="{ fontSize: 0.75 + 'em' }">{{ name }}</p>
            <p class="text-center text-gray-200" :style="{ fontSize: 0.65 + 'em' }">{{ numBooks }} {{ $strings.LabelBooks }}</p>
          </div>

          <!-- Search icon btn -->
          <div cy-id="match" v-show="!searching && isHovering && userCanUpdate" class="absolute top-0 left-0 p-2e cursor-pointer hover:text-white text-gray-200 transform hover:scale-125 duration-150" @click.prevent.stop="searchAuthor">
            <ui-tooltip :text="$strings.ButtonQuickMatch" direction="bottom">
              <span class="material-symbols" :style="{ fontSize: 1.125 + 'em' }">search</span>
            </ui-tooltip>
          </div>
          <div cy-id="edit" v-show="isHovering && !searching && userCanUpdate" class="absolute top-0 right-0 p-2e cursor-pointer hover:text-white text-gray-200 transform hover:scale-125 duration-150" @click.prevent.stop="$emit('edit', author)">
            <ui-tooltip :text="$strings.LabelEdit" direction="bottom">
              <span class="material-symbols" :style="{ fontSize: 1.125 + 'em' }">edit</span>
            </ui-tooltip>
          </div>

          <!-- Loading spinner -->
          <div cy-id="spinner" v-show="searching" class="absolute top-0 left-0 z-10 w-full h-full bg-black/50 flex items-center justify-center">
            <widgets-loading-spinner size="" />
          </div>
        </div>
        <div cy-id="nameBelow" v-show="nameBelow" class="w-full py-1e px-2e">
          <p class="text-center font-semibold truncate text-gray-200" :style="{ fontSize: 0.75 + 'em' }">{{ name }}</p>
        </div>
      </div>
    </nuxt-link>
  </div>
</template>

<script>
export default {
  props: {
    authorMount: {
      type: Object,
      default: () => {}
    },
    width: Number,
    height: {
      type: Number,
      default: 192
    },
    nameBelow: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      searching: false,
      isHovering: false,
      author: null
    }
  },
  computed: {
    cardWidth() {
      return this.width || this.cardHeight * 0.8
    },
    cardHeight() {
      return this.height * this.sizeMultiplier
    },
    coverHeight() {
      return this.cardHeight
    },
    _author() {
      return this.author || {}
    },
    authorId() {
      return this._author?.id || ''
    },
    name() {
      return this._author?.name || ''
    },
    asin() {
      return this._author?.asin || ''
    },
    numBooks() {
      return this._author?.numBooks || 0
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    userCanUpdate() {
      return this.store.getters['user/getUserCanUpdate']
    },
    currentLibraryId() {
      return this.store.state.libraries.currentLibraryId
    },
    libraryProvider() {
      return this.store.getters['libraries/getLibraryProvider'](this.currentLibraryId) || 'google'
    },
    sizeMultiplier() {
      return this.store.getters['user/getSizeMultiplier']
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
        this.$toast.error(this.$getString('ToastAuthorNotFound', [this.name]))
      } else if (response.updated) {
        if (response.author.imagePath) {
          this.$toast.success(this.$strings.ToastAuthorUpdateSuccess)
        } else {
          this.$toast.success(this.$strings.ToastAuthorUpdateSuccessNoImageFound)
        }
      } else {
        this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
      }
      this.searching = false
    },
    setSearching(isSearching) {
      this.searching = isSearching
    },
    setEntity(author) {
      this.removeListeners()
      this.author = author
      this.addListeners()
    },
    addListeners() {
      if (this.author) {
        this.$eventBus.$on(`searching-author-${this.authorId}`, this.setSearching)
      }
    },
    removeListeners() {
      if (this.author) {
        this.$eventBus.$off(`searching-author-${this.authorId}`, this.setSearching)
      }
    },
    destroy() {
      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      if (this.$el && this.$el.parentNode) {
        this.$el.parentNode.removeChild(this.$el)
      } else if (this.$el && this.$el.remove) {
        this.$el.remove()
      }
    },
    setSelectionMode(val) {}
  },
  mounted() {
    if (this.authorMount) this.setEntity(this.authorMount)
  },
  beforeDestroy() {
    this.removeListeners()
  }
}
</script>
