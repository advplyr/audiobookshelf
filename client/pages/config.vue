<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <app-config-side-nav :is-open.sync="sideDrawerOpen" />
    <div class="configContent" :class="`page-${currentPage}`">
      <div v-show="isMobile" class="w-full pb-4 px-2 flex border-b border-white border-opacity-10 mb-2">
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
  asyncData({ store, redirect, route }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      // Non-Root user only has access to the listening stats page
      if (route.name !== 'config-stats') {
        redirect('/config/stats')
      }
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
    isMobile() {
      return this.$store.state.globals.isMobile
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentPage() {
      if (!this.$route.name) return 'Settings'
      var routeName = this.$route.name.split('-')
      if (routeName.length > 0) return routeName.slice(1).join('-')
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
.configContent.page-library-stats {
  width: 1200px;
}
@media (max-width: 1240px) {
  .configContent {
    margin-left: 176px;
  }
}
@media (max-width: 640px) {
  .configContent {
    margin-left: 0px;
    width: 100%;
    max-width: 100%;
  }
}
</style>