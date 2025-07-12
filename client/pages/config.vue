<template>
  <div id="page-wrapper" class="page p-2 md:p-6 overflow-y-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <app-config-side-nav :is-open.sync="sideDrawerOpen" />
    <div class="configContent" :class="`page-${currentPage}`">
      <div v-show="isMobilePortrait" class="w-full pb-4 px-2 flex border-b border-white/10 mb-2 cursor-pointer" @click.stop.prevent="toggleShowMore">
        <span class="material-symbols text-2xl cursor-pointer">arrow_forward</span>
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
    isMobilePortrait() {
      return this.$store.state.globals.isMobilePortrait
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentPage() {
      if (!this.$route.name) return this.$strings.HeaderSettings
      var routeName = this.$route.name.split('-')
      if (routeName.length > 0) {
        const pageName = routeName.slice(1).join('-')
        if (pageName === 'log') return this.$strings.HeaderLogs
        else if (pageName === 'backups') return this.$strings.HeaderBackups
        else if (pageName === 'libraries') return this.$strings.HeaderLibraries
        else if (pageName === 'notifications') return this.$strings.HeaderNotifications
        else if (pageName === 'sessions') return this.$strings.HeaderListeningSessions
        else if (pageName === 'stats') return this.$strings.HeaderYourStats
        else if (pageName === 'users') return this.$strings.HeaderUsers
        else if (pageName === 'api-keys') return this.$strings.HeaderApiKeys
        else if (pageName === 'item-metadata-utils') return this.$strings.HeaderItemMetadataUtils
        else if (pageName === 'rss-feeds') return this.$strings.HeaderRSSFeeds
        else if (pageName === 'email') return this.$strings.HeaderEmail
        else if (pageName === 'authentication') return this.$strings.HeaderAuthentication
      }
      return this.$strings.HeaderSettings
    }
  },
  methods: {
    toggleShowMore() {
      this.sideDrawerOpen = !this.sideDrawerOpen
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
