<template>
  <div>
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-3 md:p-8 mb-2 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-4">Apprise Notification Settings</h2>
      <p class="mb-6 text-gray-200">
        In order to use this feature you will need to have an instance of <a href="https://github.com/caronc/apprise-api" target="_blank" class="hover:underline text-blue-400 hover:text-blue-300">Apprise API</a> running or an api that will handle those same requests. <br />The Apprise API Url should be the full URL path to send the notification, e.g., if your API instance is served at
        <span class="rounded-md bg-neutral-600 text-sm text-white py-0.5 px-1 font-mono">http://192.168.1.1:8337</span> then you would put <span class="rounded-md bg-neutral-600 text-sm text-white py-0.5 px-1 font-mono">http://192.168.1.1:8337/notify</span>.
      </p>

      <form @submit.prevent="submitForm">
        <ui-text-input-with-label ref="apiUrlInput" v-model="appriseApiUrl" :disabled="savingSettings" label="Apprise API Url" class="mb-2" />

        <div class="flex items-center py-2">
          <ui-text-input ref="maxNotificationQueueInput" type="number" v-model="maxNotificationQueue" no-spinner :disabled="savingSettings" :padding-x="1" text-center class="w-10" />

          <ui-tooltip text="Events are limited to firing 1 per second. Events will be ignored if the queue is at max size. This prevents notification spamming." direction="right">
            <p class="pl-2 md:pl-4 text-base md:text-lg">Max queue size for notification events<span class="material-icons icon-text ml-1">info_outlined</span></p>
          </ui-tooltip>
        </div>

        <div class="flex items-center py-2">
          <ui-text-input ref="maxFailedAttemptsInput" type="number" v-model="maxFailedAttempts" no-spinner :disabled="savingSettings" :padding-x="1" text-center class="w-10" />

          <ui-tooltip text="Notifications are disabled once they fail to send this many times." direction="right">
            <p class="pl-2 md:pl-4 text-base md:text-lg">Max failed attempts<span class="material-icons icon-text ml-1">info_outlined</span></p>
          </ui-tooltip>
        </div>

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
      maxNotificationQueue: 0,
      maxFailedAttempts: 0,
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
    validateForm() {
      if (this.$refs.apiUrlInput) {
        this.$refs.apiUrlInput.blur()
      }
      if (this.$refs.maxNotificationQueueInput) {
        this.$refs.maxNotificationQueueInput.blur()
      }
      if (this.$refs.maxFailedAttemptsInput) {
        this.$refs.maxFailedAttemptsInput.blur()
      }

      if (!this.validateAppriseApiUrl()) {
        return false
      }

      if (isNaN(this.maxNotificationQueue) || this.maxNotificationQueue <= 0) {
        this.$toast.error('Max notification queue must be >= 0')
        return false
      }

      if (isNaN(this.maxFailedAttempts) || this.maxFailedAttempts <= 0) {
        this.$toast.error('Max failed attempts must be >= 0')
        return false
      }

      return true
    },
    submitForm() {
      if (!this.validateForm()) return

      const updatePayload = {
        appriseApiUrl: this.appriseApiUrl || null,
        maxNotificationQueue: Number(this.maxNotificationQueue),
        maxFailedAttempts: Number(this.maxFailedAttempts)
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
      this.maxNotificationQueue = notificationSettings.maxNotificationQueue
      this.maxFailedAttempts = notificationSettings.maxFailedAttempts
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