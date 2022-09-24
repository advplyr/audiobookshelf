<template>
  <div>
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-8 mb-2 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-2">Apprise Notification Settings</h2>
      <p class="mb-6">Insert some text here describing this feature</p>

      <form @submit.prevent="submitForm">
        <ui-text-input-with-label ref="apiUrlInput" v-model="appriseApiUrl" :disabled="savingSettings" label="Apprise API Url" />
        <div class="flex items-center justify-end pt-4">
          <ui-btn :loading="savingSettings" type="submit">Save</ui-btn>
        </div>
      </form>

      <div class="w-full h-px bg-white bg-opacity-10 my-6" />

      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">Notifications</h2>
        <ui-btn small color="success" class="flex items-center" @click="clickCreate">Create <span class="material-icons text-lg pl-2">add</span></ui-btn>
      </div>

      <div v-if="!notifications.length" class="flex justify-center text-center">
        <p class="text-lg text-gray-200">No notifications</p>
      </div>
      <template v-for="notification in notifications">
        <cards-notification-card :key="notification.id" :notification="notification" @update="updateSettings" @edit="editNotification" />
      </template>
    </div>

    <modals-notification-edit-modal v-model="showEditModal" :notification="selectedNotification" :notification-data="notificationData" @update="updateSettings" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      savingSettings: false,
      appriseApiUrl: null,
      notifications: [],
      notificationSettings: null,
      notificationData: null,
      showEditModal: false,
      selectedNotification: null,
      sendingTest: false
    }
  },
  computed: {},
  methods: {
    updateSettings(settings) {
      this.notificationSettings = settings
      this.notifications = settings.notifications
    },
    editNotification(notification) {
      this.selectedNotification = notification
      this.showEditModal = true
    },
    clickCreate() {
      this.selectedNotification = null
      this.showEditModal = true
    },
    validateAppriseApiUrl() {
      try {
        return new URL(this.appriseApiUrl)
      } catch (error) {
        console.log('URL error', error)
        this.$toast.error(error.message)
        return false
      }
    },
    submitForm() {
      if (this.notificationSettings && this.notificationSettings.appriseApiUrl == this.appriseApiUrl) {
        this.$toast.info('No update necessary')
        return
      }

      if (this.$refs.apiUrlInput) {
        this.$refs.apiUrlInput.blur()
      }

      const isValid = this.validateAppriseApiUrl()
      if (!isValid) {
        return
      }

      const updatePayload = {
        appriseApiUrl: this.appriseApiUrl || null
      }
      this.savingSettings = true
      this.$axios
        .$patch('/api/notifications', updatePayload)
        .then(() => {
          this.$toast.success('Notification settings updated')
        })
        .catch((error) => {
          console.error('Failed to update notification settings', error)
          this.$toast.error('Failed to update notification settings')
        })
        .finally(() => {
          this.savingSettings = false
        })
    },
    async init() {
      this.loading = true
      const notificationResponse = await this.$axios.$get('/api/notifications').catch((error) => {
        console.error('Failed to get notification settings', error)
        this.$toast.error('Failed to load notification settings')
        return null
      })
      this.loading = false
      if (!notificationResponse) {
        return
      }
      this.notificationData = notificationResponse.data
      this.setNotificationSettings(notificationResponse.settings)
    },
    setNotificationSettings(notificationSettings) {
      this.notificationSettings = notificationSettings
      this.appriseApiUrl = notificationSettings.appriseApiUrl
      this.notifications = notificationSettings.notifications || []
    },
    notificationsUpdated(notificationSettings) {
      console.log('Notifications updated', notificationSettings)
      this.setNotificationSettings(notificationSettings)
    }
  },
  mounted() {
    this.init()
    this.$root.socket.on('notifications_updated', this.notificationsUpdated)
  },
  beforeDestroy() {
    this.$root.socket.off('notifications_updated', this.notificationsUpdated)
  }
}
</script>