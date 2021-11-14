<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamAudiobook ? 'streaming' : ''">
    <app-config-side-nav :is-open.sync="sideDrawerOpen" />
    <div class="configContent" :class="`page-${currentPage}`">
      <div class="w-full pb-4 px-2 flex md:hidden border-b border-white border-opacity-10 mb-2">
        <span class="material-icons cursor-pointer" @click.stop.prevent="showMore">more_vert</span>
        <p class="pl-3 capitalize">{{ currentPage }}</p>
      </div>
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
    return {
      sideDrawerOpen: false
    }
  },
  watch: {
    currentPage: {
      handler() {
        this.sideDrawerOpen = false
      }
    }
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    currentPage() {
      if (!this.$route.name) return 'Settings'
      var routeName = this.$route.name.split('-')
      if (routeName.length > 0) return routeName[1]
      return 'Settings'
    }
  },
  methods: {
    showMore() {
      this.sideDrawerOpen = true
    },
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

<style>
.configContent {
  margin: auto;
  width: 900px;
  max-width: calc(100% - 176px);
}
.configContent.page-stats {
  width: 1200px;
}
@media (max-width: 1024px) {
  .configContent {
    margin-left: 176px;
  }
}
@media (max-width: 768px) {
  .configContent {
    margin-left: 0px;
    width: 100%;
    max-width: 100%;
  }
}
</style>