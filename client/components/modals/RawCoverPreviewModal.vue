<template>
  <modals-modal v-model="show" name="cover" :width="'90%'" :height="'90%'" :contentMarginTop="0">
    <div class="w-full h-full" @click="show = false">
      <img loading="lazy" :src="rawCoverUrl" class="w-full h-full z-10 object-scale-down" />
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showRawCoverPreviewModal
      },
      set(val) {
        this.$store.commit('globals/setShowRawCoverPreviewModal', val)
      }
    },
    selectedLibraryItemId() {
      return this.$store.state.globals.selectedLibraryItemId
    },
    rawCoverUrl() {
      return this.$store.getters['globals/getLibraryItemCoverSrcById'](this.selectedLibraryItemId, null, true)
    }
  },
  methods: {},
  mounted() {}
}
</script>