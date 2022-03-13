<template>
  <div @mouseover="mouseover" @mouseout="mouseout">
    <div :style="{ width: width + 'px', height: height + 'px' }" class="bg-primary box-shadow-book rounded-lg relative overflow-hidden">
      <!-- Image or placeholder -->
      <svg v-if="!imagePath" width="140%" height="140%" style="margin-left: -20%; margin-top: -20%; opacity: 0.6" viewBox="0 0 177 266" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="white" d="M40.7156 165.47C10.2694 150.865 -31.5407 148.629 -38.0532 155.529L63.3191 204.159L76.9443 190.899C66.828 181.394 54.006 171.846 40.7156 165.47Z" stroke="white" stroke-width="4" transform="translate(-2 -1)" />
        <path d="M-38.0532 155.529C-31.5407 148.629 10.2694 150.865 40.7156 165.47C54.006 171.846 66.828 181.394 76.9443 190.899L95.0391 173.37C80.6681 159.403 64.7526 149.155 51.5747 142.834C21.3549 128.337 -46.2471 114.563 -60.6897 144.67L-71.5489 167.307L44.5864 223.019L63.3191 204.159L-38.0532 155.529Z" fill="white" />
        <path
          d="M105.87 29.6508C80.857 17.6515 50.8784 28.1923 38.879 53.2056C26.8797 78.219 37.4205 108.198 62.4338 120.197C87.4472 132.196 117.426 121.656 129.425 96.6422C141.425 71.6288 130.884 41.6502 105.87 29.6508ZM106.789 85.783C112.761 73.3329 107.461 58.2599 95.0112 52.2874C82.5611 46.3148 67.4881 51.6147 61.5156 64.0648C55.543 76.5149 60.8429 91.5879 73.293 97.5604C85.7431 103.533 100.816 98.2331 106.789 85.783Z"
          fill="white"
        />
        <path
          d="M151.336 159.01L159.048 166.762L82.7048 242.703L74.973 242.683L74.9934 234.951L151.336 159.01ZM181.725 108.497C179.624 108.491 177.436 109.326 175.835 110.918L160.415 126.257L191.848 157.856L207.268 142.517C210.554 139.248 210.568 133.954 207.299 130.667L187.685 110.95C186.009 109.264 183.91 108.502 181.725 108.497ZM151.399 135.226L58.2034 227.931L58.1203 259.447L89.6359 259.53L182.831 166.825L151.399 135.226Z"
          fill="white"
        />
        <path d="M151.336 159.01L159.048 166.762L82.7048 242.703L74.973 242.683L74.9934 234.951L151.336 159.01Z" fill="white" stroke="white" stroke-width="10px" />
      </svg>
      <div v-else class="w-full h-full relative overflow-hidden rounded-lg">
        <div v-if="showCoverBg" class="cover-bg absolute" :style="{ backgroundImage: `url(${imgSrc})` }" />
        <img ref="img" :src="imgSrc" @load="imageLoaded" class="absolute top-0 left-0 h-full w-full object-contain" />
      </div>

      <!-- Author name & num books overlay -->
      <div v-show="!searching" class="absolute bottom-0 left-0 w-full py-1 bg-black bg-opacity-60 px-2">
        <p class="text-center font-semibold truncate" :style="{ fontSize: sizeMultiplier * 0.75 + 'rem' }">{{ name }}</p>
        <p class="text-center text-gray-200" :style="{ fontSize: sizeMultiplier * 0.65 + 'rem' }">{{ numBooks }} Book{{ numBooks === 1 ? '' : 's' }}</p>
      </div>

      <!-- Search icon btn -->
      <div v-show="!searching && isHovering" class="absolute top-0 right-0 p-2 cursor-pointer hover:text-white text-gray-200" @click.prevent.stop="searchAuthor">
        <span class="material-icons">search</span>
      </div>

      <!-- Loading spinner -->
      <div v-show="searching" class="absolute top-0 left-0 z-10 w-full h-full bg-black bg-opacity-50 flex items-center justify-center">
        <widgets-loading-spinner size="" />
      </div>
    </div>
  </div>
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
    }
  },
  data() {
    return {
      searching: false,
      isHovering: false,
      showCoverBg: false
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
    imagePath() {
      return this._author.imagePath || null
    },
    description() {
      return this._author.description
    },
    updatedAt() {
      return this._author.updatedAt
    },
    numBooks() {
      return this._author.numBooks || 0
    },
    imgSrc() {
      if (!this.imagePath) return null
      if (process.env.NODE_ENV !== 'production') {
        // Testing
        return `http://localhost:3333/api/authors/${this.authorId}/image?token=${this.userToken}&ts=${this.updatedAt}`
      }
      return `/api/authors/${this.authorId}/image?token=${this.userToken}&ts=${this.updatedAt}`
    },
    aspectRatio() {
      return this.height / this.width
    }
  },
  methods: {
    mouseover() {
      this.isHovering = true
    },
    mouseout() {
      this.isHovering = false
    },
    imageLoaded() {
      if (this.$refs.img) {
        var { naturalWidth, naturalHeight } = this.$refs.img
        var aspectRatio = naturalHeight / naturalWidth
        var arDiff = Math.abs(aspectRatio - this.aspectRatio)

        if (arDiff > 0.15) {
          this.showCoverBg = true
        } else {
          this.showCoverBg = false
        }
      }
    },
    async searchAuthor() {
      this.searching = true
      var response = await this.$axios.$post(`/api/authors/${this.authorId}/match`, { q: this.name }).catch((error) => {
        console.error('Failed', error)
        return null
      })
      if (!response) {
        this.$toast.error('Author not found')
      } else if (response.updated) {
        if (response.author.imagePath) this.$toast.success('Author was updated')
        else this.$toast.success('Author was updated (no image found)')
      } else {
        this.$toast.info('No updates were made for Author')
      }
      this.searching = false
    }
  },
  mounted() {}
}
</script>