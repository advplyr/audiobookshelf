<template>
  <div class="w-44 fixed left-0 top-16 z-40 h-full bg-bg bg-opacity-100 md:bg-opacity-70 shadow-lg border-r border-white border-opacity-5 py-4 transform transition-transform" :class="drawerOpen ? 'translate-x-0' : '-translate-x-44'" v-click-outside="clickOutside">
    <div class="md:hidden flex items-center justify-end py-2 px-4 mb-1" @click="closeDrawer">
      <span class="material-icons text-2xl">arrow_back</span>
    </div>
    <nuxt-link to="/config" class="w-full px-4 h-12 border-b border-opacity-0 flex items-center cursor-pointer relative" :class="routeName === 'config' ? 'bg-primary bg-opacity-70' : 'hover:bg-primary hover:bg-opacity-30'">
      <p>Settings</p>
      <div v-show="routeName === 'config'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>
    <nuxt-link to="/config/libraries" class="w-full px-4 h-12 border-b border-opacity-0 flex items-center cursor-pointer relative" :class="routeName === 'config-libraries' ? 'bg-primary bg-opacity-70' : 'hover:bg-primary hover:bg-opacity-30'">
      <p>Libraries</p>
      <div v-show="routeName === 'config-libraries'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>
    <nuxt-link to="/config/users" class="w-full px-4 h-12 border-b border-opacity-0 flex items-center cursor-pointer relative" :class="routeName === 'config-users' ? 'bg-primary bg-opacity-70' : 'hover:bg-primary hover:bg-opacity-30'">
      <p>Users</p>
      <div v-show="routeName === 'config-users'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>
    <nuxt-link to="/config/backups" class="w-full px-4 h-12 border-b border-opacity-0 flex items-center cursor-pointer relative" :class="routeName === 'config-backups' ? 'bg-primary bg-opacity-70' : 'hover:bg-primary hover:bg-opacity-30'">
      <p>Backups</p>
      <div v-show="routeName === 'config-backups'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>
    <nuxt-link to="/config/log" class="w-full px-4 h-12 border-b border-opacity-0 flex items-center cursor-pointer relative" :class="routeName === 'config-log' ? 'bg-primary bg-opacity-70' : 'hover:bg-primary hover:bg-opacity-30'">
      <p>Log</p>
      <div v-show="routeName === 'config-log'" class="h-full w-0.5 bg-yellow-400 absolute top-0 left-0" />
    </nuxt-link>

    <div class="w-full h-12 px-4 border-t border-black border-opacity-20 absolute bottom-20 left-0 flex flex-col justify-center">
      <p class="font-mono text-sm">v{{ $config.version }}</p>
      <a v-if="hasUpdate" :href="githubTagUrl" target="_blank" class="text-warning text-sm">Update available: {{ latestVersion }}</a>
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
      windowWidth: 0
    }
  },
  computed: {
    drawerOpen() {
      if (this.windowWidth < 758) return this.isOpen
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
    }
  },
  methods: {
    clickOutside() {
      if (!this.isOpen) return
      this.closeDrawer()
    },
    closeDrawer() {
      this.$emit('update:isOpen', false)
    },
    resize() {
      this.windowWidth = window.innerWidth
    }
  },
  mounted() {
    window.addEventListener('resize', this.resize)
    this.windowWidth = this.resize
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
  }
}
</script>