<template>
  <div role="toolbar" aria-orientation="vertical" aria-label="Config Sidebar">
    <div role="navigation" aria-label="Config Navigation" class="w-44 fixed left-0 top-16 bg-bg/100 md:bg-bg/70 shadow-lg border-r border-white/5 py-3 transform transition-transform mb-12 overflow-y-auto" :class="wrapperClass + ' ' + (streamLibraryItem ? 'h-[calc(100%-270px)]' : 'h-[calc(100%-110px)]')" v-click-outside="clickOutside">
      <div v-show="isMobilePortrait" class="flex items-center justify-end pb-2 px-4 mb-1" @click="closeDrawer">
        <span class="material-symbols text-2xl">arrow_back</span>
      </div>

      <nuxt-link v-for="route in configRoutes" :key="route.id" :to="route.path" class="w-full px-3 h-12 border-b border-primary/30 flex items-center cursor-pointer relative" :class="routeName === route.id ? 'bg-primary/70' : 'hover:bg-primary/30'">
        <p class="leading-4">{{ route.title }}</p>
        <div v-show="routeName === route.iod" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
      </nuxt-link>

      <modals-changelog-view-modal v-model="showChangelogModal" :versionData="versionData" />
    </div>

    <div class="w-44 h-12 px-4 border-t bg-bg border-black/20 fixed left-0 flex flex-col justify-center" :class="wrapperClass" :style="{ bottom: streamLibraryItem ? '160px' : '0px' }">
      <div class="flex items-center justify-between">
        <button type="button" class="underline font-mono text-sm" @click="clickChangelog">v{{ $config.version }}</button>

        <p class="text-xs text-gray-300 italic">{{ Source }}</p>
      </div>
      <a v-if="hasUpdate" :href="githubTagUrl" target="_blank" class="text-warning text-xs">Latest: {{ versionData.latestVersion }}</a>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    isOpen: Boolean
  },
  data() {
    return {
      showChangelogModal: false
    }
  },
  computed: {
    Source() {
      return this.$store.state.Source
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    configRoutes() {
      if (!this.userIsAdminOrUp) {
        return [
          {
            id: 'config-stats',
            title: this.$strings.HeaderYourStats,
            path: '/config/stats'
          }
        ]
      }
      const configRoutes = [
        {
          id: 'config',
          title: this.$strings.HeaderSettings,
          path: '/config'
        },
        {
          id: 'config-libraries',
          title: this.$strings.HeaderLibraries,
          path: '/config/libraries'
        },
        {
          id: 'config-users',
          title: this.$strings.HeaderUsers,
          path: '/config/users'
        },
        {
          id: 'config-api-keys',
          title: this.$strings.HeaderApiKeys,
          path: '/config/api-keys'
        },
        {
          id: 'config-sessions',
          title: this.$strings.HeaderListeningSessions,
          path: '/config/sessions'
        },
        {
          id: 'config-backups',
          title: this.$strings.HeaderBackups,
          path: '/config/backups'
        },
        {
          id: 'config-log',
          title: this.$strings.HeaderLogs,
          path: '/config/log'
        },
        {
          id: 'config-notifications',
          title: this.$strings.HeaderNotifications,
          path: '/config/notifications'
        },
        {
          id: 'config-email',
          title: this.$strings.HeaderEmail,
          path: '/config/email'
        },
        {
          id: 'config-item-metadata-utils',
          title: this.$strings.HeaderItemMetadataUtils,
          path: '/config/item-metadata-utils'
        },
        {
          id: 'config-rss-feeds',
          title: this.$strings.HeaderRSSFeeds,
          path: '/config/rss-feeds'
        },
        {
          id: 'config-authentication',
          title: this.$strings.HeaderAuthentication,
          path: '/config/authentication'
        }
      ]

      if (this.currentLibraryId) {
        configRoutes.push({
          id: 'library-stats',
          title: this.$strings.HeaderLibraryStats,
          path: `/library/${this.currentLibraryId}/stats`
        })
        configRoutes.push({
          id: 'config-stats',
          title: this.$strings.HeaderYourStats,
          path: '/config/stats'
        })
      }

      return configRoutes
    },
    wrapperClass() {
      var classes = []
      if (this.drawerOpen) classes.push('translate-x-0')
      else classes.push('-translate-x-44')
      if (this.isMobilePortrait) classes.push('z-50')
      else classes.push('z-40')
      return classes.join(' ')
    },
    isMobile() {
      return this.$store.state.globals.isMobile
    },
    isMobileLandscape() {
      return this.$store.state.globals.isMobileLandscape
    },
    isMobilePortrait() {
      return this.$store.state.globals.isMobilePortrait
    },
    drawerOpen() {
      return !this.isMobilePortrait || this.isOpen
    },
    routeName() {
      return this.$route.name
    },
    versionData() {
      return this.$store.state.versionData || {}
    },
    hasUpdate() {
      return !!this.versionData.hasUpdate
    },
    githubTagUrl() {
      return this.versionData.githubTagUrl
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    clickChangelog() {
      this.showChangelogModal = true
    },
    clickOutside() {
      if (!this.isOpen) return
      this.closeDrawer()
    },
    closeDrawer() {
      this.$emit('update:isOpen', false)
    }
  }
}
</script>
