<template>
  <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=narrators.${$encode(narrator.name)}`">
    <div :style="{ width: width + 'px', height: height + 'px' }" class="bg-primary box-shadow-book rounded-md relative overflow-hidden">
      <div class="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none opacity-20">
        <span class="material-icons-outlined text-8xl">record_voice_over</span>
      </div>

      <!-- Narrator name & num books overlay -->
      <div class="absolute bottom-0 left-0 w-full py-1 bg-black bg-opacity-60 px-2">
        <p class="text-center font-semibold truncate" :style="{ fontSize: sizeMultiplier * 0.75 + 'rem' }">{{ name }}</p>
        <p class="text-center text-gray-200" :style="{ fontSize: sizeMultiplier * 0.65 + 'rem' }">{{ numBooks }} Book{{ numBooks === 1 ? '' : 's' }}</p>
      </div>
    </div>
  </nuxt-link>
</template>

<script>
export default {
  props: {
    narrator: {
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
    return {}
  },
  computed: {
    name() {
      return this.narrator?.name || ''
    },
    numBooks() {
      return this.narrator?.books?.length || 0
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {}
}
</script>