<template>
  <div class="w-44 fixed left-0 top-16 h-full bg-bg bg-opacity-100 md:bg-opacity-70 shadow-lg border-r border-white border-opacity-5 py-3 transform transition-transform" :class="wrapperClass" v-click-outside="clickOutside">
    <div class="md:hidden flex items-center justify-end pb-2 px-4 mb-1" @click="closeDrawer">
      <span class="material-icons text-2xl">arrow_back</span>
    </div>

    <nuxt-link v-for="route in configRoutes" :key="route.id" :to="route.path" class="w-full px-4 h-12 border-b border-opacity-0 flex items-center cursor-pointer relative" :class="routeName === route.id ? 'bg-primary bg-opacity-70' : 'hover:bg-primary hover:bg-opacity-30'">
      <p>{{ route.title }}</p>
      <div v-show="routeName === route.iod" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>

    <div class="w-full h-12 px-4 border-t border-black border-opacity-20 absolute left-0 flex flex-col justify-center" :style="{ bottom: streamLibraryItem && isMobileLandscape ? '300px' : '65px' }">
      <div class="flex justify-between">
        <p class="font-mono text-sm">v{{ $config.version }}</p>

        <p class="font-mono text-xs text-gray-300 italic">{{ Source }}</p>
      </div>
      <a v-if="hasUpdate" :href="githubTagUrl" target="_blank" class="text-warning text-xs">Latest: {{ latestVersion }}</a>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    isOpen: Boolean
  },
  data() {
    return {}
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
            title: 'Your Stats',
            path: '/config/stats'
          }
        ]
      }
      const configRoutes = [
        {
          id: 'config',
          title: 'Settings',
          path: '/config'
        },
        {
          id: 'config-libraries',
          title: 'Libraries',
          path: '/config/libraries'
        },
        {
          id: 'config-users',
          title: 'Users',
          path: '/config/users'
        },
        {
          id: 'config-sessions',
          title: 'Listening Sessions',
          path: '/config/sessions'
        },
        {
          id: 'config-backups',
          title: 'Backups',
          path: '/config/backups'
        },
        {
          id: 'config-log',
          title: 'Logs',
          path: '/config/log'
        }
      ]

      if (this.currentLibraryId) {
        configRoutes.push({
          id: 'config-library-stats',
          title: 'Library Stats',
          path: '/config/library-stats'
        })
        configRoutes.push({
          id: 'config-stats',
          title: 'Your Stats',
          path: '/config/stats'
        })
      }

      return configRoutes
    },
    wrapperClass() {
      var classes = []
      if (this.drawerOpen) classes.push('translate-x-0')
      else classes.push('-translate-x-44')
      if (this.isMobile) classes.push('z-50')
      else classes.push('z-40')
      return classes.join(' ')
    },
    isMobile() {
      return this.$store.state.globals.isMobile
    },
    isMobileLandscape() {
      return this.$store.state.globals.isMobileLandscape
    },
    drawerOpen() {
      if (this.isMobile) return this.isOpen
      return true
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
    latestVersion() {
      return this.versionData.latestVersion
    },
    githubTagUrl() {
      return this.versionData.githubTagUrl
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
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