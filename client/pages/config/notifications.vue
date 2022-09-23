<template>
  <div>
    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-8 mb-2 max-w-3xl mx-auto">
      <h2 class="text-xl font-semibold mb-2">Apprise Notification Settings</h2>
      <p class="mb-6">Insert some text here describing this feature</p>

      <form @submit.prevent="submitForm">
        <ui-text-input-with-label v-model="appriseApiUrl" label="Apprise API Url" />
        <div class="flex items-center justify-end pt-4">
          <ui-btn type="submit">Save</ui-btn>
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
        <div :key="notification.id" class="w-full bg-primary rounded-xl p-4">
          <div class="flex items-center">
            <p class="text-lg font-semibold">{{ notification.eventName }}</p>
            <div class="flex-grow" />

            <ui-btn :loading="sendingTest" small class="mr-2" @click="sendTest(notification)">Test</ui-btn>

            <ui-icon-btn bg-color="error" :size="7" icon-font-size="1.2rem" icon="delete" @click="deleteNotification(notification)" />
          </div>
          <div class="pt-4">
            <p class="text-gray-300">{{ notification.urls.join(', ') }}</p>
          </div>
        </div>
      </template>
    </div>

    <modals-notification-edit-modal v-model="showEditModal" :notification="selectedNotification" :notification-data="notificationData" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
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
    deleteNotification(notification) {
      this.$axios
        .$delete(`/api/notifications/${notification.id}`)
        .then(() => {
          this.$toast.success('Deleted notification')
          this.notificationSettings.notifications = this.notificationSettings.notifications.filter((n) => n.id !== notification.id)
          this.notifications = this.notificationSettings.notifications
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Failed to delete notification')
        })
    },
    sendTest(notification) {
      this.sendingTest = true
      this.$axios
        .$get(`/api/notifications/${notification.id}/test`)
        .then(() => {
          this.$toast.success('Triggered test notification')
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Failed to trigger test notification')
        })
        .finally(() => {
          this.sendingTest = false
        })
    },
    clickCreate() {
      this.selectedNotification = null
      this.showEditModal = true
    },
    submitForm() {
      if (this.notificationSettings && this.notificationSettings.appriseApiUrl == this.appriseApiUrl) {
        return
      }

      // TODO: Validate apprise api url

      const updatePayload = {
        appriseApiUrl: this.appriseApiUrl || null
      }
      this.loading = true
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
          this.loading = false
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
      this.notificationSettings = notificationResponse.settings
      this.notificationData = notificationResponse.data
      console.log('Notification response', notificationResponse)
      this.appriseApiUrl = this.notificationSettings.appriseApiUrl
      this.notifications = this.notificationSettings.notifications || []
    }
  },
  mounted() {
    this.init()
  }
}
</script>