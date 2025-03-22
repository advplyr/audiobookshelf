<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderAppriseNotificationSettings" :description="$strings.MessageAppriseDescription">
      <form @submit.prevent="submitForm">
        <ui-text-input-with-label ref="apiUrlInput" v-model="appriseApiUrl" :disabled="savingSettings" label="Apprise API Url" class="mb-2" />

        <div class="flex items-center py-2">
          <ui-text-input ref="maxNotificationQueueInput" type="number" v-model="maxNotificationQueue" no-spinner :disabled="savingSettings" :padding-x="1" text-center class="w-10" />

          <ui-tooltip :text="$strings.LabelNotificationsMaxQueueSizeHelp" direction="right">
            <p class="pl-2 md:pl-4 text-base md:text-lg">{{ $strings.LabelNotificationsMaxQueueSize }}<span class="material-symbols icon-text ml-1">info</span></p>
          </ui-tooltip>
        </div>

        <div class="flex items-center py-2">
          <ui-text-input ref="maxFailedAttemptsInput" type="number" v-model="maxFailedAttempts" no-spinner :disabled="savingSettings" :padding-x="1" text-center class="w-10" />

          <ui-tooltip :text="$strings.LabelNotificationsMaxFailedAttemptsHelp" direction="right">
            <p class="pl-2 md:pl-4 text-base md:text-lg">{{ $strings.LabelNotificationsMaxFailedAttempts }}<span class="material-symbols icon-text ml-1">info</span></p>
          </ui-tooltip>
        </div>

        <div class="flex items-center justify-end pt-4">
          <ui-btn :loading="savingSettings" type="submit">{{ $strings.ButtonSave }}</ui-btn>
        </div>
      </form>

      <div class="w-full h-px bg-white/10 my-6" />

      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">{{ $strings.HeaderNotifications }}</h2>
        <ui-btn small color="bg-success" class="flex items-center" @click="clickCreate">{{ $strings.ButtonCreate }} <span class="material-symbols text-lg pl-2">add</span></ui-btn>
      </div>

      <div v-if="!notifications.length" class="flex justify-center text-center">
        <p class="text-lg text-gray-200">{{ $strings.MessageNoNotifications }}</p>
      </div>
      <template v-for="notification in notifications">
        <cards-notification-card :key="notification.id" :notification="notification" @update="updateSettings" @edit="editNotification" />
      </template>
    </app-settings-content>

    <modals-notification-edit-modal v-model="showEditModal" :notification="selectedNotification" :notification-data="notificationData" @update="updateSettings" />
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
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
        this.$toast.error(this.$strings.ToastNotificationQueueMaximum)
        return false
      }

      if (isNaN(this.maxFailedAttempts) || this.maxFailedAttempts <= 0) {
        this.$toast.error(this.$strings.ToastNotificationFailedMaximum)
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
          this.$toast.success(this.$strings.ToastNotificationSettingsUpdateSuccess)
        })
        .catch((error) => {
          console.error('Failed to update notification settings', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.savingSettings = false
        })
    },
    async init() {
      this.loading = true
      const notificationResponse = await this.$axios.$get('/api/notifications').catch((error) => {
        console.error('Failed to get notification settings', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
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
