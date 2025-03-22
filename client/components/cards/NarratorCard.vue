<template>
  <div>
    <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=narrators.${$encode(name)}`">
      <div cy-id="card" :style="{ width: cardWidth + 'px', height: cardHeight + 'px', fontSize: sizeMultiplier + 'rem' }" class="bg-primary box-shadow-book rounded-md relative overflow-hidden">
        <div class="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none opacity-40">
          <span class="material-symbols text-[10em]">&#xe91f;</span>
        </div>

        <!-- Narrator name & num books overlay -->
        <div class="absolute bottom-0 left-0 w-full py-1e bg-black/60 px-2e">
          <p cy-id="name" class="text-center font-semibold truncate text-gray-200" :style="{ fontSize: 0.75 + 'em' }">{{ name }}</p>
          <p cy-id="numBooks" class="text-center text-gray-200" :style="{ fontSize: 0.65 + 'em' }">{{ numBooks }} Book{{ numBooks === 1 ? '' : 's' }}</p>
        </div>
      </div>
    </nuxt-link>
  </div>
</template>

<script>
export default {
  props: {
    narrator: {
      type: Object,
      default: () => {}
    },
    width: Number,
    height: {
      type: Number,
      default: 100
    }
  },
  data() {
    return {}
  },
  computed: {
    cardWidth() {
      return this.cardHeight * 1.5
    },
    cardHeight() {
      return this.height * this.sizeMultiplier
    },
    name() {
      return this.narrator?.name || ''
    },
    numBooks() {
      return this.narrator?.numBooks || this.narrator?.books?.length || 0
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    }
  },
  methods: {}
}
</script>
