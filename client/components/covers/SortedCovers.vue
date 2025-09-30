// This component sorts and displays book covers based on their aspect ratio.
//  It separates covers into primary (preferred aspect ratio) and secondary (opposite aspect ratio) sections.
//  Covers are displayed with options to select, view resolution, and open in a new tab.

<template>
  <div class="flex flex-col items-center sm:max-h-80 sm:overflow-y-scroll max-w-full">
    <!-- Primary Covers Section (based on preferred aspect ratio) -->
    <div cy-id="primaryCoversSectionContainer" v-if="primaryCovers.length" class="flex items-center flex-wrap justify-center">
      <template v-for="cover in primaryCovers">
        <div :key="cover.url" class="m-0.5 mb-5 border-2 border-transparent hover:border-yellow-300 cursor-pointer" :class="cover.url === selectedCover ? 'border-yellow-300' : ''" @click="$emit('select-cover', cover.url)">
          <div class="h-24 bg-primary" :style="{ width: 96 / bookCoverAspectRatio + 'px' }">
            <covers-display-cover :cover-image="cover" :width="96 / bookCoverAspectRatio" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="true" :show-open-new-tab="true" />
          </div>
        </div>
      </template>
    </div>

    <!-- Divider only shows when there are covers in both sections -->
    <div cy-id="sortedCoversDivider" v-if="hasBothCoverTypes" class="w-full border-b border-white/10 my-4"></div>

    <!-- Secondary Covers Section (opposite aspect ratio) -->
    <div cy-id="secondaryCoversSectionContainer" v-if="secondaryCovers.length" class="flex items-center flex-wrap justify-center">
      <template v-for="cover in secondaryCovers">
        <div :key="cover.url" class="m-0.5 mb-5 border-2 border-transparent hover:border-yellow-300 cursor-pointer" :class="cover.url === selectedCover ? 'border-yellow-300' : ''" @click="$emit('select-cover', cover.url)">
          <div class="h-24 bg-primary" :style="{ width: 96 / bookCoverAspectRatio + 'px' }">
            <covers-display-cover :cover-image="cover" :width="96 / bookCoverAspectRatio" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="true" :show-open-new-tab="true" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import DisplayCover from './DisplayCover.vue'

export default {
  name: 'SortedCovers',
  components: {
    'covers-display-cover': DisplayCover
  },
  props: {
    covers: {
      type: Array,
      required: true,
      default: () => []
    },
    bookCoverAspectRatio: {
      type: Number,
      required: true
    },
    selectedCover: {
      type: String,
      default: ''
    }
  },
  computed: {
    // Sort covers by dimension and size
    sortedCovers() {
      // sort by height, then sub-sort by width
      return [...this.covers].sort((a, b) => {
        // Sort by height first, then by width
        return a.height - b.height || a.width - b.width
      })
    },
    // Get square covers (width === height)
    squareCovers() {
      return this.sortedCovers.filter((cover) => cover.width === cover.height)
    },
    // Get rectangular covers (width !== height)
    rectangleCovers() {
      return this.sortedCovers.filter((cover) => cover.width !== cover.height)
    },
    // Determine primary covers based on preferred aspect ratio
    primaryCovers() {
      return this.bookCoverAspectRatio === 1 ? this.squareCovers : this.rectangleCovers
    },
    // Determine secondary covers (opposite of primary)
    secondaryCovers() {
      return this.bookCoverAspectRatio === 1 ? this.rectangleCovers : this.squareCovers
    },
    // Check if we have both types of covers to show the divider
    hasBothCoverTypes() {
      return this.primaryCovers.length > 0 && this.secondaryCovers.length > 0
    }
  }
}
</script>

<style scoped>
/* Ensure proper height distribution */
.cover-grid-container {
  min-height: 200px;
  height: auto;
}

@media (min-width: 640px) {
  .cover-grid-container {
    max-height: calc(100vh - 400px);
  }
}
</style>
