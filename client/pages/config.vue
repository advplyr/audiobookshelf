<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamAudiobook ? 'streaming' : ''">
    <app-config-side-nav />
    <div class="w-full max-w-4xl mx-auto">
      <nuxt-child />
    </div>
    <div class="fixed bottom-0 right-0 w-10 h-10" @dblclick="setDeveloperMode"></div>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsRoot']) {
      redirect('/?error=unauthorized')
    }
  },
  data() {
    return {}
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    }
  },
  methods: {
    setDeveloperMode() {
      var value = !this.$store.state.developerMode
      this.$store.commit('setDeveloperMode', value)
      this.$toast.info(`Developer Mode ${value ? 'Enabled' : 'Disabled'}`)
    }
    // saveMetadataComplete(result) {
    //   this.savingMetadata = false
    //   if (!result) return
    //   this.$toast.success(`Metadata saved for ${result.success} audiobooks`)
    // },
    // saveMetadataFiles() {
    //   this.savingMetadata = true
    //   this.$root.socket.once('save_metadata_complete', this.saveMetadataComplete)
    //   this.$root.socket.emit('save_metadata')
    // }
  },
  mounted() {}
}
</script>
