<template>
  <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=narrators.${$encode(name)}`">
    <div cy-id="card" :style="{ width: width + 'px', height: height + 'px' }" class="bg-primary box-shadow-book rounded-md relative overflow-hidden">
      <div class="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none opacity-40">
        <span class="material-icons-outlined text-[10rem]">record_voice_over</span>
      </div>

      <!-- Narrator name & num books overlay -->
      <div class="absolute bottom-0 left-0 w-full py-1 bg-black bg-opacity-60 px-2">
        <p cy-id="name" class="text-center font-semibold truncate text-gray-200" :style="{ fontSize: sizeMultiplier * 0.75 + 'rem' }">{{ name }}</p>
        <p cy-id="numBooks" class="text-center text-gray-200" :style="{ fontSize: sizeMultiplier * 0.65 + 'rem' }">{{ numBooks }} Book{{ numBooks === 1 ? '' : 's' }}</p>
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
    width:  {
      type: Number,
      default: 150
    },
    height: { 
      type: Number,
      default: 100
    },
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
      return this.narrator?.numBooks || this.narrator?.books?.length || 0
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