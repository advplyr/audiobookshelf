<template>
  <div class="w-full">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <nuxt-link v-for="setting in serverSettings" :key="setting.path" :to="setting.path" class="p-4 bg-primary hover:bg-primary-600 rounded-lg transition-colors duration-200">
        <div class="flex items-center">
          <span class="material-symbols text-2xl mr-3">{{ setting.icon }}</span>
          <div>
            <h3 class="text-lg font-semibold">{{ setting.title }}</h3>
            <p class="text-sm text-gray-300">{{ setting.description }}</p>
          </div>
        </div>
      </nuxt-link>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      serverSettings: [
        {
          title: this.$strings.HeaderAuthentication || 'Authentication',
          description: this.$strings.DescriptionAuthentication || 'Configure authentication methods and settings',
          path: '/config/authentication',
          icon: 'security'
        },
        {
          title: this.$strings.HeaderLibraries || 'Libraries',
          description: this.$strings.DescriptionLibraries || 'Manage your libraries',
          path: '/config/libraries',
          icon: 'library_books'
        },
        {
          title: this.$strings.HeaderBackups || 'Backups',
          description: this.$strings.DescriptionBackups || 'Configure server backups',
          path: '/config/backups',
          icon: 'backup'
        },
        {
          title: this.$strings.HeaderEmail || 'Email',
          description: this.$strings.DescriptionEmail || 'Configure email settings',
          path: '/config/email',
          icon: 'mail'
        },
        {
          title: this.$strings.HeaderNotifications || 'Notifications',
          description: this.$strings.DescriptionNotifications || 'Configure notification settings',
          path: '/config/notifications',
          icon: 'notifications'
        },
        {
          title: this.$strings.HeaderServerLogs || 'Server Logs',
          description: this.$strings.DescriptionServerLogs || 'View server logs',
          path: '/config/log',
          icon: 'article'
        },
        {
          title: this.$strings.HeaderServerStyling || 'Server Styling',
          description: this.$strings.DescriptionServerStyling || 'Customize server appearance',
          path: '/config/styling',
          icon: 'palette'
        }
      ]
    }
  }
}
</script> 